import { AttributionPanel } from "@/components/dashboard/panels";

export const dynamic = "force-dynamic";

export default function Attribution() {
  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-[1.75rem] leading-tight font-semibold tracking-[-0.03em] text-ink sm:text-[2rem]">
          Attribution
        </h1>
        <p className="mt-2.5 max-w-xl text-[0.9375rem] leading-relaxed text-ink-soft">
          The only figures we will publish as traction, because they are the only
          ones a judge can verify without taking our word for it.
        </p>
      </header>
      <AttributionPanel />
    </div>
  );
}
