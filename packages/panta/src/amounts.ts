/**
 * USDC amount formats, separated at the type level.
 *
 * Panta takes two incompatible encodings for the same currency:
 *
 *   creation fees   integer string, base units   "50000000"  = 50 USDC
 *   primary buys    human decimal string          "20.00"     = 20 USDC
 *
 * ARCHITECTURE.md §7 calls mixing them "the most likely silent bug in the
 * integration", and it is a plausible one: both are strings, both look like
 * money, and passing the wrong one fails silently as a 1,000,000x error rather
 * than as an exception. So the two are distinct brands here and the client
 * accepts only the correct brand per field. Mixing them does not compile.
 *
 * All arithmetic runs on bigint base units. Float multiplication is not safe at
 * six decimals: 50.1 * 1e6 evaluates to 50099999.99999999, which truncates to a
 * cent short. Conversion is done by decimal-string manipulation instead.
 */

declare const brand: unique symbol;

/** Integer string in USDC base units. `"50000000"` is 50 USDC. */
export type BaseUnits = string & { readonly [brand]: "BaseUnits" };

/** Human-readable decimal string. `"20.00"` is 20 USDC. */
export type DecimalAmount = string & { readonly [brand]: "DecimalAmount" };

export const USDC_DECIMALS = 6;

const SCALE = 10n ** BigInt(USDC_DECIMALS);

/** Accepts `12`, `12.5`, `"12.500000"`. Rejects exponent form and junk. */
const DECIMAL_RE = /^-?\d+(\.\d+)?$/;

function normaliseInput(amount: number | string, label: string): string {
  if (typeof amount === "number") {
    if (!Number.isFinite(amount)) {
      throw new TypeError(`${label}: expected a finite number, got ${amount}`);
    }
    // toFixed avoids exponent notation, which DECIMAL_RE rejects, and caps at
    // the precision USDC can actually represent.
    return amount.toFixed(USDC_DECIMALS);
  }
  const trimmed = amount.trim();
  if (!DECIMAL_RE.test(trimmed)) {
    throw new TypeError(`${label}: expected a decimal amount, got "${amount}"`);
  }
  return trimmed;
}

/** Exact decimal string to bigint base units. No float anywhere on this path. */
function decimalStringToBigInt(decimal: string, label: string): bigint {
  const negative = decimal.startsWith("-");
  const unsigned = negative ? decimal.slice(1) : decimal;
  const [whole = "0", fraction = ""] = unsigned.split(".");

  if (fraction.length > USDC_DECIMALS) {
    // Truncating here would silently lose money. Make the caller round.
    throw new RangeError(
      `${label}: ${USDC_DECIMALS} decimal places maximum, got ${fraction.length} in "${decimal}"`,
    );
  }

  const padded = fraction.padEnd(USDC_DECIMALS, "0");
  const magnitude = BigInt(whole) * SCALE + BigInt(padded || "0");
  return negative ? -magnitude : magnitude;
}

function bigIntToDecimalString(units: bigint): string {
  const negative = units < 0n;
  const magnitude = negative ? -units : units;
  const whole = magnitude / SCALE;
  const fraction = (magnitude % SCALE).toString().padStart(USDC_DECIMALS, "0");
  return `${negative ? "-" : ""}${whole}.${fraction}`;
}

function assertNonNegative(units: bigint, label: string): void {
  if (units < 0n) {
    throw new RangeError(`${label}: amount must not be negative, got ${bigIntToDecimalString(units)}`);
  }
}

/**
 * Build base units from a USDC amount. `toBaseUnits(50)` is `"50000000"`.
 * Use for creation fees and anywhere Panta documents an integer string.
 */
export function toBaseUnits(amount: number | string): BaseUnits {
  const units = decimalStringToBigInt(normaliseInput(amount, "toBaseUnits"), "toBaseUnits");
  assertNonNegative(units, "toBaseUnits");
  return units.toString() as BaseUnits;
}

/**
 * Build a decimal amount from a USDC amount. `toDecimal(20)` is `"20.000000"`.
 * Use for primary buys and anywhere Panta documents a decimal string.
 */
export function toDecimal(amount: number | string): DecimalAmount {
  const units = decimalStringToBigInt(normaliseInput(amount, "toDecimal"), "toDecimal");
  assertNonNegative(units, "toDecimal");
  return bigIntToDecimalString(units) as DecimalAmount;
}

/**
 * Re-brand an integer string that is already in base units — an API response,
 * a database column. Validates rather than trusting the caller.
 */
export function parseBaseUnits(raw: string): BaseUnits {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) {
    throw new TypeError(`parseBaseUnits: expected an integer string, got "${raw}"`);
  }
  // Strip leading zeros so equal amounts compare equal as strings.
  return BigInt(trimmed).toString() as BaseUnits;
}

/** Re-brand a decimal string from an API response or database column. */
export function parseDecimal(raw: string): DecimalAmount {
  return toDecimal(raw);
}

/** Escape hatch into bigint for arithmetic and comparison. */
export const baseUnitsValue = (units: BaseUnits): bigint => BigInt(units);

/** Explicit, lossless conversion between the two encodings. */
export const baseUnitsToDecimal = (units: BaseUnits): DecimalAmount =>
  bigIntToDecimalString(BigInt(units)) as DecimalAmount;

export const decimalToBaseUnits = (amount: DecimalAmount): BaseUnits =>
  decimalStringToBigInt(amount, "decimalToBaseUnits").toString() as BaseUnits;

/** Exact addition in base units. Used to total seeded liquidity and fees. */
export function addBaseUnits(...amounts: BaseUnits[]): BaseUnits {
  return amounts
    .reduce((sum, a) => sum + BigInt(a), 0n)
    .toString() as BaseUnits;
}

/**
 * For display only. Never feed the result back into an API field — it is
 * rounded to two places and goes through Number, so it is lossy by design.
 */
export const formatUsdc = (units: BaseUnits): string =>
  `${Number(baseUnitsToDecimal(units)).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} USDC`;
