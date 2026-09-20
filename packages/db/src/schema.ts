import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/**
 * Schema notes that are load-bearing rather than stylistic:
 *
 * - Every USDC or token amount is TEXT holding an integer base-units string.
 *   SQLite INTEGER is 64-bit and REAL is a double; neither can be trusted with
 *   money at six decimals across the full range, and a silently rounded payout
 *   is the worst bug this product could ship.
 *
 * - Timestamps are integer epoch milliseconds, not SQLite datetime strings, so
 *   comparison and ordering never depend on string formatting.
 *
 * - Nothing here is authoritative. The chain and Panta hold the truth; this is
 *   a cache plus an evidence store. A cold restart rebuilds from GET /markets/
 *   and the epoch schedule (ARCHITECTURE.md §5), so losing this file entirely
 *   must never lose money or history.
 */

const now = sql`(unixepoch() * 1000)`;

/** One row per weekly epoch. The published slot range lives here and is immutable. */
export const epochs = sqliteTable(
  "epochs",
  {
    /** Sequential from EPOCH_GENESIS_MS. Natural key — no surrogate id. */
    index: integer("index").primaryKey(),

    startsAt: integer("starts_at").notNull(),
    endsAt: integer("ends_at").notNull(),

    /**
     * Observed on chain at market open, then frozen.
     *
     * PRD.md X2: a published slot range is never adjusted after the fact. The
     * resolver READS these columns and never derives a range of its own, because
     * a derived range could disagree with the one traders were shown.
     */
    startSlot: integer("start_slot"),
    endSlot: integer("end_slot"),

    /**
     * Price snapshot pinned at epoch start, as JSON `{ mint: baseUnitsString }`.
     * Written once, at open, and published in the methodology. Valuing each
     * liquidation at its own spot price would make the total unrecomputable by
     * a third party, which breaks the ARCHITECTURE.md §3 invariant.
     */
    pinnedPrices: text("pinned_prices", { mode: "json" }).$type<Record<string, string>>(),

    /** Public URL of the methodology, live BEFORE the epoch opens. */
    methodologyUrl: text("methodology_url"),

    status: text("status", {
      enum: ["scheduled", "open", "settling", "resolved", "failed"],
    })
      .notNull()
      .default("scheduled"),

    createdAt: integer("created_at").notNull().default(now),
    updatedAt: integer("updated_at").notNull().default(now),
  },
  (t) => [index("epochs_status_idx").on(t.status)],
);

/** One row per (protocol, risk class, epoch). The slug is the idempotency key. */
export const markets = sqliteTable(
  "markets",
  {
    /** Deterministic: `kamino-liquidation-e3`. Derived, never generated. */
    slug: text("slug").primaryKey(),

    epochIndex: integer("epoch_index")
      .notNull()
      .references(() => epochs.index),

    protocol: text("protocol").notNull(),
    riskClass: text("risk_class", { enum: ["liquidation", "utilization"] }).notNull(),

    /** Threshold the metric is compared against, in USDC base units. */
    thresholdBaseUnits: text("threshold_base_units").notNull(),

    /** Panta's own identifier, learned at registration. */
    pantaMarketId: text("panta_market_id"),
    pantaMarketUrl: text("panta_market_url"),

    /**
     * Presence of a creation signature is what makes creation idempotent (B2):
     * a retry after a crash checks this before building a second transaction.
     */
    creationSignature: text("creation_signature"),

    /** Our own USDC placed on the curve at open. PRD.md X3: always labelled ours. */
    seededBaseUnits: text("seeded_base_units"),
    seedSignature: text("seed_signature"),

    createdAt: integer("created_at").notNull().default(now),
    updatedAt: integer("updated_at").notNull().default(now),
  },
  (t) => [
    uniqueIndex("markets_epoch_protocol_class_idx").on(
      t.epochIndex,
      t.protocol,
      t.riskClass,
    ),
    index("markets_epoch_idx").on(t.epochIndex),
  ],
);

/**
 * Decoded liquidation instructions. The composite key is the dedupe: a single
 * transaction can carry several liquidations, and backfills re-read overlapping
 * ranges, so re-indexing the same slot twice must not double-count the metric.
 */
