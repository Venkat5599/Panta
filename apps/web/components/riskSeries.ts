/**
 * Curve data, kept out of the client boundary.
 *
 * RiskCurve is a client component (it takes a MotionValue for scrubbing), and
 * a "use client" module cannot export a plain function for a server component
 * to call. So the pure data lives here, importable from either side.
 */

export interface RiskPoint {
  /** Slot at which this price was observed. */
  slot: number;
  /** Implied probability, 0..1. */
  p: number;
}

/**
 * Representative shape for an epoch with no trading history yet.
 *
 * Labelled at every call site as illustrative. Never presented as a real price:
 * publishing an invented number for a risk market would be the worst possible
 * thing this product could do.
 */
export function illustrativeSeries(startSlot: number, endSlot: number): RiskPoint[] {
  const shape = [0.11, 0.13, 0.12, 0.16, 0.22, 0.19, 0.17, 0.23, 0.31, 0.28, 0.26, 0.29];
  return shape.map((p, i) => ({
    slot: Math.round(startSlot + ((endSlot - startSlot) * i) / (shape.length - 1)),
    p,
  }));
}
