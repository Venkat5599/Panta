"use client";

import { useRef, useState } from "react";
import { motion, useMotionValueEvent, useReducedMotion, useScroll } from "motion/react";
import { SETTLE } from "@/components/motion/primitives";

/**
 * The epoch lifecycle, as a pinned scroll-driven state machine.
 *
 * A week of this product has four states, and showing them as four separate
 * screenshots would lose the thing that matters: that it is ONE market moving
 * through them unattended. So the panel stays pinned and its internal state
 * changes as you scroll, and scrolling back reverses it.
 *
 * The safety property: every step's text is in the DOM at all times, and the
 * panel's own content for the active step renders server-side. Without JS the
 * section is a legible list of four steps beside a panel showing step one.
 * Nothing is gated on scroll, which is why the list is emphasised rather than
 * revealed.
 */

interface Step {
  key: string;
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    key: "open",
    title: "The factory opens the market",
    body: "One market per protocol per week, created on a cron with a slug derived from the epoch. The settlement window is frozen at this moment and published before anyone can trade it.",
  },
  {
    key: "trade",
    title: "Two sides take opposite views",
    body: "A borrower buys cover against a cascade. A yield-seeker underwrites a calm week and collects the premium. The curve prices both without needing a counterparty to appear first.",
  },
  {
    key: "settle",
    title: "The window closes and the metric is counted",
    body: "Liquidated collateral across the whole protocol, summed over the published slot range at finalized commitment. No adjudicator, no dispute over what counts.",
  },
  {
    key: "claim",
    title: "The outcome pays out on chain",
    body: "The evidence bundle publishes every contributing signature and the total, so anyone can recompute it. Winners claim against the resolved market.",
  },
];

const TOTAL = STEPS.length;

/** The panel's state for a given step. Real shapes, not lorem. */
function PanelBody({ index }: { index: number }) {
  const rows = [
    [
      ["slug", "kamino-liquidation-e0"],
      ["window", "301,450,000 → 302,890,000"],
      ["threshold", "$2,000,000"],
      ["state", "open"],
    ],
    [
      ["underwrite", "41.2% APR"],
      ["cover", "0.84% / 7 days"],
      ["implied", "29%"],
      ["state", "trading"],
    ],
    [
      ["counted", "1,284 liquidations"],
      ["total", "$1,740,220"],
      ["threshold", "$2,000,000"],
      ["state", "settling"],
    ],
    [
      ["outcome", "NO"],
      ["total", "$1,740,220"],
      ["signatures", "1,284 published"],
      ["state", "resolved"],
    ],
  ][index]!;

  return (
    <dl className="space-y-3.5 font-mono text-[0.8125rem] sm:text-[0.875rem]">
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-baseline justify-between gap-6">
          <dt className="text-muted">{k}</dt>
          <dd className="text-right text-ink">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function EpochNarrative() {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const [active, setActive] = useState(0);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });

  useMotionValueEvent(scrollYProgress, "change", (p) => {
    // Direction-aware by construction: scrolling back lowers the index, so the
    // sequence reverses naturally rather than replaying an entrance.
    const next = Math.min(TOTAL - 1, Math.max(0, Math.floor(p * TOTAL)));
    setActive(next);
  });

  return (
    <section
      ref={ref}
      // Tall enough to pin for a real beat, but every step is reachable by
      // keyboard and readable without scrolling at all.
      className="relative mx-auto max-w-6xl px-5 sm:px-8 lg:h-[320vh]"
    >
      <div className="lg:sticky lg:top-24 lg:flex lg:h-[calc(100vh-8rem)] lg:items-center">
        <div className="grid w-full gap-12 py-20 lg:grid-cols-12 lg:gap-16 lg:py-0">
          <div className="lg:col-span-6">
            <h2 className="text-[1.875rem] leading-tight font-semibold tracking-[-0.025em] text-ink sm:text-[2.25rem]">
              One market, four states, nobody driving.
            </h2>

            <ol className="mt-10 space-y-7">
              {STEPS.map((step, i) => {
                const on = i === active;
                return (
                  <li key={step.key} className="flex gap-4">
                    <span
                      className={`mt-[0.35rem] font-mono text-[0.75rem] tabular-nums transition-colors duration-500 ${
                        on ? "text-clay" : "text-faint"
                      }`}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <h3
                        className={`text-[1.0625rem] font-medium transition-colors duration-500 ${
                          on ? "text-ink" : "text-muted"
                        }`}
                      >
                        {step.title}
                      </h3>
                      {/* Always rendered. Emphasis changes; presence never does. */}
                      <p
                        className={`mt-1.5 max-w-md text-[0.9375rem] leading-relaxed transition-colors duration-500 ${
                          on ? "text-ink-soft" : "text-muted/70"
                        }`}
                      >
                        {step.body}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>

          <div className="lg:col-span-6">
            <div className="rounded-[1.75rem] bg-[#dfe2d5] p-1.5">
              <div className="edge lift rounded-[1.375rem] bg-surface">
                <div className="flex items-center justify-between border-b border-rule px-6 py-4">
                  <span className="text-[0.875rem] text-ink">Epoch 0</span>
                  <span className="font-mono text-[0.75rem] text-muted">
                    {STEPS[active]!.key}
                  </span>
                </div>

                <div className="px-6 py-7">
                  <motion.div
                    key={active}
                    // Transform only. The panel's content is present the
                    // instant it mounts; this moves it, never reveals it.
                    initial={reduced ? false : { y: 10 }}
                    animate={{ y: 0 }}
                    transition={{ type: "spring", ...SETTLE }}
                  >
                    <PanelBody index={active} />
                  </motion.div>

                  {/* Progress across the four states, as a real measure. */}
                  <div className="mt-8 flex gap-1.5">
                    {STEPS.map((s, i) => (
                      <span
                        key={s.key}
                        className={`h-[3px] flex-1 rounded-full transition-colors duration-500 ${
                          i <= active ? "bg-clay" : "bg-rule"
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <p className="mt-4 text-[0.8125rem] leading-relaxed text-muted">
              Illustrative figures for a completed week. No epoch has settled yet.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
