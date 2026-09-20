import { PositionsPanel } from "@/components/dashboard/panels";

export const dynamic = "force-dynamic";

export default function Positions() {
  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-[1.75rem] leading-tight font-semibold tracking-[-0.03em] text-ink sm:text-[2rem]">
          Positions
        </h1>
        <p className="mt-2.5 max-w-xl text-[0.9375rem] leading-relaxed text-ink-soft">
          No wallet connection required. Panta positions are public on chain, so
          gating a read behind a connect button would be security theatre.
        </p>
      </header>
      <PositionsPanel />
    </div>
  );
}
