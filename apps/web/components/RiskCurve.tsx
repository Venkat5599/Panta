"use client";

import { type MotionValue, motion, useMotionValue } from "motion/react";

/**
 * The signature artifact.
 *
 * A live market-implied probability curve for one protocol over one epoch.
 * This is the thing PREMIUM makes that did not exist before — a continuously
 * priced, public number for "will this protocol suffer a loss event" — so it
 * carries the page rather than a stock illustration or a faked app window.
 *
 * Everything here is drawn from real market shape: the plotted series is the
 * curve's price history, the window is the published slot range, and the
 * threshold is the question's actual number. Nothing is decorative.
 */

import type { RiskPoint } from "@/components/riskSeries";

export type { RiskPoint };

export interface RiskCurveProps {
  protocol: string;
  startSlot: number;
  endSlot: number;
  currentSlot: number;
  thresholdUsd: string;
  series: RiskPoint[];
  className?: string;
  /**
   * Optional 0..1 draw progress. When omitted the curve renders FULLY drawn,
   * which is what the server emits and what a no-JS or reduced-motion visitor
   * sees. Scrubbing is strictly additive; it can never hide the data.
   */
  progress?: MotionValue<number>;
}

const W = 720;
const H = 300;
const PAD = { top: 28, right: 30, bottom: 44, left: 52 };
/** Size of the chamfer on the plot's bottom-right corner. */
const CHAMFER = 26;

/** Catmull-Rom to cubic bezier: a smooth curve through every real data point. */
function smoothPath(points: Array<[number, number]>): string {
  if (points.length < 2) return "";
  const [first, ...rest] = points;
  let d = `M ${first![0].toFixed(2)} ${first![1].toFixed(2)}`;
  for (let i = 0; i < rest.length; i++) {
    const p0 = points[Math.max(0, i - 1)]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[Math.min(points.length - 1, i + 2)]!;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`;
  }
  return d;
}

export function RiskCurve({
  protocol,
  startSlot,
  endSlot,
  currentSlot,
  thresholdUsd,
  series,
  className = "",
  progress,
}: RiskCurveProps) {
  // Default of 1 means "complete". A missing or stalled scroll driver leaves
  // the curve drawn, never blank.
  const fallback = useMotionValue(1);
  const draw = progress ?? fallback;
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const x = (slot: number) =>
    PAD.left + ((slot - startSlot) / (endSlot - startSlot)) * plotW;
  const y = (p: number) => PAD.top + (1 - p) * plotH;

  const points = series.map((d) => [x(d.slot), y(d.p)] as [number, number]);
  const line = smoothPath(points);
  const last = series.at(-1);
  const nowX = x(currentSlot);

  // Chamfered plot frame — one bespoke silhouette rather than another rectangle.
  const frame = [
    `M ${PAD.left} ${PAD.top}`,
    `L ${PAD.left + plotW} ${PAD.top}`,
    `L ${PAD.left + plotW} ${PAD.top + plotH - CHAMFER}`,
    `L ${PAD.left + plotW - CHAMFER} ${PAD.top + plotH}`,
    `L ${PAD.left} ${PAD.top + plotH}`,
    "Z",
  ].join(" ");

  const areaPath = line
    ? `${line} L ${points.at(-1)![0].toFixed(2)} ${PAD.top + plotH} L ${points[0]![0].toFixed(2)} ${PAD.top + plotH} Z`
    : "";

  return (
    <figure className={`m-0 ${className}`}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        role="img"
        aria-label={`Market-implied probability that ${protocol} liquidates more than $${thresholdUsd} this epoch. Currently ${last ? Math.round(last.p * 100) : 0} percent.`}
      >
        <defs>
          {/* Area fill: a tonal wash off the accent, not a saturated gradient. */}
          <linearGradient id="rc-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-clay)" stopOpacity="0.14" />
            <stop offset="100%" stopColor="var(--color-clay)" stopOpacity="0.01" />
          </linearGradient>
          {/* Clip the wash to the chamfered frame so nothing bleeds past the cut. */}
          <clipPath id="rc-clip">
            <path d={frame} />
          </clipPath>
        </defs>

        {/* Horizontal references only. A full grid would be graph paper. */}
        {[0.25, 0.5, 0.75].map((t) => (
          <line
            key={t}
            x1={PAD.left}
            x2={PAD.left + plotW}
            y1={y(t)}
            y2={y(t)}
            stroke="var(--color-rule)"
            strokeWidth="1"
          />
        ))}

        {[0, 0.5, 1].map((t) => (
          <text
            key={t}
            x={PAD.left - 12}
            y={y(t) + 4}
            textAnchor="end"
            className="fill-[var(--color-faint)]"
            style={{ fontSize: 11, fontFamily: "var(--font-mono)" }}
          >
            {Math.round(t * 100)}%
          </text>
        ))}

        <g clipPath="url(#rc-clip)">
          {areaPath ? <path d={areaPath} fill="url(#rc-area)" /> : null}
          {line ? (
            <motion.path
              d={line}
              fill="none"
              stroke="var(--color-clay)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ pathLength: draw }}
            />
          ) : null}
        </g>

        <path d={frame} fill="none" stroke="var(--color-rule)" strokeWidth="1" />

        {/* "Now" marker. Rounded caps — a bare square-capped rule reads as cheap. */}
        <line
          x1={nowX}
          x2={nowX}
          y1={PAD.top}
          y2={PAD.top + plotH}
          stroke="var(--color-ink)"
          strokeWidth="1"
          strokeDasharray="2 5"
          strokeLinecap="round"
          opacity="0.35"
        />

        {last ? (
          <g>
            <circle cx={x(last.slot)} cy={y(last.p)} r="4.5" fill="var(--color-clay)" />
            <circle
              cx={x(last.slot)}
              cy={y(last.p)}
              r="4.5"
              fill="none"
              stroke="var(--color-surface)"
              strokeWidth="1.5"
            />
          </g>
        ) : null}

        {/* Axis labels sit BELOW the frame, clear of the chamfer by more than it cuts. */}
        <text
          x={PAD.left}
          y={H - 14}
          className="fill-[var(--color-faint)]"
          style={{ fontSize: 11, fontFamily: "var(--font-mono)" }}
        >
          slot {startSlot.toLocaleString("en-US")}
        </text>
        <text
          x={PAD.left + plotW}
          y={H - 14}
          textAnchor="end"
          className="fill-[var(--color-faint)]"
          style={{ fontSize: 11, fontFamily: "var(--font-mono)" }}
        >
          slot {endSlot.toLocaleString("en-US")}
        </text>
      </svg>

      <figcaption className="sr-only">
        Implied probability of a liquidation cascade on {protocol} exceeding $
        {thresholdUsd} within the published slot window.
      </figcaption>
    </figure>
  );
}

