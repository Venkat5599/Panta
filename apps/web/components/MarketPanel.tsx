"use client";

import { useState } from "react";

/**
 * The product, as a real working control.
 *
 * A faux app window is a slop tell only when it is empty and generic. This one
 * computes actual numbers from actual input: change the side or the amount and
 * every figure below updates. Nothing here is a picture of a control.
 *
 * The submit button is honestly disabled, with a reason, because no market is
 * live yet. A control that invites a click it cannot answer is worse than one
 * that explains itself.
 */

type Side = "NO" | "YES";

const IMPLIED = 0.29; // illustrative; the live value comes from the curve
const PRESETS = [100, 500, 2_500] as const;

const usd = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function MarketPanel() {
  const [side, setSide] = useState<Side>("NO");
  const [amount, setAmount] = useState(500);

  // Bonding-curve shorthand: stake / price = shares, each paying 1 USDC if the
  // side wins. Panta's docs describe fills quoted on a bonding curve, so payout
  // is known at purchase rather than settled pro-rata.
  const price = side === "YES" ? IMPLIED : 1 - IMPLIED;
  const shares = amount / price;
  const payout = shares;
  const profit = payout - amount;
  const returnPct = (profit / amount) * 100;
  // Simple annualisation of a seven-day position, for comparison only.
  const apr = returnPct * (365 / 7);

  return (
    <div className="rounded-[1.75rem] bg-[#dfe2d5] p-1.5">
      <div className="edge lift rounded-[1.375rem] bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule px-6 py-4">
          <div className="text-[0.875rem] text-ink">
            Kamino · liquidation cascade
          </div>
          <div className="font-mono text-[0.75rem] text-muted">7 days remaining</div>
        </div>

        <div className="px-6 py-6 sm:px-7">
          {/* Two sides, differentiated by which is selected — not by pairing a
              filled button against an outlined ghost. */}
          <div
            role="group"
            aria-label="Choose a side"
            className="grid grid-cols-2 gap-1.5 rounded-[0.875rem] bg-[#e2e5da] p-1.5"
          >
            {(
              [
                { key: "NO", label: "Underwrite", sub: "a calm week" },
                { key: "YES", label: "Hedge", sub: "a cascade" },
              ] as const
            ).map((opt) => {
              const active = side === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setSide(opt.key)}
                  aria-pressed={active}
                  className={`rounded-[0.625rem] px-4 py-3 text-left transition-colors duration-400 ease-[var(--ease-spring)] ${
                    active
                      ? "bg-surface text-ink shadow-[0_1px_2px_rgb(17_19_15_/_0.06)]"
                      : "text-muted hover:text-ink-soft"
                  }`}
                >
                  <div className="text-[0.9375rem] font-medium">{opt.label}</div>
                  <div className="mt-0.5 text-[0.75rem] opacity-70">{opt.sub}</div>
                </button>
              );
            })}
          </div>

          <div className="mt-6">
            <label
              htmlFor="stake"
              className="block text-[0.8125rem] text-muted"
            >
              Amount
            </label>
            <div className="mt-2 flex items-center gap-2">
              <div className="edge flex flex-1 items-center rounded-[0.75rem] bg-paper px-4 py-3">
                <span className="mr-1 font-mono text-[1.125rem] text-muted">$</span>
                <input
                  id="stake"
                  type="number"
                  min={1}
                  step={1}
                  value={amount}
                  onChange={(e) =>
                    setAmount(Math.max(1, Number(e.target.value) || 0))
                  }
                  className="w-full bg-transparent font-mono text-[1.125rem] text-ink outline-none"
                />
                <span className="font-mono text-[0.8125rem] text-faint">USDC</span>
              </div>
              <div className="flex gap-1.5">
                {PRESETS.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setAmount(v)}
                    className={`rounded-[0.625rem] px-3 py-3 font-mono text-[0.8125rem] transition-colors duration-400 ease-[var(--ease-spring)] ${
                      amount === v
                        ? "bg-ink text-paper"
                        : "bg-[#e2e5da] text-muted hover:text-ink"
                    }`}
                  >
                    {v >= 1000 ? `${v / 1000}k` : v}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <dl className="mt-6 space-y-3 border-t border-rule pt-5 text-[0.875rem]">
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-muted">Price per share</dt>
              <dd className="font-mono text-ink">${price.toFixed(3)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-muted">Shares</dt>
              <dd className="font-mono text-ink">{shares.toFixed(2)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-muted">
                {side === "NO" ? "If the week stays calm" : "If the cascade happens"}
              </dt>
              <dd className="font-mono text-clay">${usd(payout)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-muted">Return</dt>
              <dd className="font-mono text-ink">
                +{returnPct.toFixed(1)}%
                <span className="ml-2 text-muted">{apr.toFixed(0)}% APR</span>
              </dd>
            </div>
          </dl>

          <button
            type="button"
            disabled
            className="mt-6 w-full cursor-not-allowed rounded-full bg-[#e2e5da] px-6 py-3.5 text-sm font-medium text-muted"
          >
            Opens with epoch 0
          </button>

          <p className="mt-3 text-[0.75rem] leading-relaxed text-faint">
            Parametric cover, not insurance. The payout follows a protocol-wide
            metric, not your individual loss, so it can pay when you were unharmed
            and pay nothing when you were liquidated.
          </p>
        </div>
      </div>
    </div>
  );
}
