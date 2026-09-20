"use client";

import { useEffect, useRef, useState } from "react";
import {
  type MotionValue,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "motion/react";

/**
 * Motion primitives.
 *
 * One rule governs everything in this file, and it is not negotiable:
 * CONTENT IS VISIBLE BY DEFAULT. Nothing here animates opacity up from zero,
 * and nothing gates the existence of text or a control on an animation
 * completing. A reveal that does not fire — backgrounded tab, throttled engine,
 * hydration hiccup, screenshot pass, reduced-motion, no JS at all — must leave
 * a page that reads completely.
 *
 * So these animate transform and filter on elements that are already on screen.
 * The worst case is a static, fully legible page, which is the correct worst
 * case for a product where someone signs a USDC transaction.
 */

/** Spring with a small overshoot. Real objects settle past their target. */
export const SETTLE = { stiffness: 220, damping: 26, mass: 0.7 } as const;
/** Heavier, for large surfaces that should feel like they carry weight. */
export const GLIDE = { stiffness: 120, damping: 30, mass: 1 } as const;

/**
 * Cursor-driven depth.
 *
 * Returns rotation and offset motion values that follow the pointer across the
 * referenced element. Strength is per-layer so foreground and background can
 * move at different rates, which is what actually reads as depth rather than
 * as a tilting sticker.
 */
export function usePointerDepth(strength = 1) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  const px = useMotionValue(0);
  const py = useMotionValue(0);

  const rotateX = useSpring(useTransform(py, [-0.5, 0.5], [2.2 * strength, -2.2 * strength]), GLIDE);
  const rotateY = useSpring(useTransform(px, [-0.5, 0.5], [-2.8 * strength, 2.8 * strength]), GLIDE);
  const shiftX = useSpring(useTransform(px, [-0.5, 0.5], [-6 * strength, 6 * strength]), GLIDE);
  const shiftY = useSpring(useTransform(py, [-0.5, 0.5], [-4 * strength, 4 * strength]), GLIDE);

  useEffect(() => {
    const node = ref.current;
    // A pointer-driven effect is meaningless on touch and unwanted under
    // reduced-motion, so it simply never attaches.
    if (!node || reduced) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    const onMove = (event: PointerEvent) => {
      const box = node.getBoundingClientRect();
      px.set((event.clientX - box.left) / box.width - 0.5);
      py.set((event.clientY - box.top) / box.height - 0.5);
    };
    const onLeave = () => {
      px.set(0);
      py.set(0);
    };

    node.addEventListener("pointermove", onMove);
    node.addEventListener("pointerleave", onLeave);
    return () => {
      node.removeEventListener("pointermove", onMove);
      node.removeEventListener("pointerleave", onLeave);
    };
  }, [px, py, reduced]);

  return { ref, rotateX, rotateY, shiftX, shiftY, enabled: !reduced };
}

/**
 * Number morphing.
 *
 * Critically, it renders the FINAL value on the server and on first paint, then
 * animates from a nearby value only once mounted. Counting up from zero as the
 * default would mean a stalled animation leaves "0%" on screen where a real
 * price belongs, and on this product that is a number someone might act on.
 */
export function useCountTo(target: number, decimals = 0): string {
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(target);

  useEffect(() => {
    if (reduced) {
      setDisplay(target);
      return;
    }
    // Start close to the target, not at zero: this reads as a value settling,
    // which is what a live price does, rather than as a counter spinning up.
    const from = target * 0.82;
    const duration = 900;
    const started = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const t = Math.min(1, (now - started) / duration);
      // easeOutQuint
      const eased = 1 - (1 - t) ** 5;
      setDisplay(from + (target - from) * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, reduced]);

  return display.toFixed(decimals);
}

/**
 * Scroll velocity, normalised to roughly [-1, 1].
 *
 * Used to intensify motion when someone scrolls hard and leave it calm when
 * they read. Clamped, because an unbounded velocity term turns a flick into a
 * lurch.
 */
export function useScrollIntensity(velocity: MotionValue<number>) {
  return useSpring(
    useTransform(velocity, [-2500, 0, 2500], [1, 0, 1], { clamp: true }),
    { stiffness: 90, damping: 24 },
  );
}
