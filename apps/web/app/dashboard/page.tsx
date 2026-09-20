import { epochStatus } from "@premium/core";
import { AttributionPanel, MarketsPanel } from "@/components/dashboard/panels";

/**
 * Overview.
 *
 * Deliberately short. It answers "what is happening this week" and links out;
 * a landing page for the dashboard that restates every other section is just a
 * longer route to the same information.
 */

export const dynamic = "force-dynamic";

export default function Overview() {
  const { epoch, preGenesis } = epochStatus();

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-[1.75rem] leading-tight font-semibold tracking-[-0.03em] text-ink sm:text-[2rem]">
          Overview
        </h1>
        <p className="mt-2.5 max-w-xl text-[0.9375rem] leading-relaxed text-ink-soft">
          {preGenesis
            ? "No epoch has opened yet. Everything below reads from Panta, so it fills in on its own once the factory runs."
            : "Read from Panta rather than from our own cache, so a market that exists always appears here."}
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          [preGenesis ? "First epoch" : "Current epoch", epoch.label],
          ["Markets opened", "0"],
          ["Epochs settled", "0"],
        ].map(([k, v]) => (
          <div key={k} className="edge rounded-[1.25rem] bg-surface px-5 py-4">
            <div className="text-[0.8125rem] text-muted">{k}</div>
            <div className="mt-1.5 font-mono text-[1.125rem] text-ink">{v}</div>
          </div>
        ))}
      </div>

      <MarketsPanel compact />
      <AttributionPanel />
    </div>
  );
}
