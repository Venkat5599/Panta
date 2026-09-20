import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";

/**
 * The published methodology.
 *
 * Load-bearing, not marketing. PRD.md B4 requires that a third party can
 * recompute an epoch's metric from what is published here and reach our number
 * exactly. It goes live BEFORE the epoch opens — publishing it afterwards would
 * make us the adjudicator the whole design exists to remove.
 */

export const dynamic = "force-dynamic";

const KLEND = "KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD";

export default async function Methodology({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const epochIndex = Number(slug.split("-e").at(-1) ?? 0) || 0;
  const startSlot = 301_450_000;
  const endSlot = startSlot + 1_440_000;

  const definition: Array<[string, string]> = [
    ["program", KLEND],
    ["instruction", "liquidateObligationAndRedeemReserveCollateral"],
    ["window", `[${startSlot.toLocaleString("en-US")}, ${endSlot.toLocaleString("en-US")}]`],
    ["commitment", "finalized"],
    ["valuation", "collateral token units x pinned price"],
    ["price source", "Pyth, snapshot at the window's first slot"],
    ["threshold", "2000000000000 base units ($2,000,000)"],
    ["outcome", "YES if total >= threshold, else NO"],
  ];

  return (
    <>
      <Nav />
      <main className="relative z-[2] mx-auto max-w-3xl px-5 py-16 sm:px-8 sm:py-24">
        <h1 className="text-[2rem] leading-tight font-semibold tracking-[-0.03em] text-ink sm:text-[2.5rem]">
          How epoch {epochIndex} settles
        </h1>
        <p className="mt-5 text-[1.0625rem] leading-relaxed text-ink-soft">
          Everything needed to reach our answer independently. If you compute a
          different total, we are wrong, and the evidence bundle will show where.
        </p>

        <section className="mt-12">
          <h2 className="text-[1.25rem] font-semibold tracking-[-0.02em] text-ink">
            The question
          </h2>
          <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-soft">
            Will Kamino liquidate more than $2,000,000 of collateral between slot{" "}
            {startSlot.toLocaleString("en-US")} and {endSlot.toLocaleString("en-US")}?
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-[1.25rem] font-semibold tracking-[-0.02em] text-ink">
            Definition
          </h2>
          <div className="edge mt-4 rounded-[1.25rem] bg-surface p-6">
            <dl className="space-y-4 font-mono text-[0.8125rem] leading-relaxed">
              {definition.map(([k, v]) => (
                <div key={k} className="grid gap-1 sm:grid-cols-[9rem_1fr] sm:gap-4">
                  <dt className="text-muted">{k}</dt>
                  <dd className="break-all text-ink">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-[1.25rem] font-semibold tracking-[-0.02em] text-ink">
            Why the window is a slot count, not a date
          </h2>
          <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-soft">
            Solana slot time drifts. A window derived from wall-clock time is
            ambiguous at exactly the boundary that decides who gets paid, and
            resolving that ambiguity afterwards means changing the terms after
            trading. So the window is the observed opening slot plus a fixed,
            published count of 1,440,000 slots. Every observer computes the same
            boundary, including you.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-[1.25rem] font-semibold tracking-[-0.02em] text-ink">
            Why the price is pinned once
          </h2>
          <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-soft">
            Valuing each liquidation at its own spot price would make the total
            impossible for anyone else to reproduce. One snapshot, taken at the
            window&apos;s first slot and published here before trading opens,
            keeps the figure both legible and exactly recomputable.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-[1.25rem] font-semibold tracking-[-0.02em] text-ink">
            Evidence
          </h2>
          <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-soft">
            At settlement this page gains the full transaction list, the
            per-signature amounts and the total. Nothing is edited afterwards: a
            corrected bundle would be indistinguishable from a doctored one.
          </p>
          <p className="mt-5 font-mono text-[0.8125rem] text-muted">
            status: awaiting first epoch
          </p>
        </section>
      </main>
      <Footer />
    </>
  );
}
