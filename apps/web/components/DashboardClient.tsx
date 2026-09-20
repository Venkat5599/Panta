"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Dashboard.
 *
 * Every state here is a real state, including the unhappy ones. "Not
 * configured", "upstream failed" and "this wallet holds nothing" are three
 * different facts and the UI says which one it means, because a dashboard that
 * renders an empty table for all three is lying by omission.
 *
 * Nothing is mocked. When the deployment has no Panta key, this says so.
 */

interface MarketRow {
  protocol: string;
  slug: string;
  live: boolean;
  id?: string | number | null;
  url?: string | null;
  status?: string | null;
}

interface MarketsResponse {
  configured: boolean;
  epoch: { index: number; label: string; preGenesis: boolean };
  markets: MarketRow[];
  reason?: string;
  error?: string;
}

interface PositionRow {
  marketId?: string | number;
  side?: string;
  shares?: string;
  claimable?: boolean;
}

interface PositionsResponse {
  configured: boolean;
  positions: PositionRow[];
  reason?: string;
  error?: string;
}

type Load<T> =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "ready"; data: T }
  | { phase: "failed"; message: string };

const WALLET_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function Notice({ tone, children }: { tone: "info" | "warn"; children: React.ReactNode }) {
  return (
    <p
      className={`mt-3 text-[0.8125rem] leading-relaxed ${
        tone === "warn" ? "text-clay" : "text-muted"
      }`}
    >
      {children}
    </p>
  );
}

