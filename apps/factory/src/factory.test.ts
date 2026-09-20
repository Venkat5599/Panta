import { beforeEach, describe, expect, test } from "bun:test";
import { EPOCH_DURATION_MS, EPOCH_GENESIS_MS, createLogger, epochByIndex } from "@premium/core";
import { createDatabase, markets, runMigrations } from "@premium/db";
import type { PantaClient } from "@premium/panta";
import type { Config, RiskConfig } from "./config.ts";
import { Factory } from "./factory.ts";
import type { Chain } from "./solana.ts";

const RISK: RiskConfig = {
  protocol: "kamino",
  programId: "KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD",
  riskClass: "liquidation",
  thresholdBaseUnits: "2000000000000",
};

const logger = createLogger("test");
// Silence the structured logger; failures are asserted, not read.
for (const level of ["debug", "info", "warn", "error"] as const) logger[level] = () => {};
logger.child = () => logger;

function baseConfig(overrides: Partial<Config> = {}): Config {
  return {
    PANTA_API_BASE_URL: "https://api.test/v1",
    PANTA_API_KEY: "pk_test",
    RPC_URL: "https://rpc.test",
    FACTORY_KEYPAIR_PATH: "/dev/null",
    TURSO_DATABASE_URL: ":memory:",
    SEED_USDC: 0, // seeding is exercised separately
    HEALTH_PORT: 0,
    TICK_MINUTES: 5,
    MIN_EPOCH_INDEX: 0,
    MAX_CREATES_PER_BOOT: 4,
    DRY_RUN: false,
    risks: [RISK],
    ...overrides,
  } as Config;
}

/** Records every call so we can assert on what the factory did, not just its return. */
function fakePanta(overrides: Partial<Record<string, unknown>> = {}) {
  const calls = { list: 0, quote: 0, build: 0, register: 0, order: 0, report: 0 };
  const existing: Array<{ slug: string }> = [];
  const panta = {
    listMarkets: async () => {
      calls.list++;
      return [...existing];
    },
    quoteMarketCreation: async () => {
      calls.quote++;
      return { feeBaseUnits: "50000000", raw: {} };
    },
    buildMarketCreation: async () => {
      calls.build++;
      return "dHg=";
    },
    registerMarket: async () => {
      calls.register++;
      return { id: "market-1", url: "https://panta.market/m/1" };
    },
    buildOrder: async () => {
      calls.order++;
      return "dHg=";
    },
    reportTrade: async () => {
      calls.report++;
      return {};
    },
    ...overrides,
  } as unknown as PantaClient;
  return { panta, calls, existing };
}

function fakeChain(overrides: Partial<Record<string, unknown>> = {}) {
  const sent: string[] = [];
  const chain = {
    publicKey: "Fact0ry11111111111111111111111111111111111",
    getSlot: async () => 300_000_000,
    getBalance: async () => 1_000_000_000,
    signAndSend: async (_tx: string, label: string) => {
      sent.push(label);
      return `sig-${label}`;
    },
    ...overrides,
  } as unknown as Chain;
  return { chain, sent };
}

async function freshDb() {
  const db = createDatabase(":memory:");
  await runMigrations(db);
  return db;
}

/** Sit inside epoch 2 so three epochs (0,1,2) are due. */
const IN_EPOCH_2 = new Date(EPOCH_GENESIS_MS + 2 * EPOCH_DURATION_MS + 60_000);

