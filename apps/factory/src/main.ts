#!/usr/bin/env bun
import { createLogger } from "@premium/core";
import { createDatabase, runMigrations } from "@premium/db";
import { PantaClient } from "@premium/panta";
import { loadConfig } from "./config.ts";
import { Factory } from "./factory.ts";
import { type HealthState, beat, createHealthServer } from "./health.ts";
import { Chain, loadKeypair } from "./solana.ts";

/**
 * Factory entry point.
 *
 * Crash-only by design (ARCHITECTURE.md §5). There is no graceful shutdown
 * path, because a shutdown path is a thing that can be got wrong and this
 * process has nothing worth flushing — all state lives on chain, in Panta, and
 * in a database that is a cache. If it dies, systemd restarts it and boot
 * reconstructs what it should have done.
 */

const LAMPORTS_PER_SOL = 1_000_000_000;
/** Below this, creation transactions will start failing. Warn while it is still fixable. */
const LOW_BALANCE_LAMPORTS = 0.05 * LAMPORTS_PER_SOL;

const log = createLogger("factory");

async function main(): Promise<void> {
  const config = loadConfig();
  log.info("booting", {
    dryRun: config.DRY_RUN,
    tickMinutes: config.TICK_MINUTES,
    risks: config.risks.map((r) => `${r.protocol}:${r.riskClass}`),
  });

  const db = createDatabase(config.TURSO_DATABASE_URL, config.TURSO_AUTH_TOKEN);
  await runMigrations(db);

  const keypair = await loadKeypair(config.FACTORY_KEYPAIR_PATH);
  const chain = new Chain({
    rpcUrl: config.RPC_URL,
    keypair,
    logger: log,
    dryRun: config.DRY_RUN,
  });

  const panta = new PantaClient({
    baseUrl: config.PANTA_API_BASE_URL,
    auth: {
      apiKey: config.PANTA_API_KEY,
      ...(config.PANTA_USER_ID ? { userId: config.PANTA_USER_ID } : {}),
    },
    logger: log,
  });

  const state: HealthState = {
    bootedAt: Date.now(),
    lastTickAt: null,
    lastTickError: null,
    wallet: chain.publicKey,
    balanceLamports: null,
  };

  createHealthServer(db, state, config.HEALTH_PORT, log);

  // Check funding at boot rather than discovering it mid-epoch. PRD.md calls
  // running out of USDC in week three the dumbest available failure.
  try {
    state.balanceLamports = await chain.getBalance();
    log.info("wallet loaded", {
      wallet: chain.publicKey,
      sol: (state.balanceLamports / LAMPORTS_PER_SOL).toFixed(4),
    });
    if (state.balanceLamports < LOW_BALANCE_LAMPORTS) {
      log.error("WALLET BALANCE IS LOW — fund it before the next epoch boundary", {
        wallet: chain.publicKey,
        lamports: state.balanceLamports,
      });
    }
  } catch (error) {
    // Do not die: the watchdog needs /health up to report that we are unwell.
    log.error("could not read wallet balance at boot", { error });
  }

  const factory = new Factory({ config, db, panta, chain, logger: log });

  const tick = async (trigger: string): Promise<void> => {
    try {
      const outcomes = await factory.reconcile();
      state.lastTickAt = Date.now();
      state.lastTickError = null;

      const created = outcomes.filter((o) => o.status === "created");
      const failed = outcomes.filter((o) => o.status === "failed");

      if (created.length > 0) log.info("markets created", { slugs: created.map((o) => o.slug) });
      if (failed.length > 0) {
        // A failure is not fatal — the next tick retries — but it must be loud.
        log.error("some markets failed", {
          failures: failed.map((o) => ({ slug: o.slug, reason: o.reason })),
        });
        state.lastTickError = failed.map((o) => `${o.slug}: ${o.reason}`).join("; ");
      }

      await beat(db, `${trigger}: ${outcomes.length} checked, ${created.length} created`);
    } catch (error) {
      // Never let a tick throw into the interval. An unhandled rejection here
      // would kill the process on the one boundary that mattered.
      state.lastTickError = error instanceof Error ? error.message : String(error);
      log.error("tick failed", { error });
      await beat(db, `${trigger}: failed`).catch(() => {});
    }
  };

  // Catch-up on boot: backfill anything missed while we were down (B11).
  await tick("boot");

  setInterval(() => void tick("interval"), config.TICK_MINUTES * 60_000);
  log.info("factory running", { tickMinutes: config.TICK_MINUTES });
}

await main().catch((error) => {
  // Exit non-zero so systemd restarts rather than marking us cleanly stopped.
  log.error("fatal error during boot", { error });
  process.exit(1);
});
