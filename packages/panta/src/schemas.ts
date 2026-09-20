import { z } from "zod";

/**
 * ════════════════════════════════════════════════════════════════════════════
 *  PROVISIONAL. Every shape in this file is inferred, not observed.
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Panta's public documentation describes the create → quote → build → register
 * workflow but does not publish request or response bodies. These schemas are
 * reconstructed from the docs index, the playground README and the endpoint
 * list in ARCHITECTURE.md §2. They are very likely wrong in the details.
 *
 * Correcting them is a ten-minute job, not a rewrite:
 *
 *     bun run packages/panta/src/spike.ts
 *
 * That hits the live API with a real key, dumps every response to
 * `packages/panta/fixtures/`, and prints the field names it actually saw.
 * Edit this file to match, re-run the tests, done.
 *
 * Two deliberate choices keep the blast radius small:
 *
 *  1. Every object is LOOSE. Unknown fields pass through untouched, so a field
 *     we failed to predict is inert rather than fatal.
 *  2. Every money field is a plain string, re-branded at the client boundary.
 *     Parsing money as a number here would reintroduce the float bug that
 *     amounts.ts exists to prevent.
 *
 * Anything asserted as required below is a guess that WILL throw a
 * PantaSchemaError if wrong — which is the intended behaviour. A loud failure
 * on day zero beats a silent coercion in week three.
 */

/** Panta's docs and playground both use snake_case; camelCase appears too. Accept either. */
const loose = <T extends z.ZodRawShape>(shape: T) => z.object(shape).loose();

// ── Auth ────────────────────────────────────────────────────────────────────

export const AuthTokenResponse = loose({
  access: z.string().optional(),
  refresh: z.string().optional(),
  token: z.string().optional(),
});
export type AuthTokenResponse = z.infer<typeof AuthTokenResponse>;

export const ApiKeyResponse = loose({
  key: z.string().optional(),
  secret: z.string().optional(),
});
export type ApiKeyResponse = z.infer<typeof ApiKeyResponse>;

// ── Markets ─────────────────────────────────────────────────────────────────

export const Market = loose({
  id: z.union([z.string(), z.number()]).optional(),
  question: z.string().optional(),
  slug: z.string().optional(),
  status: z.string().optional(),
  /** Docs call this "phase" in the catalog view. */
  phase: z.string().optional(),
  url: z.string().optional(),
});
export type Market = z.infer<typeof Market>;

/**
 * List endpoints may be a bare array or DRF-style pagination. The docs mention
 * a catalog with categories, which suggests pagination, so accept both rather
 * than betting on one.
 */
export const MarketList = z.union([
  z.array(Market),
  loose({
    results: z.array(Market),
    count: z.number().optional(),
    next: z.string().nullish(),
  }),
]);
export type MarketList = z.infer<typeof MarketList>;

/** Normalise either shape to a plain array. */
export const marketsOf = (list: MarketList): Market[] =>
  Array.isArray(list) ? list : list.results;

// ── Market creation ─────────────────────────────────────────────────────────

/**
 * Observed in the docs for the quote step: `imageUrl` is validated here,
 * `startTime` must respect on-chain minimums, and `region` and `oracle` are
 * optional.
 *
 * `oracle` is the field the whole product depends on. If it accepts our
 * published methodology URL as the resolution source, the resolution-agnostic
 * invariant holds as designed. Confirming that is the single most important
 * question in the day-zero spike.
 */
export const CreateMarketQuoteRequest = loose({
  question: z.string(),
  imageUrl: z.string(),
  startTime: z.union([z.string(), z.number()]),
  endTime: z.union([z.string(), z.number()]).optional(),
  oracle: z.string().optional(),
  region: z.string().optional(),
});
export type CreateMarketQuoteRequest = z.infer<typeof CreateMarketQuoteRequest>;

/**
 * The creation fee. ARCHITECTURE.md §7 says this is an integer string in base
 * units, against the decimal strings used for primary buys. Kept as a raw
 * string here and re-branded as BaseUnits at the client boundary.
 */
export const CreateMarketQuoteResponse = loose({
  fee: z.string().optional(),
  creationFee: z.string().optional(),
  creation_fee: z.string().optional(),
  quoteId: z.string().optional(),
});
export type CreateMarketQuoteResponse = z.infer<typeof CreateMarketQuoteResponse>;

/** An unsigned transaction to sign locally and broadcast ourselves. */
export const UnsignedTransactionResponse = loose({
  transaction: z.string().optional(),
  tx: z.string().optional(),
  /** Some endpoints hand back raw instructions instead of a whole transaction. */
  instructions: z.array(z.unknown()).optional(),
});
export type UnsignedTransactionResponse = z.infer<typeof UnsignedTransactionResponse>;

export const RegisterMarketResponse = loose({
  id: z.union([z.string(), z.number()]).optional(),
  marketId: z.union([z.string(), z.number()]).optional(),
  url: z.string().optional(),
});
export type RegisterMarketResponse = z.infer<typeof RegisterMarketResponse>;

// ── Trading ─────────────────────────────────────────────────────────────────

export const Side = z.enum(["YES", "NO"]);
export type Side = z.infer<typeof Side>;

/**
 * Primary buy quote. Panta's docs say fills are quoted "on the bonding curve",
 * which means the payout is known at purchase rather than settled pro-rata.
 * Confirm in #dev-chat before the pitch claims it — PREMIUM.md §3b treats the
 * market structure as unresolved.
 */
export const OrderQuoteResponse = loose({
  price: z.string().optional(),
  shares: z.string().optional(),
  avgPrice: z.string().optional(),
  fee: z.string().optional(),
});
export type OrderQuoteResponse = z.infer<typeof OrderQuoteResponse>;

// ── Positions and claims ────────────────────────────────────────────────────

export const Position = loose({
  marketId: z.union([z.string(), z.number()]).optional(),
  side: z.string().optional(),
  shares: z.string().optional(),
  claimable: z.boolean().optional(),
});
export type Position = z.infer<typeof Position>;

export const PositionList = z.union([
  z.array(Position),
  loose({ results: z.array(Position) }),
]);
export type PositionList = z.infer<typeof PositionList>;

export const positionsOf = (list: PositionList): Position[] =>
  Array.isArray(list) ? list : list.results;

// ── Attribution ─────────────────────────────────────────────────────────────

/**
 * The traction number judges can verify independently. PRD.md X4 forbids
 * reporting anything not confirmed here, so this response is the only
 * acceptable source for a volume figure.
 */
export const TradeReportResponse = loose({
  signature: z.string().optional(),
  status: z.string().optional(),
  attributed: z.boolean().optional(),
  volume: z.string().optional(),
});
export type TradeReportResponse = z.infer<typeof TradeReportResponse>;
