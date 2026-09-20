import { epochStatus } from "@premium/core";
import { DashboardClient } from "@/components/DashboardClient";
import { Footer } from "@/components/Footer";
import { Nav } from "@/components/Nav";

/**
 * Dashboard.
 *
 * PRD.md P7: positions, claim eligibility, and the route claim building hangs
 * off. Deliberately not gated behind a wallet connect, because Panta positions
 * are public on chain — anyone can read any address, and requiring a connection
 * to see public data would be security theatre.
 */

export const dynamic = "force-dynamic";

export default function Dashboard() {
  const { epoch, preGenesis } = epochStatus();

  return (
    <>
      <Nav />
      <main className="relative z-[2] mx-auto max-w-4xl px-5 py-16 sm:px-8 sm:py-20">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[2rem] leading-tight font-semibold tracking-[-0.03em] text-ink sm:text-[2.5rem]">
              Dashboard
            </h1>
            <p className="mt-3 max-w-xl text-[1.0625rem] leading-relaxed text-ink-soft">
              Open markets, positions and claims, read from Panta rather than
              from our own cache.
            </p>
          </div>
          <div className="text-right">
            <div className="text-[0.8125rem] text-muted">
              {preGenesis ? "First epoch" : "Current epoch"}
            </div>
            <div className="mt-1 font-mono text-[1.125rem] text-ink">{epoch.label}</div>
          </div>
        </div>

        <div className="mt-12">
          <DashboardClient />
        </div>
      </main>
      <Footer />
    </>
  );
}
