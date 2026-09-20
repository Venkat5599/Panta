import { epochStatus } from "@premium/core";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";

/**
 * Proof of life.
 *
 * Doubles as submission evidence: "it has been running unattended since week
 * one" is only a claim until a public page shows it. Which means this page has
 * to be equally willing to report that nothing has happened.
 */

export const dynamic = "force-dynamic";

export default function Status() {
  const { epoch, preGenesis } = epochStatus();

  const facts: Array<[string, string]> = [
    [preGenesis ? "First epoch" : "Current epoch", epoch.label],
    [preGenesis ? "Opens" : "Closes", (preGenesis ? epoch.startsAt : epoch.endsAt).toISOString().slice(0, 10)],
    ["Markets opened", "0"],
    ["Epochs settled", "0"],
  ];

  return (
    <>
      <Nav />
      <main className="relative z-[2] mx-auto max-w-3xl px-5 py-16 sm:px-8 sm:py-24">
        <h1 className="text-[2rem] leading-tight font-semibold tracking-[-0.03em] text-ink sm:text-[2.5rem]">
          Factory status
        </h1>
        <p className="mt-5 text-[1.0625rem] leading-relaxed text-ink-soft">
          The factory opens one market per protocol per week and settles it
          against the published metric. This page reports what it has actually
          done, including when that is nothing.
        </p>

        <div className="mt-12 grid gap-4 sm:grid-cols-2">
          {facts.map(([label, value]) => (
            <div key={label} className="edge rounded-[1.25rem] bg-surface px-6 py-5">
              <div className="text-[0.8125rem] text-muted">{label}</div>
              <div className="mt-1.5 font-mono text-[1.25rem] text-ink">{value}</div>
            </div>
          ))}
        </div>

        <div className="edge mt-4 rounded-[1.25rem] bg-surface px-6 py-6">
          <h2 className="text-[1.0625rem] font-medium text-ink">Not yet live</h2>
          <p className="mt-2 max-w-xl text-[0.875rem] leading-relaxed text-ink-soft">
            The factory is built and tested but not deployed. It needs a Panta
            API key, an RPC endpoint and a funded wallet before it can open a
            market. Nothing on this page is inflated in the meantime, and it will
            keep saying zero until zero stops being true.
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