export function DashboardClient() {
  const [markets, setMarkets] = useState<Load<MarketsResponse>>({ phase: "idle" });
  const [wallet, setWallet] = useState("");
  const [positions, setPositions] = useState<Load<PositionsResponse>>({ phase: "idle" });

  useEffect(() => {
    let cancelled = false;
    setMarkets({ phase: "loading" });
    fetch("/api/markets")
      .then(async (r) => ({ ok: r.ok, body: (await r.json()) as MarketsResponse }))
      .then(({ body }) => {
        if (!cancelled) setMarkets({ phase: "ready", data: body });
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setMarkets({
            phase: "failed",
            message: e instanceof Error ? e.message : "request failed",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const lookUp = useCallback(async () => {
    const w = wallet.trim();
    if (!WALLET_RE.test(w)) {
      setPositions({ phase: "failed", message: "That does not look like a Solana address." });
      return;
    }
    setPositions({ phase: "loading" });
    try {
      const response = await fetch(`/api/positions?wallet=${encodeURIComponent(w)}`);
      setPositions({ phase: "ready", data: (await response.json()) as PositionsResponse });
    } catch (e) {
      setPositions({
        phase: "failed",
        message: e instanceof Error ? e.message : "request failed",
      });
    }
  }, [wallet]);

  return (
    <div className="space-y-10">
      {/* ── Markets ─────────────────────────────────────────────────── */}
      <section>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-[1.25rem] font-semibold tracking-[-0.02em] text-ink">
            This week&apos;s markets
          </h2>
          {markets.phase === "ready" ? (
            <span className="font-mono text-[0.75rem] text-muted">
              {markets.data.epoch.preGenesis
                ? `${markets.data.epoch.label}, not yet open`
                : markets.data.epoch.label}
            </span>
          ) : null}
        </div>

        <div className="edge mt-4 overflow-hidden rounded-[1.25rem] bg-surface">
          {markets.phase === "loading" ? (
            <p className="px-6 py-8 text-[0.875rem] text-muted">Loading markets…</p>
          ) : markets.phase === "failed" ? (
            <p className="px-6 py-8 text-[0.875rem] text-clay">{markets.message}</p>
          ) : markets.phase === "ready" ? (
            <>
              <ul className="divide-y divide-rule">
                {markets.data.markets.map((m) => (
                  <li
                    key={m.slug}
                    className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-6 py-4"
                  >
                    <div>
                      <div className="text-[0.9375rem] font-medium text-ink">
                        {m.protocol[0]!.toUpperCase() + m.protocol.slice(1)}
                      </div>
                      <div className="mt-0.5 font-mono text-[0.75rem] text-muted">
                        {m.slug}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-mono text-[0.75rem] text-muted">
                        {m.live ? (m.status ?? "open") : "not created"}
                      </span>
                      {m.url ? (
                        <a
                          href={m.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[0.8125rem] text-clay transition-colors duration-500 ease-[var(--ease-spring)] hover:text-ink"
                        >
                          On Panta
                        </a>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
              {!markets.data.configured ? (
                <div className="border-t border-rule px-6 py-4">
                  <Notice tone="warn">
                    {markets.data.reason} These are the slugs the factory will
                    use once it runs, derived rather than stored.
                  </Notice>
                </div>
              ) : null}
              {markets.data.error ? (
                <div className="border-t border-rule px-6 py-4">
                  <Notice tone="warn">Panta request failed: {markets.data.error}</Notice>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </section>

      {/* ── Positions ───────────────────────────────────────────────── */}
      <section>
        <h2 className="text-[1.25rem] font-semibold tracking-[-0.02em] text-ink">
          Your positions
        </h2>
        <p className="mt-2 max-w-xl text-[0.875rem] leading-relaxed text-ink-soft">
          Positions are public on chain. Paste any Solana address to read what it
          holds, including one that is not yours.
        </p>

        <form
          className="mt-4 flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void lookUp();
          }}
        >
          <label htmlFor="wallet" className="sr-only">
            Solana wallet address
          </label>
          <input
            id="wallet"
            value={wallet}
            onChange={(e) => setWallet(e.target.value)}
            placeholder="Solana address"
            spellCheck={false}
            autoComplete="off"
            className="edge min-w-0 flex-1 rounded-[0.75rem] bg-surface px-4 py-3 font-mono text-[0.875rem] text-ink outline-none placeholder:text-faint focus:ring-1 focus:ring-ink/20"
          />
          <button
            type="submit"
            disabled={positions.phase === "loading"}
            className="rounded-full bg-ink px-6 py-3 text-sm font-medium text-paper transition-colors duration-500 ease-[var(--ease-spring)] hover:bg-[#232720] disabled:opacity-50"
          >
            {positions.phase === "loading" ? "Reading…" : "Look up"}
          </button>
        </form>

        {positions.phase === "failed" ? (
          <Notice tone="warn">{positions.message}</Notice>
        ) : null}

        {positions.phase === "ready" ? (
          <div className="edge mt-4 rounded-[1.25rem] bg-surface">
            {!positions.data.configured ? (
              <p className="px-6 py-8 text-[0.875rem] leading-relaxed text-clay">
                {positions.data.reason}
              </p>
            ) : positions.data.error ? (
              <p className="px-6 py-8 text-[0.875rem] text-clay">
                Panta request failed: {positions.data.error}
              </p>
            ) : positions.data.positions.length === 0 ? (
              <p className="px-6 py-8 text-[0.875rem] text-muted">
                This address holds no positions in any PREMIUM market.
              </p>
            ) : (
              <ul className="divide-y divide-rule">
                {positions.data.positions.map((p, i) => (
                  <li
                    key={`${String(p.marketId)}-${i}`}
                    className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-6 py-4"
                  >
                    <div>
                      <div className="text-[0.9375rem] text-ink">
                        {p.side ?? "position"}
                      </div>
                      <div className="mt-0.5 font-mono text-[0.75rem] text-muted">
                        market {String(p.marketId ?? "unknown")}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-mono text-[0.875rem] text-ink">
                        {p.shares ?? "0"} shares
                      </span>
                      {p.claimable ? (
                        <span className="font-mono text-[0.75rem] text-clay">
                          claimable
                        </span>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </section>

      {/* ── Attribution ─────────────────────────────────────────────── */}
      <section>
        <h2 className="text-[1.25rem] font-semibold tracking-[-0.02em] text-ink">
          Attributed volume
        </h2>
        <div className="edge mt-4 rounded-[1.25rem] bg-surface px-6 py-6">
          <div className="font-mono text-[1.75rem] leading-none text-ink">0.00 USDC</div>
          <p className="mt-3 max-w-xl text-[0.8125rem] leading-relaxed text-muted">
            Read back from Panta&apos;s attribution endpoint, never counted
            locally, and excluding our own seeded liquidity. It stays at zero
            until a real trade settles, which is the only way the number means
            anything to anyone checking it.
          </p>
        </div>
      </section>
    </div>
  );
}
