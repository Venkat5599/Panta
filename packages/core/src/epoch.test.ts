import { describe, expect, test } from "bun:test";
import {
  EPOCH_DURATION_MS,
  EPOCH_GENESIS_MS,
  SLOTS_PER_EPOCH,
  epochAt,
  epochByIndex,
  epochIndexAt,
  epochStatus,
  epochsThrough,
  marketSlug,
  slotRangeFrom,
} from "./epoch.ts";

const at = (ms: number) => new Date(ms);

describe("epoch genesis", () => {
  test("genesis is a Monday, 00:00 UTC", () => {
    const g = new Date(EPOCH_GENESIS_MS);
    expect(g.getUTCDay()).toBe(1);
    expect(g.getUTCHours()).toBe(0);
    expect(g.getUTCMinutes()).toBe(0);
    expect(g.getUTCSeconds()).toBe(0);
    expect(g.getUTCMilliseconds()).toBe(0);
  });
});

describe("epochIndexAt", () => {
  test("genesis instant is epoch 0", () => {
    expect(epochIndexAt(at(EPOCH_GENESIS_MS))).toBe(0);
  });

  test("last millisecond of epoch 0 is still epoch 0", () => {
    expect(epochIndexAt(at(EPOCH_GENESIS_MS + EPOCH_DURATION_MS - 1))).toBe(0);
  });

  test("boundary instant belongs to the next epoch, not the previous", () => {
    expect(epochIndexAt(at(EPOCH_GENESIS_MS + EPOCH_DURATION_MS))).toBe(1);
  });

  test("is negative before genesis rather than clamping to zero", () => {
    // Silent clamping would make the factory create epoch 0 markets forever if
    // the clock were wrong. Negative forces callers to guard explicitly.
    expect(epochIndexAt(at(EPOCH_GENESIS_MS - 1))).toBe(-1);
  });
});

describe("epochByIndex", () => {
  test("boundaries are contiguous with no gap or overlap", () => {
    const a = epochByIndex(4);
    const b = epochByIndex(5);
    expect(a.endsAt.getTime()).toBe(b.startsAt.getTime());
  });

  test("every epoch starts on a Monday", () => {
    for (let i = 0; i < 12; i++) {
      expect(epochByIndex(i).startsAt.getUTCDay()).toBe(1);
    }
  });

  test("round-trips through epochIndexAt", () => {
    for (const i of [0, 1, 7, 52]) {
      expect(epochIndexAt(epochByIndex(i).startsAt)).toBe(i);
    }
  });

  test("rejects a non-integer index", () => {
    expect(() => epochByIndex(1.5)).toThrow(TypeError);
  });
});

describe("epochsThrough — catch-up on boot", () => {
  test("lists every epoch up to and including the current one", () => {
    const now = at(EPOCH_GENESIS_MS + 3 * EPOCH_DURATION_MS + 60_000);
    expect(epochsThrough(now).map((e) => e.index)).toEqual([0, 1, 2, 3]);
  });

  test("resumes from a high-water mark", () => {
    const now = at(EPOCH_GENESIS_MS + 3 * EPOCH_DURATION_MS);
    expect(epochsThrough(now, 2).map((e) => e.index)).toEqual([2, 3]);
  });

  test("is empty before genesis rather than throwing", () => {
    // A boot with a skewed clock should log and idle, not crash-loop.
    expect(epochsThrough(at(EPOCH_GENESIS_MS - 1))).toEqual([]);
  });

  test("is empty when already caught up", () => {
    const now = at(EPOCH_GENESIS_MS + EPOCH_DURATION_MS);
    expect(epochsThrough(now, 5)).toEqual([]);
  });
});

describe("slotRangeFrom", () => {
  test("window is exactly SLOTS_PER_EPOCH wide", () => {
    const r = slotRangeFrom(300_000_000);
    expect(r.endSlot - r.startSlot).toBe(SLOTS_PER_EPOCH);
  });

  test("is pure — same input always yields the same window", () => {
    expect(slotRangeFrom(123_456)).toEqual(slotRangeFrom(123_456));
  });

  test("rejects negative and non-integer slots", () => {
    expect(() => slotRangeFrom(-1)).toThrow(RangeError);
    expect(() => slotRangeFrom(1.5)).toThrow(RangeError);
  });
});

describe("marketSlug — idempotency key (PRD B2)", () => {
  test("is stable across calls", () => {
    expect(marketSlug("kamino", "liquidation", 3)).toBe(
      marketSlug("kamino", "liquidation", 3),
    );
  });

  test("normalises case and surrounding whitespace", () => {
    expect(marketSlug("  Kamino ", "liquidation", 3)).toBe("kamino-liquidation-e3");
  });

  test("distinguishes protocol, risk class and epoch", () => {
    const slugs = new Set([
      marketSlug("kamino", "liquidation", 3),
      marketSlug("drift", "liquidation", 3),
      marketSlug("kamino", "utilization", 3),
      marketSlug("kamino", "liquidation", 4),
    ]);
    expect(slugs.size).toBe(4);
  });

  test("rejects a protocol name that would break slug uniqueness", () => {
    expect(() => marketSlug("kamino lend", "liquidation", 1)).toThrow(TypeError);
    expect(() => marketSlug("kamino/lend", "liquidation", 1)).toThrow(TypeError);
  });

  test("rejects a negative epoch index", () => {
    expect(() => marketSlug("kamino", "liquidation", -1)).toThrow(RangeError);
  });
});

describe("epochAt", () => {
  test("agrees with epochByIndex + epochIndexAt", () => {
    const now = at(EPOCH_GENESIS_MS + 2 * EPOCH_DURATION_MS + 5_000);
    expect(epochAt(now)).toEqual(epochByIndex(epochIndexAt(now)));
  });
});

describe("epochStatus — display safety", () => {
  test("reports pre-genesis and shows epoch 0 rather than a negative index", () => {
    // A negative index renders as "E-1" and yields a slug marketSlug rejects.
    const s = epochStatus(at(EPOCH_GENESIS_MS - 1));
    expect(s.preGenesis).toBe(true);
    expect(s.epoch.index).toBe(0);
  });

  test("reports the live epoch once genesis has passed", () => {
    const s = epochStatus(at(EPOCH_GENESIS_MS + 2 * EPOCH_DURATION_MS));
    expect(s.preGenesis).toBe(false);
    expect(s.epoch.index).toBe(2);
  });

  test("never yields a negative index at any time", () => {
    for (const offset of [-1e12, -1, 0, 1, 5e9]) {
      expect(epochStatus(at(EPOCH_GENESIS_MS + offset)).epoch.index).toBeGreaterThanOrEqual(0);
    }
  });
});
