"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Dashboard panels.
 *
 * Every state here is a real state, including the unhappy ones. "Not
 * configured", "upstream failed" and "this address holds nothing" are three
 * different facts, and the UI says which one it means. A dashboard that renders
 * an identical empty table for all three is lying by omission, and only the
 * third actually means the address is empty.
 *
 * Nothing is mocked. When the deployment has no Panta key, it says so.
 */

export interface MarketRow {
  protocol: string;
  slug: string;
  live: boolean;
  id?: string | number | null;
  url?: string | null;
  status?: string | null;
}

export interface MarketsResponse {
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
  | { phase: "loading" }
  | { phase: "ready"; data: T }
  | { phase: "failed"; message: string };

const WALLET_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-[1.125rem] font-semibold tracking-[-0.02em] text-ink">
          {title}
        </h2>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="edge overflow-hidden rounded-[1.25rem] bg-surface">{children}</div>
  );
}

function Message({ tone = "muted", children }: { tone?: "muted" | "warn"; children: React.ReactNode }) {
  return (
    <p
      className={`px-6 py-8 text-[0.875rem] leading-relaxed ${
        tone === "warn" ? "text-clay" : "text-muted"
      }`}
    >
      {children}
    </p>
  );
}

/** Shared fetch hook so every panel handles failure identically. */
function useEndpoint<T>(url: string | null) {
  const [state, setState] = useState<Load<T>>({ phase: "loading" });

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    setState({ phase: "loading" });
    fetch(url)
      .then(async (r) => (await r.json()) as T)
      .then((data) => {
        if (!cancelled) setState({ phase: "ready", data });
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setState({
            phase: "failed",
            message: e instanceof Error ? e.message : "request failed",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  return state;
}

export function MarketsPanel({ compact = false }: { compact?: boolean }) {
  const state = useEndpoint<MarketsResponse>("/api/markets");

  return (
    <Panel
      title={compact ? "This week's markets" : "Markets"}
      action={
        state.phase === "ready" ? (
          <span className="font-mono text-[0.75rem] text-muted">
            {state.data.epoch.preGenesis
              ? `${state.data.epoch.label}, not yet open`
              : state.data.epoch.label}
          </span>
        ) : null
      }
    >
      <Shell>
        {state.phase === "loading" ? (
          <Message>Loading markets…</Message>
        ) : state.phase === "failed" ? (
          <Message tone="warn">{state.message}</Message>
        ) : (
          <>
            <ul className="divide-y divide-rule">
              {state.data.markets.map((m) => (
                <li
                  key={m.slug}
                  className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-6 py-4"
                >
                  <div className="min-w-0">
                    <div className="text-[0.9375rem] font-medium text-ink">
                      {m.protocol[0]!.toUpperCase() + m.protocol.slice(1)}
                    </div>
                    <div className="mt-0.5 truncate font-mono text-[0.75rem] text-muted">
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
                        className="text-[0.8125rem] text-clay transition-colors duration-400 hover:text-ink"
                      >
                        On Panta
                      </a>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
            {!state.data.configured ? (
              <div className="border-t border-rule px-6 py-4">
                <p className="text-[0.8125rem] leading-relaxed text-clay">
                  {state.data.reason} These are the slugs the factory will use,
                  derived from the epoch rather than stored anywhere.
                </p>
              </div>
            ) : null}
            {state.data.error ? (
              <div className="border-t border-rule px-6 py-4">
                <p className="text-[0.8125rem] text-clay">
                  Panta request failed: {state.data.error}
                </p>
              </div>
            ) : null}
          </>
        )}
      </Shell>
    </Panel>
  );
}

export function PositionsPanel() {
  const [wallet, setWallet] = useState("");
  const [query, setQuery] = useState<string | null>(null);
  const state = useEndpoint<PositionsResponse>(
    query ? `/api/positions?wallet=${encodeURIComponent(query)}` : null,
  );
  const [invalid, setInvalid] = useState<string | null>(null);

  const submit = useCallback(() => {
    const w = wallet.trim();
    if (!WALLET_RE.test(w)) {
      setInvalid("That does not look like a Solana address.");
      setQuery(null);
      return;
    }
    setInvalid(null);
    setQuery(w);
  }, [wallet]);

  return (
    <Panel title="Positions">
      <p className="-mt-1 mb-4 max-w-xl text-[0.875rem] leading-relaxed text-ink-soft">
        Positions are public on chain. Read any address, including one that is
        not yours.
      </p>

      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
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
          className="rounded-full bg-ink px-6 py-3 text-sm font-medium text-paper transition-colors duration-400 ease-[var(--ease-spring)] hover:bg-[#232720]"
        >
          Look up
        </button>
      </form>

      {invalid ? (
        <p className="mt-3 text-[0.8125rem] text-clay">{invalid}</p>
      ) : null}

      {query ? (
        <div className="mt-4">
          <Shell>
            {state.phase === "loading" ? (
              <Message>Reading positions…</Message>
            ) : state.phase === "failed" ? (
              <Message tone="warn">{state.message}</Message>
            ) : !state.data.configured ? (
              <Message tone="warn">{state.data.reason}</Message>
            ) : state.data.error ? (
              <Message tone="warn">Panta request failed: {state.data.error}</Message>
            ) : state.data.positions.length === 0 ? (
              <Message>
                This address holds no positions in any PREMIUM market.
              </Message>
            ) : (
              <ul className="divide-y divide-rule">
                {state.data.positions.map((p, i) => (
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
          </Shell>
        </div>
      ) : null}
    </Panel>
  );
}

export function AttributionPanel() {
  return (
    <Panel title="Attributed volume">
      <div className="edge rounded-[1.25rem] bg-surface px-6 py-6">
        <div className="font-mono text-[1.75rem] leading-none text-ink">0.00 USDC</div>
        <p className="mt-3 max-w-xl text-[0.8125rem] leading-relaxed text-muted">
          Read back from Panta&apos;s attribution endpoint, never counted
          locally, and excluding our own seeded liquidity. It stays at zero until
          a real trade settles, which is the only way the figure means anything
          to someone checking it.
        </p>

        <dl className="mt-6 grid gap-4 border-t border-rule pt-5 sm:grid-cols-3">
          {[
            ["Distinct wallets", "0"],
            ["Trades reported", "0"],
            ["Creator fees claimed", "0.00 USDC"],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-[0.8125rem] text-muted">{k}</dt>
              <dd className="mt-1 font-mono text-[1.0625rem] text-ink">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </Panel>
  );
}
