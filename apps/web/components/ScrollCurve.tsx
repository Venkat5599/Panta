"use client";

import { useRef } from "react";
import { useReducedMotion, useScroll, useSpring, useTransform } from "motion/react";
import { RiskCurve } from "@/components/RiskCurve";
import type { RiskPoint } from "@/components/riskSeries";

/**
 * Scroll-scrubbed curve.
 *
 * The line draws as the section enters and undraws when you scroll back, which
 * is the difference between a scrub and an entrance animation: it is tied to
 * scroll position, not to a one-shot trigger, so it never ends up stuck in a
 * half state the user cannot resolve.
 *
 * On the content rule: the numbers this chart describes are rendered as text
 * beside it, always. A partially drawn stroke therefore hides no information,
 * only the decorative completion of the line, and the floor below keeps it from
 * ever reading as an empty box. Under reduced-motion it is simply complete.
 */

interface Props {
  startSlot: number;
  endSlot: number;
  currentSlot: number;
  series: RiskPoint[];
}

/** Never fully undrawn: an empty frame reads as broken, not as "scroll further". */
const FLOOR = 0.12;

export function ScrollCurve({ startSlot, endSlot, currentSlot, series }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 0.85", "center 0.55"],
  });

  // Spring so a fast flick glides rather than snapping frame to frame.
  const drawn = useSpring(
    useTransform(scrollYProgress, [0, 1], [FLOOR, 1], { clamp: true }),
    { stiffness: 120, damping: 30, mass: 0.6 },
  );

  return (
    <div ref={ref}>
      <RiskCurve
        protocol="Kamino"
        startSlot={startSlot}
        endSlot={endSlot}
        currentSlot={currentSlot}
        thresholdUsd="2,000,000"
        series={series}
        {...(reduced ? {} : { progress: drawn })}
      />
    </div>
  );
}