export const liquidationEvents = sqliteTable(
  "liquidation_events",
  {
    signature: text("signature").notNull(),
    instructionIndex: integer("instruction_index").notNull(),

    slot: integer("slot").notNull(),
    blockTime: integer("block_time"),

    protocol: text("protocol").notNull(),
    collateralMint: text("collateral_mint").notNull(),

    /** Token base units, as a string — decimals vary per mint. */
    collateralAmount: text("collateral_amount").notNull(),

    /** Valued with the epoch's pinned price. Null until the epoch is known. */
    usdBaseUnits: text("usd_base_units"),

    indexedAt: integer("indexed_at").notNull().default(now),
  },
  (t) => [
    primaryKey({ columns: [t.signature, t.instructionIndex] }),
    // The resolution query is a range scan over slots for one protocol.
    index("liq_protocol_slot_idx").on(t.protocol, t.slot),
  ],
);

/**
 * What a third party recomputes to check us (B4). Written once at settlement and
 * never edited — a corrected bundle would be indistinguishable from a doctored one.
 */
export const evidenceBundles = sqliteTable("evidence_bundles", {
  epochIndex: integer("epoch_index")
    .primaryKey()
    .references(() => epochs.index),

  marketSlug: text("market_slug")
    .notNull()
    .references(() => markets.slug),

  startSlot: integer("start_slot").notNull(),
  endSlot: integer("end_slot").notNull(),

  totalUsdBaseUnits: text("total_usd_base_units").notNull(),
  thresholdBaseUnits: text("threshold_base_units").notNull(),
  outcome: text("outcome", { enum: ["YES", "NO"] }).notNull(),

  transactionCount: integer("transaction_count").notNull(),

  /** Program id, pinned prices, query shape — everything needed to reproduce. */
  methodology: text("methodology", { mode: "json" }).$type<Record<string, unknown>>().notNull(),

  /** Every contributing signature, so the total can be audited line by line. */
  signatures: text("signatures", { mode: "json" }).$type<string[]>().notNull(),

  publishedUrl: text("published_url"),
  computedAt: integer("computed_at").notNull().default(now),
});

/**
 * Attribution. PRD.md X4 forbids reporting any traction number not verifiable
 * through Panta's endpoint, so `pantaConfirmed` is the gate on what we publish —
 * a locally-recorded trade is a claim, not evidence.
 */
export const trades = sqliteTable(
  "trades",
  {
    signature: text("signature").primaryKey(),

    marketSlug: text("market_slug")
      .notNull()
      .references(() => markets.slug),

    wallet: text("wallet").notNull(),
    side: text("side", { enum: ["YES", "NO"] }).notNull(),

    amountBaseUnits: text("amount_base_units").notNull(),

    /** True once GET /trades/{signature}/ confirms it. Only these are reportable. */
    pantaConfirmed: integer("panta_confirmed", { mode: "boolean" }).notNull().default(false),

    /** Distinguishes our seeded liquidity from organic volume (X3). */
    isSeed: integer("is_seed", { mode: "boolean" }).notNull().default(false),

    reportedAt: integer("reported_at"),
    createdAt: integer("created_at").notNull().default(now),
  },
  (t) => [
    index("trades_market_idx").on(t.marketSlug),
    index("trades_wallet_idx").on(t.wallet),
  ],
);

/**
 * Factory liveness. The watchdog reads this through the health endpoint; it runs
 * on a different provider on purpose, because a watchdog inside the process it
 * watches is decoration (ARCHITECTURE.md §5).
 */
export const heartbeats = sqliteTable("heartbeats", {
  id: text("id").primaryKey(),
  beatAt: integer("beat_at").notNull().default(now),
  note: text("note"),
});

export type Epoch = typeof epochs.$inferSelect;
export type NewEpoch = typeof epochs.$inferInsert;
export type Market = typeof markets.$inferSelect;
export type NewMarket = typeof markets.$inferInsert;
export type LiquidationEvent = typeof liquidationEvents.$inferSelect;
export type NewLiquidationEvent = typeof liquidationEvents.$inferInsert;
export type EvidenceBundle = typeof evidenceBundles.$inferSelect;
export type NewEvidenceBundle = typeof evidenceBundles.$inferInsert;
export type Trade = typeof trades.$inferSelect;
export type NewTrade = typeof trades.$inferInsert;
