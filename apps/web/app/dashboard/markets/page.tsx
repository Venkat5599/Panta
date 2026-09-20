import { MarketsPanel } from "@/components/dashboard/panels";

export const dynamic = "force-dynamic";

export default function Markets() {
  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-[1.75rem] leading-tight font-semibold tracking-[-0.03em] text-ink sm:text-[2rem]">
          Markets
        </h1>
        <p className="mt-2.5 max-w-xl text-[0.9375rem] leading-relaxed text-ink-soft">
          One market per protocol per weekly epoch. Slugs are derived from the
          epoch, not stored, which is what makes a crash-retry safe.
        </p>
      </header>
      <MarketsPanel />
    </div>
  );
}
