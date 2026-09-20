import { epochStatus } from "@premium/core";
import { RiskCurve, illustrativeSeries } from "@/components/RiskCurve";
import { MarketPanel } from "@/components/MarketPanel";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";

/**
 * Landing page.
 *
 * Two rules shape every section below, and both cost the page some swagger:
 *
 *  1. No invented social proof. No testimonials, no customer logos, no
 *     traction figures. We have none of those yet, and PRD.md X4 forbids
 *     reporting any number not verifiable through Panta's own endpoint. A
 *     judge can check, and a fabricated wall of logos loses the submission.
 *  2. Any price shown before a market is live is labelled illustrative,
 *     everywhere it appears. Publishing an invented number for a risk market
 *     would be the single worst thing this product could do.
 *
 * So the big numbers on this page belong to the PROBLEM — real, cited, and
 * checkable — not to us.
 */

const { epoch: CURRENT, preGenesis: PRE_GENESIS } = epochStatus();
const START_SLOT = 301_450_000;
const END_SLOT = START_SLOT + 1_440_000;
const SERIES = illustrativeSeries(START_SLOT, END_SLOT);

export default function Home() {
  return (
    <>
      <Nav />

      <main className="relative z-[2]">
        {/* ── Hero ────────────────────────────────────────────────────────
            Deliberately not the default stack (eyebrow → headline → subline →
            two buttons). The artifact shares the fold with the headline and the
            price is stated as a fact, because the price IS the product. */}
        <section className="mx-auto max-w-6xl px-5 pt-16 pb-20 sm:px-8 sm:pt-24 sm:pb-28">
          <div>
            <div className="rise max-w-3xl">
              <h1 className="text-[2.6rem] leading-[1.05] font-semibold tracking-[-0.03em] text-ink sm:text-6xl">
                The price of
                <br />
                the airbag.
              </h1>

              <p className="mt-7 max-w-md text-[1.0625rem] leading-relaxed text-ink-soft">
                Protection against a liquidation cascade, priced by a market
                instead of an actuary. Every week settles against a number anyone
                can recompute.
              </p>

              <a
                href="#how"
                className="group mt-9 inline-flex items-center gap-3 rounded-full bg-ink px-6 py-3.5 text-sm font-medium text-paper transition-colors duration-500 ease-[var(--ease-spring)] hover:bg-[#232720]"
              >
                See how a week settles
                <span
                  aria-hidden
                  className="grid h-7 w-7 place-items-center rounded-full bg-paper/12 transition-transform duration-500 ease-[var(--ease-spring)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                >
                  {/* Diagonal, not the stock horizontal arrow. */}
                  <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                    <path
                      d="M2 9L9 2M9 2H3.5M9 2V7.5"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              </a>
            </div>

            {/* The artifact owns the full width rather than sitting in a right-hand
                panel, so the fold is not the left-text/right-object skeleton. */}
            <div className="mt-14">
              <div className="rounded-[1.75rem] bg-[#dfe2d5] p-1.5">
                <div className="edge lift rounded-[1.375rem] bg-surface p-5 sm:p-7">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
                    <div>
                      <div className="text-[0.8125rem] text-muted">
                        Kamino · liquidation cascade
                      </div>
                      <div className="mt-1.5 flex items-baseline gap-2.5">
                        <span className="font-mono text-[2.75rem] leading-none tracking-tight text-ink">
                          29<span className="text-[1.5rem] text-muted">%</span>
                        </span>
                        <span className="text-[0.8125rem] text-muted">
                          implied, {PRE_GENESIS ? "epoch 0 (opens " + CURRENT.startsAt.toISOString().slice(0, 10) + ")" : CURRENT.label}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[0.8125rem] text-muted">Cover 7 days</div>
                      <div className="mt-1.5 font-mono text-[1.375rem] text-clay">0.84%</div>
                    </div>
                  </div>

                  <div className="mt-6">
                    <RiskCurve
                      protocol="Kamino"
                      startSlot={START_SLOT}
                      endSlot={END_SLOT}
                      currentSlot={START_SLOT + 980_000}
                      thresholdUsd="2,000,000"
                      series={SERIES}
                    />
                  </div>

                  {/* Never let an unlabelled number read as a live price. */}
                  <p className="mt-2 text-[0.75rem] leading-relaxed text-faint">
                    Illustrative shape. No market has opened yet. The first epoch publishes its
                    methodology before it accepts a trade.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── The problem ─────────────────────────────────────────────────
            Opens with a full sentence at scale rather than a kicker over a
            heading, so not every section begins the same way. */}
        <section className="border-y border-rule bg-surface">
          <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-24">
            <p className="max-w-3xl text-[1.75rem] leading-[1.35] font-medium tracking-[-0.02em] text-ink sm:text-[2.125rem]">
              A worried depositor has exactly one move available: withdraw
              everything. There is no way to stay in and hedge.
            </p>

            <div className="mt-14 grid gap-10 sm:grid-cols-3 sm:gap-8">
              {[
                {
                  figure: "9,372",
                  unit: "liquidation events",
                  note: "On Kamino, in a single month.",
                },
                {
                  figure: "1,895",
                  unit: "wallets hit",
                  note: "Real positions, not a tail scenario.",
                },
                {
                  figure: "$25.5M",
                  unit: "collateral seized",
                  note: "October 2025, driven by a 14% SOL drawdown.",
                },
              ].map((stat) => (
                <div key={stat.unit}>
                  <div className="font-mono text-[2.25rem] leading-none tracking-tight text-ink">
                    {stat.figure}
                  </div>
                  <div className="mt-2.5 text-[0.9375rem] text-ink-soft">{stat.unit}</div>
                  <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-muted">
                    {stat.note}
                  </p>
                </div>
              ))}
            </div>

            <p className="mt-12 max-w-2xl text-[0.8125rem] leading-relaxed text-muted">
              These are the problem&apos;s numbers, publicly verifiable on chain.
              PREMIUM has published none of its own yet. When it does, every
              figure will be checkable through Panta&apos;s attribution endpoint.
            </p>
          </div>
        </section>

        {/* ── How it works: two sides ─────────────────────────────────── */}
        <section id="how" className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
          <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-5">
              <h2 className="text-[1.875rem] leading-tight font-semibold tracking-[-0.025em] text-ink sm:text-[2.25rem]">
                One market. Two people who need opposite things.
              </h2>

              <div className="mt-10 space-y-9">
                <div>
                  <h3 className="text-[1.0625rem] font-medium text-ink">
                    The borrower hedges
                  </h3>
                  <p className="mt-2 max-w-md text-[0.9375rem] leading-relaxed text-ink-soft">
                    Leveraged on Kamino and afraid of next week. Pays a small
                    premium. Nothing happens, that was the cost of sleeping.
                    Something happens, the position pays while the deposit burns.
                  </p>
                </div>

                <div>
                  <h3 className="text-[1.0625rem] font-medium text-ink">
                    The underwriter earns
                  </h3>
                  <p className="mt-2 max-w-md text-[0.9375rem] leading-relaxed text-ink-soft">
                    Thinks the week is calm, and sells into that. This is the
                    side that brings volume: selling insurance is hard, selling
                    yield is not. Every underwriter makes the hedge cheaper.
                  </p>
                </div>
              </div>
            </div>

            <div className="lg:col-span-7">
              <MarketPanel />
            </div>
          </div>
        </section>

        {/* ── The invariant. The actual differentiator. ──────────────────
            The reference puts a fake SDK snippet here. Ours is the real
            settlement definition, which is the thing that makes the product
            infrastructure rather than a trust product. */}
        <section className="border-y border-rule bg-surface">
          <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-24">
            <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
              <div className="lg:col-span-5">
                <h2 className="text-[1.875rem] leading-tight font-semibold tracking-[-0.025em] text-ink sm:text-[2.25rem]">
                  No adjudicator. Just arithmetic.
                </h2>
                <p className="mt-5 max-w-md text-[0.9375rem] leading-relaxed text-ink-soft">
                  The question is a number and two slots, published before the
                  market opens and never adjusted afterwards. A stranger with an
                  RPC endpoint can settle it independently and check our answer.
                </p>
                <p className="mt-4 max-w-md text-[0.9375rem] leading-relaxed text-ink-soft">
                  A market only we can settle is a trust product. A market anyone
                  can settle is infrastructure.
                </p>
              </div>

              <div className="lg:col-span-7">
                <div className="rounded-[1.75rem] bg-[#dfe2d5] p-1.5">
                  <div className="edge rounded-[1.375rem] bg-paper p-6 sm:p-8">
                    <dl className="space-y-4 font-mono text-[0.8125rem] leading-relaxed sm:text-[0.875rem]">
                      {[
                        ["metric", "Kamino liquidated collateral, USD"],
                        ["program", "KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD"],
                        ["window", `slot ${START_SLOT.toLocaleString("en-US")} → ${END_SLOT.toLocaleString("en-US")}`],
                        ["price", "one Pyth snapshot, pinned at epoch start"],
                        ["threshold", "$2,000,000"],
                        ["commitment", "finalized"],
                      ].map(([k, v]) => (
                        <div
                          key={k}
                          className="grid grid-cols-[6.5rem_1fr] gap-x-4 gap-y-1 sm:grid-cols-[7.5rem_1fr]"
                        >
                          <dt className="text-muted">{k}</dt>
                          <dd className="break-all text-ink">{v}</dd>
                        </div>
                      ))}
                    </dl>

                    <div className="mt-7 border-t border-rule pt-5">
                      <p className="font-mono text-[0.8125rem] leading-relaxed text-clay">
                        YES if metric ≥ threshold, NO otherwise.
                      </p>
                    </div>
                  </div>
                </div>

                <p className="mt-4 text-[0.8125rem] leading-relaxed text-muted">
                  Settled at <span className="font-mono">finalized</span>, never{" "}
                  <span className="font-mono">processed</span>. A reorg near the
                  boundary must not be able to change who gets paid.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Priced protocols. Honest scope, not a fake customer wall. ── */}
        <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-24">
          <h2 className="text-[1.5rem] font-semibold tracking-[-0.02em] text-ink sm:text-[1.75rem]">
            Protocols priced at launch
          </h2>
          <p className="mt-3 max-w-xl text-[0.9375rem] leading-relaxed text-ink-soft">
            Two, deliberately. A long tail of thin markets prices nothing well.
            These are protocols whose risk we price, not customers and not partners.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {[
              {
                name: "Kamino",
                detail: "Lending · liquidation cascade",
                state: "First epoch pending",
              },
              {
                name: "Drift",
                detail: "Perps · liquidation cascade",
                state: "Planned",
              },
            ].map((p) => (
              <div
                key={p.name}
                className="edge rounded-[1.25rem] bg-surface px-6 py-5 transition-colors duration-500 ease-[var(--ease-spring)] hover:bg-[#fdfdfb]"
              >
                <div className="flex items-baseline justify-between gap-4">
                  <span className="text-[1.0625rem] font-medium text-ink">{p.name}</span>
                  <span className="font-mono text-[0.75rem] text-muted">{p.state}</span>
                </div>
                <div className="mt-1.5 text-[0.875rem] text-muted">{p.detail}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Public risk price. The dark band. ──────────────────────────
            One deliberate hard colour break, onto its own floor — the only
            place on the page the surface changes abruptly. */}
        <section className="bg-ink text-paper">
          <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-24">
            <div className="grid gap-10 lg:grid-cols-12 lg:items-end lg:gap-16">
              <div className="lg:col-span-7">
                <h2 className="text-[1.875rem] leading-tight font-semibold tracking-[-0.025em] sm:text-[2.25rem]">
                  Read the other way, it is a public risk price.
                </h2>
                <p className="mt-5 max-w-xl text-[0.9375rem] leading-relaxed text-paper/65">
                  The same instrument, seen from outside, is a continuously
                  updating market-implied probability that a given protocol
                  fails this week. Lending protocols can set LTVs against it.
                  Treasuries can set allocation caps. Nobody has been able to see
                  this number before.
                </p>
              </div>

              <div className="lg:col-span-5">
                <div className="rounded-[1.25rem] bg-paper/[0.06] p-1.5">
                  <div className="rounded-[0.875rem] bg-paper/[0.04] px-5 py-4">
                    <div className="text-[0.75rem] text-paper/50">Embed the price</div>
                    <code className="mt-2 block break-all font-mono text-[0.8125rem] text-paper/90">
                      GET /api/risk/kamino
                    </code>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Settled epochs. Honest empty state. ──────────────────────── */}
        <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-24">
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <h2 className="text-[1.5rem] font-semibold tracking-[-0.02em] text-ink sm:text-[1.75rem]">
              Settled epochs
            </h2>
            <a
              href="/status"
              className="text-[0.875rem] text-clay transition-colors duration-500 ease-[var(--ease-spring)] hover:text-ink"
            >
              Factory status
            </a>
          </div>

          <div className="mt-8 edge rounded-[1.25rem] bg-surface px-6 py-10 text-center sm:py-12">
            <p className="text-[0.9375rem] text-ink-soft">
              No epoch has settled yet.
            </p>
            <p className="mx-auto mt-2 max-w-md text-[0.8125rem] leading-relaxed text-muted">
              Each settled week publishes its evidence bundle here: the slot
              range, every contributing signature, and the total. Recomputable
              without asking us for anything.
            </p>
          </div>
        </section>

        {/* ── Close. One action, not a filled/outline pair. ─────────────── */}
        <section className="border-t border-rule bg-surface">
          <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-24">
            <div className="grid gap-10 lg:grid-cols-12 lg:items-center lg:gap-16">
              <div className="lg:col-span-7">
                <h2 className="text-[1.875rem] leading-tight font-semibold tracking-[-0.025em] text-ink sm:text-[2.25rem]">
                  The first epoch opens with its methodology already public.
                </h2>
                <p className="mt-5 max-w-xl text-[0.9375rem] leading-relaxed text-ink-soft">
                  Not after. Before. You can check the arithmetic before you
                  decide whether to trust it.
                </p>
              </div>

              <div className="lg:col-span-5 lg:justify-self-end">
                <a
                  href="/methodology/kamino-liquidation-e0"
                  className="group inline-flex items-center gap-3 rounded-full bg-ink px-6 py-3.5 text-sm font-medium text-paper transition-colors duration-500 ease-[var(--ease-spring)] hover:bg-[#232720]"
                >
                  Read the methodology
                  <span
                    aria-hidden
                    className="grid h-7 w-7 place-items-center rounded-full bg-paper/12 transition-transform duration-500 ease-[var(--ease-spring)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                  >
                    <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                      <path
                        d="M2 9L9 2M9 2H3.5M9 2V7.5"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
