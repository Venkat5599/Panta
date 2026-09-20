import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createClient } from "@libsql/client";
import { and, eq, gte, lte, sum } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import * as schema from "./schema.ts";

const { epochs, markets, liquidationEvents, evidenceBundles, trades } = schema;

/** Assert a write is refused by a database constraint. */
async function expectRejected(write: Promise<unknown>): Promise<void> {
  let threw = false;
  try {
    await write;
  } catch {
    threw = true;
  }
  expect(threw).toBe(true);
}

let db: ReturnType<typeof drizzle<typeof schema>>;

beforeAll(async () => {
  const client = createClient({ url: ":memory:" });
  db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: `${import.meta.dir}/../migrations` });

  await db.insert(epochs).values({
    index: 0,
    startsAt: Date.UTC(2026, 8, 21),
    endsAt: Date.UTC(2026, 8, 28),
    startSlot: 300_000_000,
    endSlot: 301_440_000,
    pinnedPrices: { So11111111111111111111111111111111111111112: "180000000" },
    methodologyUrl: "https://premium.example/methodology/e0",
    status: "open",
  });
});

afterAll(() => {
  // in-memory database dies with the process
});

describe("migrations", () => {
  test("apply cleanly and create every table", async () => {
    const rows = await db.select().from(epochs);
    expect(rows).toHaveLength(1);
  });
});

describe("epochs", () => {
  test("round-trips the pinned price snapshot as JSON", async () => {
    const row = await db.query.epochs.findFirst({ where: eq(epochs.index, 0) });
    expect(row?.pinnedPrices).toEqual({
      So11111111111111111111111111111111111111112: "180000000",
    });
  });

  test("keeps the published slot range intact", async () => {
    const row = await db.query.epochs.findFirst({ where: eq(epochs.index, 0) });
    // PRD.md X2: what was published is what settles. 1,440,000 slots wide.
    expect(row!.endSlot! - row!.startSlot!).toBe(1_440_000);
  });
});

describe("markets — idempotency (PRD B2)", () => {
  test("accepts the first creation", async () => {
    await db.insert(markets).values({
      slug: "kamino-liquidation-e0",
      epochIndex: 0,
      protocol: "kamino",
      riskClass: "liquidation",
      thresholdBaseUnits: "2000000000000",
      creationSignature: "sig-create-1",
    });
    const rows = await db.select().from(markets);
    expect(rows).toHaveLength(1);
  });

  test("rejects a duplicate slug", async () => {
    // The slug is derived, so a crash-retry regenerates the same one. The
    // database is the last line of defence against a double-created market.
    await expectRejected(
      db.insert(markets).values({
        slug: "kamino-liquidation-e0",
        epochIndex: 0,
        protocol: "kamino",
        riskClass: "liquidation",
        thresholdBaseUnits: "2000000000000",
      }),
    );
  });

  test("rejects a second market for the same protocol, class and epoch", async () => {
    // Even under a different slug — a bug in slug derivation must not be able
    // to open two markets on the same question.
    await expectRejected(
      db.insert(markets).values({
        slug: "kamino-liquidation-e0-oops",
        epochIndex: 0,
        protocol: "kamino",
        riskClass: "liquidation",
        thresholdBaseUnits: "2000000000000",
      }),
    );
  });

  test("allows a different risk class in the same epoch", async () => {
    await db.insert(markets).values({
      slug: "kamino-utilization-e0",
      epochIndex: 0,
      protocol: "kamino",
      riskClass: "utilization",
      thresholdBaseUnits: "900000",
    });
    expect(await db.select().from(markets)).toHaveLength(2);
  });
});

