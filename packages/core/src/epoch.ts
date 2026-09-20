/**
 * Epoch identity and slot ranges.
 *
 * Everything here is pure and deterministic on purpose. A stranger holding only
 * these constants and an RPC endpoint must be able to derive the same epoch
 * boundaries we did — that is the ARCHITECTURE.md §3 invariant, and it is the
 * reason the whole product is infrastructure rather than a trust product.
 */

/** Monday 2026-09-21 00:00:00 UTC. Published; never changes once markets exist. */
export const EPOCH_GENESIS_MS = Date.UTC(2026, 8, 21, 0, 0, 0, 0);

export const EPOCH_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Slots per epoch, published as a constant rather than derived from wall clock.
 *
 * Solana slot time drifts (roughly 400-460ms in practice), so an end slot
 * derived from a timestamp is ambiguous exactly at the boundary where it matters
 * most, and resolving that ambiguity after the fact is the adjustment PRD.md X2
 * forbids. A fixed slot count is unambiguous: the epoch may close a few hours
 * either side of seven days, and every observer computes the same boundary.
 *
 * 604_800s / 0.42s ≈ 1_440_000. Slightly early beats late — we need resolutions
 * to land inside the judging window.
 */
export const SLOTS_PER_EPOCH = 1_440_000;

export type RiskClass = "liquidation" | "utilization";

export interface Epoch {
  /** Sequential from genesis. Epoch 0 opens at EPOCH_GENESIS_MS. */
  readonly index: number;
  /** Scheduled open, inclusive. */
  readonly startsAt: Date;
  /** Scheduled close, exclusive. Scheduling only — settlement uses slots. */
  readonly endsAt: Date;
  /** Human label for UI and evidence bundles, e.g. "E3 · 12 Oct 2026". */
  readonly label: string;
}

/** Fixed slot window an epoch settles over. Written at market open, never recomputed. */
export interface SlotRange {
  readonly startSlot: number;
  readonly endSlot: number;
}

const MS_TO_INDEX = (ms: number): number =>
  Math.floor((ms - EPOCH_GENESIS_MS) / EPOCH_DURATION_MS);

/**
 * Epoch index containing `at`. Negative before genesis — callers that must not
 * operate pre-genesis should guard on it rather than have it silently clamp.
 */
export function epochIndexAt(at: Date = new Date()): number {
  return MS_TO_INDEX(at.getTime());
}

export function epochByIndex(index: number): Epoch {
  if (!Number.isInteger(index)) {
    throw new TypeError(`epoch index must be an integer, got ${index}`);
  }
  const startMs = EPOCH_GENESIS_MS + index * EPOCH_DURATION_MS;
  const startsAt = new Date(startMs);
  const day = startsAt.getUTCDate();
  const month = startsAt.toLocaleString("en-GB", { month: "short", timeZone: "UTC" });
  const year = startsAt.getUTCFullYear();
  return {
    index,
    startsAt,
    endsAt: new Date(startMs + EPOCH_DURATION_MS),
    label: `E${index} · ${day} ${month} ${year}`,
  };
}

export function epochAt(at: Date = new Date()): Epoch {
  return epochByIndex(epochIndexAt(at));
}

/**
 * Every epoch that should exist at `at`, from `fromIndex` forward.
 *
 * This is what catch-up-on-boot diffs against Panta's GET /markets/. The factory
 * holds no authoritative local state, so after a crash this function plus the
 * live market list is enough to reconstruct exactly what was missed.
 */
export function epochsThrough(at: Date = new Date(), fromIndex = 0): Epoch[] {
  const current = epochIndexAt(at);
  if (current < fromIndex) return [];
  const out: Epoch[] = [];
  for (let i = fromIndex; i <= current; i++) out.push(epochByIndex(i));
  return out;
}

/**
 * Settlement window for an epoch opened at `startSlot`.
 *
 * `startSlot` is observed on chain at market open and persisted immediately.
 * The resolver reads the stored range; it never derives one, because a derived
 * range could differ from the published one and that is the X2 violation.
 */
export function slotRangeFrom(startSlot: number): SlotRange {
  if (!Number.isInteger(startSlot) || startSlot < 0) {
    throw new RangeError(`startSlot must be a non-negative integer, got ${startSlot}`);
  }
  return { startSlot, endSlot: startSlot + SLOTS_PER_EPOCH };
}

/**
 * Deterministic market identifier per (protocol, risk class, epoch).
 *
 * Creating the same market twice must be a no-op (PRD.md B2), so identity has to
 * be derivable rather than stored — a retry after a crash mid-creation has no
 * local record to consult, only this function.
 */
export function marketSlug(
  protocol: string,
  riskClass: RiskClass,
  epochIndex: number,
): string {
  const proto = protocol.trim().toLowerCase();
  if (!/^[a-z0-9-]+$/.test(proto)) {
    throw new TypeError(`protocol must be lowercase alphanumeric, got "${protocol}"`);
  }
  if (!Number.isInteger(epochIndex) || epochIndex < 0) {
    throw new RangeError(`epochIndex must be a non-negative integer, got ${epochIndex}`);
  }
  return `${proto}-${riskClass}-e${epochIndex}`;
}
