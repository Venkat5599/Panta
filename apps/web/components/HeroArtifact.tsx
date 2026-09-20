"use client";

import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { RiskCurve } from "@/components/RiskCurve";
import type { RiskPoint } from "@/components/riskSeries";
import { useCountTo, usePointerDepth } from "@/components/motion/primitives";

/**
 * Hero artifact: the live curve, with depth.
 *
 * Composes three things rather than stacking effects for their own sake:
 * pointer-driven depth on two layers at different strengths, a number that
 * settles rather than spins up, and a quiet scroll-linked drift.
 *
 * The curve here is NOT scroll-scrubbed. It is above the fold at load, so
 * scrubbing it would mean the first thing a visitor sees is a half-drawn line
 * pretending to be a price. The scrub lives further down the page, where an
 * element genuinely enters from below.
 */

interface Props {
  startSlot: number;
  endSlot: number;
  currentSlot: number;
  series: RiskPoint[];
  epochLabel: string;
}

export function HeroArtifact({
  startSlot,
  endSlot,
  currentSlot,
  series,
  epochLabel,
}: Props) {
  const reduced = useReducedMotion();
  const wrap = useRef<HTMLDivElement>(null);

  // Foreground tilts more than the panel behind it; equal movement reads as a
  // tilting sticker rather than as depth.
  const depth = usePointerDepth(1);

  const { scrollYProgress } = useScroll({
    target: wrap,
    offset: ["start start", "end start"],
  });
  // Multi-layer parallax: a small, bounded drift as the hero leaves.
  const drift = useTransform(scrollYProgress, [0, 1], [0, reduced ? 0 : -26]);

  const implied = useCountTo(29, 0);
  const premium = useCountTo(0.84, 2);

  return (
    <div ref={wrap}>
      <motion.div
        ref={depth.ref}
        style={{
          y: drift,
          rotateX: depth.enabled ? depth.rotateX : 0,
          rotateY: depth.enabled ? depth.rotateY : 0,
          transformPerspective: 1400,
        }}
        className="rounded-[1.75rem] bg-[#dfe2d5] p-1.5 will-change-transform"
      >
        <div className="edge lift rounded-[1.375rem] bg-surface p-5 sm:p-7">
          <motion.div
            style={{ x: depth.enabled ? depth.shiftX : 0, y: depth.enabled ? depth.shiftY : 0 }}
            className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2"
          >
            <div>
              <div className="text-[0.8125rem] text-muted">
                Kamino · liquidation cascade
              </div>
              <div className="mt-1.5 flex items-baseline gap-2.5">
                {/* Renders the real figure server-side; the count only settles it. */}
                <span className="font-mono text-[2.75rem] leading-none tracking-tight text-ink">
                  {implied}
                  <span className="text-[1.5rem] text-muted">%</span>
                </span>
                <span className="text-[0.8125rem] text-muted">implied, {epochLabel}</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[0.8125rem] text-muted">Cover 7 days</div>
              <div className="mt-1.5 font-mono text-[1.375rem] text-clay">{premium}%</div>
            </div>
          </motion.div>

          <div className="mt-6">
            <RiskCurve
              protocol="Kamino"
              startSlot={startSlot}
              endSlot={endSlot}
              currentSlot={currentSlot}
              thresholdUsd="2,000,000"
              series={series}
            />
          </div>

          <p className="mt-2 text-[0.75rem] leading-relaxed text-faint">
            Illustrative shape. No market has opened yet. The first epoch
            publishes its methodology before it accepts a trade.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