describe("liquidation_events — dedupe and the resolution query", () => {
  test("stores several liquidations from one transaction", async () => {
    await db.insert(liquidationEvents).values([
      {
        signature: "sig-liq-1",
        instructionIndex: 0,
        slot: 300_000_100,
        protocol: "kamino",
        collateralMint: "So11111111111111111111111111111111111111112",
        collateralAmount: "5000000000",
        usdBaseUnits: "900000000",
      },
      {
        signature: "sig-liq-1",
        instructionIndex: 1,
        slot: 300_000_100,
        protocol: "kamino",
        collateralMint: "So11111111111111111111111111111111111111112",
        collateralAmount: "1000000000",
        usdBaseUnits: "180000000",
      },
    ]);
    expect(await db.select().from(liquidationEvents)).toHaveLength(2);
  });

  test("rejects the same instruction twice", async () => {
    // Backfills re-read overlapping ranges. Double-counting here would
    // directly corrupt the settlement metric.
    await expectRejected(
      db.insert(liquidationEvents).values({
        signature: "sig-liq-1",
        instructionIndex: 0,
        slot: 300_000_100,
        protocol: "kamino",
        collateralMint: "So11111111111111111111111111111111111111112",
        collateralAmount: "5000000000",
      }),
    );
  });

  test("excludes events outside the published slot range", async () => {
    await db.insert(liquidationEvents).values({
      signature: "sig-liq-outside",
      instructionIndex: 0,
      // One slot past endSlot: must not count toward this epoch.
      slot: 301_440_001,
      protocol: "kamino",
      collateralMint: "So11111111111111111111111111111111111111112",
      collateralAmount: "9999000000000",
      usdBaseUnits: "99999000000000",
    });

    const [row] = await db
      .select({ total: sum(liquidationEvents.usdBaseUnits) })
      .from(liquidationEvents)
      .where(
        and(
          eq(liquidationEvents.protocol, "kamino"),
          gte(liquidationEvents.slot, 300_000_000),
          lte(liquidationEvents.slot, 301_440_000),
        ),
      );

    // 900000000 + 180000000, with the out-of-range event excluded.
    expect(Number(row!.total)).toBe(1_080_000_000);
  });
});

describe("evidence bundles", () => {
  test("store the full methodology and signature list", async () => {
    await db.insert(evidenceBundles).values({
      epochIndex: 0,
      marketSlug: "kamino-liquidation-e0",
      startSlot: 300_000_000,
      endSlot: 301_440_000,
      totalUsdBaseUnits: "1080000000",
      thresholdBaseUnits: "2000000000000",
      outcome: "NO",
      transactionCount: 1,
      methodology: { program: "KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD" },
      signatures: ["sig-liq-1"],
    });

    const row = await db.query.evidenceBundles.findFirst();
    expect(row?.outcome).toBe("NO");
    expect(row?.signatures).toEqual(["sig-liq-1"]);
    expect(row?.methodology).toHaveProperty("program");
  });
});

describe("trades — attribution (PRD X4)", () => {
  test("default to unconfirmed, so nothing unverified is reportable", async () => {
    await db.insert(trades).values({
      signature: "sig-trade-1",
      marketSlug: "kamino-liquidation-e0",
      wallet: "Wa11et1111111111111111111111111111111111111",
      side: "NO",
      amountBaseUnits: "20000000",
    });
    const row = await db.query.trades.findFirst();
    expect(row?.pantaConfirmed).toBe(false);
    expect(row?.isSeed).toBe(false);
  });

  test("distinguish seeded liquidity from organic volume (X3)", async () => {
    await db.insert(trades).values({
      signature: "sig-seed-1",
      marketSlug: "kamino-liquidation-e0",
      wallet: "Fact0ry11111111111111111111111111111111111",
      side: "NO",
      amountBaseUnits: "50000000",
      isSeed: true,
      pantaConfirmed: true,
    });

    const organic = await db
      .select()
      .from(trades)
      .where(and(eq(trades.isSeed, false), eq(trades.pantaConfirmed, true)));

    // Our own seed must never be counted as traction.
    expect(organic).toHaveLength(0);
  });
});

describe("money columns", () => {
  test("survive values past float precision as exact strings", async () => {
    await db.insert(liquidationEvents).values({
      signature: "sig-big",
      instructionIndex: 0,
      slot: 300_500_000,
      protocol: "kamino",
      collateralMint: "So11111111111111111111111111111111111111112",
      collateralAmount: "9007199254740993", // MAX_SAFE_INTEGER + 2
      usdBaseUnits: "9007199254740993",
    });
    const row = await db.query.liquidationEvents.findFirst({
      where: eq(liquidationEvents.signature, "sig-big"),
    });
    expect(row?.collateralAmount).toBe("9007199254740993");
  });
});
