import {
  type Epoch,
  type Logger,
  type RiskClass,
  epochsThrough,
  marketSlug,
  slotRangeFrom,
} from "@premium/core";
import type { Database } from "@premium/db";
import { eq, markets, epochs as epochsTable } from "@premium/db";
import { type PantaClient, marketsOf, toDecimal } from "@premium/panta";
import type { Config, RiskConfig } from "./config.ts";
import type { Chain } from "./solana.ts";

/**
 * The market factory.
 *
 * Design constraint from ARCHITECTURE.md §5: this process must survive three
 * weeks unattended, and the entire traction story is "it has been live since
 * week one". So it holds no authoritative local state. Identity is derived,
 * existence is checked against Panta, and a cold restart reconstructs what it
 * should have done rather than resuming from a file.
 */

export interface FactoryDeps {
  config: Config;
  db: Database;
  panta: PantaClient;
  chain: Chain;
  logger: Logger;
}

export interface CreateOutcome {
  slug: string;
  status: "created" | "already-exists" | "skipped" | "failed";
  signature?: string;
  reason?: string;
}

/** The market question. A number and two slots — never a judgement (PREMIUM.md §1). */
export function buildQuestion(risk: RiskConfig, epoch: Epoch, thresholdUsd: string): string {
  return (
    `Will ${risk.protocol} liquidate more than $${thresholdUsd} of collateral ` +
    `during epoch ${epoch.index}?`
  );
}

/** Human-readable threshold for the question text, from base units. */
function thresholdToUsd(baseUnits: string): string {
  return (Number(BigInt(baseUnits) / 1_000_000n)).toLocaleString("en-US");
}

export class Factory {
  constructor(private readonly deps: FactoryDeps) {}

  /**
   * Does this market already exist?
   *
   * Panta is the authority, not our database — the database can be lost or
   * rolled back, and creating a duplicate market costs a real fee and splits
   * liquidity across two markets asking the same question.
   */
  private async marketExists(slug: string): Promise<boolean> {
    const local = await this.deps.db.query.markets.findFirst({
      where: eq(markets.slug, slug),
    });
    if (local?.creationSignature) return true;

    try {
      const list = await this.deps.panta.listMarkets();
      return marketsOf(list).some((m) => m.slug === slug);
    } catch (error) {
      // If we cannot confirm absence, do not create. A missed epoch is
      // recoverable on the next tick; a duplicate market is not.
      this.deps.logger.error("cannot verify market existence, refusing to create", {
        slug,
        error,
      });
      throw error;
    }
  }

