import { describe, expect, test } from "bun:test";
import {
  type BaseUnits,
  addBaseUnits,
  baseUnitsToDecimal,
  baseUnitsValue,
  decimalToBaseUnits,
  formatUsdc,
  parseBaseUnits,
  parseDecimal,
  toBaseUnits,
  toDecimal,
} from "./amounts.ts";

/**
 * Widen a branded amount to a plain string.
 *
 * The brands are strict enough that `expect(toBaseUnits(50)).toBe("50000000")`
 * does not compile — `toBe` resolves its expected type from the actual. That
 * strictness is the point, so widen explicitly here rather than loosening it.
 */
const s = (v: string): string => v;

describe("toBaseUnits", () => {
  test("scales whole USDC by 10^6", () => {
    expect(s(toBaseUnits(50))).toBe("50000000");
    expect(s(toBaseUnits(0))).toBe("0");
    expect(s(toBaseUnits(1))).toBe("1000000");
  });

  test("handles the float trap exactly", () => {
    // 50.1 * 1e6 === 50099999.99999999 in IEEE-754. Must not truncate to 50099999.
    expect(s(toBaseUnits(50.1))).toBe("50100000");
    expect(s(toBaseUnits("50.1"))).toBe("50100000");
    expect(s(toBaseUnits(0.07))).toBe("70000");
    expect(s(toBaseUnits(1.005))).toBe("1005000");
  });

  test("keeps full precision at six decimals", () => {
    expect(s(toBaseUnits("0.000001"))).toBe("1");
    expect(s(toBaseUnits("123.456789"))).toBe("123456789");
  });

  test("survives amounts beyond float integer safety", () => {
    // 10^10 USDC is 10^16 base units, past Number.MAX_SAFE_INTEGER (~9.007e15).
    expect(s(toBaseUnits("10000000000"))).toBe("10000000000000000");
  });

  test("rejects more precision than USDC can hold rather than truncating", () => {
    expect(() => toBaseUnits("1.0000001")).toThrow(RangeError);
  });

  test("rejects negatives, junk and exponent notation", () => {
    expect(() => toBaseUnits(-1)).toThrow(RangeError);
    expect(() => toBaseUnits("abc")).toThrow(TypeError);
    expect(() => toBaseUnits("1e6")).toThrow(TypeError);
    expect(() => toBaseUnits(Number.NaN)).toThrow(TypeError);
    expect(() => toBaseUnits(Number.POSITIVE_INFINITY)).toThrow(TypeError);
  });
});

describe("toDecimal", () => {
  test("emits a fixed six-place decimal string", () => {
    expect(s(toDecimal(20))).toBe("20.000000");
    expect(s(toDecimal("0.5"))).toBe("0.500000");
  });

  test("is exact at the float trap", () => {
    expect(s(toDecimal(50.1))).toBe("50.100000");
  });
});

describe("round-tripping", () => {
  test("base units to decimal and back is lossless", () => {
    for (const v of ["0", "1", "70000", "50100000", "123456789"]) {
      const units = parseBaseUnits(v);
      expect(s(decimalToBaseUnits(baseUnitsToDecimal(units)))).toBe(s(units));
    }
  });

  test("the two encodings describe the same money", () => {
    expect(s(decimalToBaseUnits(toDecimal(50.1)))).toBe(s(toBaseUnits(50.1)));
  });
});

describe("parseBaseUnits", () => {
  test("normalises leading zeros so equal amounts compare equal", () => {
    expect(s(parseBaseUnits("0050000000"))).toBe(s(parseBaseUnits("50000000")));
  });

  test("rejects a decimal string — the exact confusion this guards", () => {
    expect(() => parseBaseUnits("20.00")).toThrow(TypeError);
  });
});

describe("parseDecimal", () => {
  test("accepts an API decimal string", () => {
    expect(s(parseDecimal("20.00"))).toBe("20.000000");
  });
});

describe("addBaseUnits", () => {
  test("is exact past float safety", () => {
    const big = parseBaseUnits("9007199254740993"); // MAX_SAFE_INTEGER + 2
    expect(s(addBaseUnits(big, parseBaseUnits("1")))).toBe("9007199254740994");
  });

  test("sums an empty list to zero", () => {
    expect(s(addBaseUnits())).toBe("0");
  });
});

describe("baseUnitsValue", () => {
  test("exposes bigint for comparison", () => {
    expect(baseUnitsValue(toBaseUnits(2)) > baseUnitsValue(toBaseUnits(1))).toBe(true);
  });
});

describe("formatUsdc", () => {
  test("renders for humans at two places", () => {
    expect(formatUsdc(toBaseUnits(1234.5))).toBe("1,234.50 USDC");
  });
});

describe("brand separation", () => {
  test("a raw string is not assignable to BaseUnits", () => {
    // @ts-expect-error raw strings must go through toBaseUnits/parseBaseUnits
    const bad: BaseUnits = "50000000";
    expect(typeof bad).toBe("string");
  });

  test("a DecimalAmount is not assignable to BaseUnits", () => {
    // @ts-expect-error this is the 1,000,000x bug, caught at compile time
    const bad: BaseUnits = toDecimal(20);
    expect(typeof bad).toBe("string");
  });
});