describe("ensureMarket", () => {
  let db: Awaited<ReturnType<typeof freshDb>>;
  beforeEach(async () => {
    db = await freshDb();
  });

  test("creates a market and records the signature", async () => {
    const { panta, calls } = fakePanta();
    const { chain, sent } = fakeChain();
    const factory = new Factory({ config: baseConfig(), db, panta, chain, logger });

    const outcome = await factory.ensureMarket(RISK, epochByIndex(0));

    expect(outcome.status).toBe("created");
    expect(outcome.slug).toBe("kamino-liquidation-e0");
    expect(calls.quote).toBe(1);
    expect(calls.register).toBe(1);
    expect(sent).toEqual(["create:kamino-liquidation-e0"]);
  });

  test("freezes the published slot range at creation (X2)", async () => {
    const { panta } = fakePanta();
    const { chain } = fakeChain();
    const factory = new Factory({ config: baseConfig(), db, panta, chain, logger });

    await factory.ensureMarket(RISK, epochByIndex(0));

    const epoch = await db.query.epochs.findFirst();
    expect(epoch?.startSlot).toBe(300_000_000);
    // startSlot + SLOTS_PER_EPOCH, not a wall-clock derivation.
    expect(epoch!.endSlot! - epoch!.startSlot!).toBe(1_440_000);
  });

  test("is idempotent — a second call creates nothing (B2)", async () => {
    const { panta, calls } = fakePanta();
    const { chain } = fakeChain();
    const factory = new Factory({ config: baseConfig(), db, panta, chain, logger });

    await factory.ensureMarket(RISK, epochByIndex(0));
    const second = await factory.ensureMarket(RISK, epochByIndex(0));

    expect(second.status).toBe("already-exists");
    expect(calls.build).toBe(1); // not 2
    expect(await db.select().from(markets)).toHaveLength(1);
  });

  test("detects an existing market from Panta when the database is empty", async () => {
    // The exact cold-restart case: our cache is gone, but the market is live.
    const { panta, calls, existing } = fakePanta();
    existing.push({ slug: "kamino-liquidation-e0" });
    const { chain } = fakeChain();
    const factory = new Factory({ config: baseConfig(), db, panta, chain, logger });

    const outcome = await factory.ensureMarket(RISK, epochByIndex(0));

    expect(outcome.status).toBe("already-exists");
    expect(calls.build).toBe(0);
  });

  test("refuses to create when existence cannot be verified", async () => {
    // A missed epoch is recoverable next tick; a duplicate market is not.
    const { panta, calls } = fakePanta({
      listMarkets: async () => {
        throw new Error("panta unreachable");
      },
    });
    const { chain } = fakeChain();
    const factory = new Factory({ config: baseConfig(), db, panta, chain, logger });

    const outcome = await factory.ensureMarket(RISK, epochByIndex(0));

    expect(outcome.status).toBe("failed");
    expect(calls.build).toBe(0);
  });

  test("does not persist a market when the chain call fails", async () => {
    const { panta } = fakePanta();
    const { chain } = fakeChain({
      signAndSend: async () => {
        throw new Error("simulation failed");
      },
    });
    const factory = new Factory({ config: baseConfig(), db, panta, chain, logger });

    const outcome = await factory.ensureMarket(RISK, epochByIndex(0));

    expect(outcome.status).toBe("failed");
    // A row without a signature would make the next boot believe it exists.
    expect(await db.select().from(markets)).toHaveLength(0);
  });

  test("skips epochs below MIN_EPOCH_INDEX", async () => {
    const { panta, calls } = fakePanta();
    const { chain } = fakeChain();
    const factory = new Factory({
      config: baseConfig({ MIN_EPOCH_INDEX: 5 }),
      db,
      panta,
      chain,
      logger,
    });

    expect((await factory.ensureMarket(RISK, epochByIndex(2))).status).toBe("skipped");
    expect(calls.quote).toBe(0);
  });

  test("a failed seed does not undo a created market", async () => {
    const { panta } = fakePanta({
      buildOrder: async () => {
        throw new Error("curve unavailable");
      },
    });
    const { chain } = fakeChain();
    const factory = new Factory({
      config: baseConfig({ SEED_USDC: 50 }),
      db,
      panta,
      chain,
      logger,
    });

    const outcome = await factory.ensureMarket(RISK, epochByIndex(0));

    expect(outcome.status).toBe("created");
    expect(await db.select().from(markets)).toHaveLength(1);
  });

  test("seeds the NO side and reports it for attribution", async () => {
    const { panta, calls } = fakePanta();
    const { chain, sent } = fakeChain();
    const factory = new Factory({
      config: baseConfig({ SEED_USDC: 50 }),
      db,
      panta,
      chain,
      logger,
    });

    await factory.ensureMarket(RISK, epochByIndex(0));

    expect(calls.order).toBe(1);
    // Attribution wired from the first trade, including our own seed.
    expect(calls.report).toBe(1);
    expect(sent).toContain("seed:kamino-liquidation-e0");
  });
});

describe("reconcile — catch-up on boot (B11)", () => {
  let db: Awaited<ReturnType<typeof freshDb>>;
  beforeEach(async () => {
    db = await freshDb();
  });

  test("backfills every epoch missed while down", async () => {
    const { panta } = fakePanta();
    const { chain } = fakeChain();
    const factory = new Factory({ config: baseConfig(), db, panta, chain, logger });

    const outcomes = await factory.reconcile(IN_EPOCH_2);

    expect(outcomes.map((o) => o.slug)).toEqual([
      "kamino-liquidation-e0",
      "kamino-liquidation-e1",
      "kamino-liquidation-e2",
    ]);
    expect(outcomes.every((o) => o.status === "created")).toBe(true);
  });

  test("a second reconcile is a no-op", async () => {
    const { panta, calls } = fakePanta();
    const { chain } = fakeChain();
    const factory = new Factory({ config: baseConfig(), db, panta, chain, logger });

    await factory.reconcile(IN_EPOCH_2);
    const buildsAfterFirst = calls.build;
    const second = await factory.reconcile(IN_EPOCH_2);

    expect(calls.build).toBe(buildsAfterFirst);
    expect(second.every((o) => o.status === "already-exists")).toBe(true);
  });

  test("respects MAX_CREATES_PER_BOOT as a runaway backstop", async () => {
    const { panta } = fakePanta();
    const { chain } = fakeChain();
    const factory = new Factory({
      config: baseConfig({ MAX_CREATES_PER_BOOT: 2 }),
      db,
      panta,
      chain,
      logger,
    });

    const outcomes = await factory.reconcile(IN_EPOCH_2);

    expect(outcomes.filter((o) => o.status === "created")).toHaveLength(2);
  });

  test("creates nothing before genesis", async () => {
    // A skewed clock must idle, not backfill imaginary history.
    const { panta, calls } = fakePanta();
    const { chain } = fakeChain();
    const factory = new Factory({ config: baseConfig(), db, panta, chain, logger });

    expect(await factory.reconcile(new Date(EPOCH_GENESIS_MS - 1))).toEqual([]);
    expect(calls.build).toBe(0);
  });

  test("one failure does not stop the remaining epochs", async () => {
    let attempt = 0;
    const { panta } = fakePanta({
      buildMarketCreation: async () => {
        attempt++;
        if (attempt === 1) throw new Error("transient");
        return "dHg=";
      },
    });
    const { chain } = fakeChain();
    const factory = new Factory({ config: baseConfig(), db, panta, chain, logger });

    const outcomes = await factory.reconcile(IN_EPOCH_2);

    expect(outcomes).toHaveLength(3);
    expect(outcomes[0]!.status).toBe("failed");
    expect(outcomes.slice(1).every((o) => o.status === "created")).toBe(true);
  });
});