  /**
   * Create one market for (risk, epoch), or confirm it already exists.
   *
   * Idempotent by derived slug (PRD.md B2): a crash between broadcast and
   * registration leaves a market that this will find rather than duplicate.
   */
  async ensureMarket(risk: RiskConfig, epoch: Epoch): Promise<CreateOutcome> {
    const { config, db, panta, chain, logger } = this.deps;
    const slug = marketSlug(risk.protocol, risk.riskClass as RiskClass, epoch.index);
    const log = logger.child(slug);

    if (epoch.index < config.MIN_EPOCH_INDEX) {
      return { slug, status: "skipped", reason: "below MIN_EPOCH_INDEX" };
    }

    try {
      if (await this.marketExists(slug)) {
        log.info("market already exists, nothing to do");
        return { slug, status: "already-exists" };
      }
    } catch (error) {
      return { slug, status: "failed", reason: `existence check failed: ${String(error)}` };
    }

    try {
      // Freeze the settlement window BEFORE creating, so the range we publish
      // is the range traders see. PRD.md X2: never adjusted after the fact.
      const startSlot = await chain.getSlot("confirmed");
      const range = slotRangeFrom(startSlot);
      const thresholdUsd = thresholdToUsd(risk.thresholdBaseUnits);

      const question = buildQuestion(risk, epoch, thresholdUsd);
      const methodologyUrl = `https://premium.market/methodology/${slug}`;

      const request = {
        question,
        imageUrl: `https://premium.market/og/${slug}.png`,
        startTime: epoch.startsAt.toISOString(),
        endTime: epoch.endsAt.toISOString(),
        // The field the whole resolution design rests on: point Panta's
        // resolver at our published, recomputable methodology.
        oracle: methodologyUrl,
      };

      const quote = await panta.quoteMarketCreation(request);
      log.info("creation fee quoted", { fee: quote.feeBaseUnits });

      const unsigned = await panta.buildMarketCreation({
        ...request,
        slug,
        thresholdBaseUnits: risk.thresholdBaseUnits,
      });

      const signature = await chain.signAndSend(unsigned, `create:${slug}`);
      const registered = await panta.registerMarket(signature, { slug });

      // Persist only after the chain has confirmed. A row without a signature
      // would make marketExists lie on the next boot.
      await db
        .insert(epochsTable)
        .values({
          index: epoch.index,
          startsAt: epoch.startsAt.getTime(),
          endsAt: epoch.endsAt.getTime(),
          startSlot: range.startSlot,
          endSlot: range.endSlot,
          methodologyUrl,
          status: "open",
        })
        .onConflictDoNothing();

      await db.insert(markets).values({
        slug,
        epochIndex: epoch.index,
        protocol: risk.protocol,
        riskClass: risk.riskClass,
        thresholdBaseUnits: risk.thresholdBaseUnits,
        creationSignature: signature,
        ...(registered.url ? { pantaMarketUrl: registered.url } : {}),
        ...(registered.id !== undefined
          ? { pantaMarketId: String(registered.id) }
          : registered.marketId !== undefined
            ? { pantaMarketId: String(registered.marketId) }
            : {}),
      });

      log.info("market created", { signature, startSlot, endSlot: range.endSlot });

      // Seeding is best-effort: a market that exists but is unseeded is fine,
      // a failed seed must not roll back a successful creation.
      await this.seed(slug, registered).catch((error) =>
        log.error("seeding failed; market is live but unseeded", { error }),
      );

      return { slug, status: "created", signature };
    } catch (error) {
      log.error("market creation failed", { error });
      return { slug, status: "failed", reason: String(error) };
    }
  }

  /**
   * Place our own USDC on the curve.
   *
   * PRD.md X3: always recorded as ours, never reported as organic volume. The
   * trades row carries isSeed so no traction figure can accidentally include it.
   */
  private async seed(slug: string, registered: { id?: unknown; marketId?: unknown }) {
    const { config, panta, chain, logger } = this.deps;
    if (config.SEED_USDC <= 0) return;

    const marketId = String(registered.id ?? registered.marketId ?? "");
    if (!marketId) {
      logger.warn("no market id returned, cannot seed", { slug });
      return;
    }

    // Primary buys take the DECIMAL encoding, not base units. The brands make
    // getting this backwards a compile error rather than a 1,000,000x bug.
    const amount = toDecimal(config.SEED_USDC);
    const unsigned = await panta.buildOrder(marketId, "NO", amount);
    const signature = await chain.signAndSend(unsigned, `seed:${slug}`);

    // Attribution must be wired from the FIRST trade — including our own.
    await panta.reportTrade(signature, { marketId });
    logger.info("seeded market", { slug, amount, signature });
  }

  /**
   * Catch-up on boot, and the regular tick.
   *
   * Compares every epoch that should exist against what does, and backfills
   * the difference (PRD.md B11). This is why no local state file is needed: the
   * epoch schedule is pure, and Panta holds the truth about what was created.
   */
  async reconcile(now = new Date()): Promise<CreateOutcome[]> {
    const { config, logger } = this.deps;
    const due = epochsThrough(now, config.MIN_EPOCH_INDEX);

    if (due.length === 0) {
      logger.info("no epochs due yet", { now: now.toISOString() });
      return [];
    }

    const outcomes: CreateOutcome[] = [];
    let created = 0;

    for (const risk of config.risks) {
      for (const epoch of due) {
        if (created >= config.MAX_CREATES_PER_BOOT) {
          logger.warn("hit MAX_CREATES_PER_BOOT, deferring the rest to the next tick", {
            limit: config.MAX_CREATES_PER_BOOT,
          });
          return outcomes;
        }
        // Sequential on purpose: each creation spends a fee and moves the
        // slot, and a parallel burst would be much harder to reason about
        // after a partial failure.
        // oxlint-disable-next-line no-await-in-loop
        const outcome = await this.ensureMarket(risk, epoch);
        outcomes.push(outcome);
        if (outcome.status === "created") created++;
      }
    }

    return outcomes;
  }
}
