/**
 * Footer.
 *
 * Not the standard four-columns-of-links-under-tracked-caps footer — that
 * shape is tidy, expected, and has no idea in it. This one carries the two
 * things that actually matter at the bottom of this particular page: the
 * honest scope of what the product claims, and the Panta attribution.
 *
 * "Powered by Panta" is MANDATORY, not decorative. Panta's Terms of Use and
 * the playground's CONTRIBUTING both require it wherever Panta-powered
 * functionality appears. A submission without it is a rules violation.
 *
 * The wordmark is anchored flush to the bottom edge and bleeds off it, sitting
 * above the grain rather than under it. A giant word with empty space beneath
 * it is the failed version of this move.
 */
export function Footer() {
  return (
    <footer className="relative z-[2] overflow-hidden bg-ink text-paper">
      <div className="mx-auto max-w-6xl px-5 pt-16 sm:px-8 sm:pt-20">
        <div className="grid gap-10 sm:grid-cols-12 sm:gap-8">
          <div className="sm:col-span-6">
            <p className="max-w-sm text-[0.9375rem] leading-relaxed text-paper/70">
              PREMIUM sells parametric cover, not insurance. Payouts follow a
              published protocol-wide metric, never an individual loss
              assessment, and no claim is ever adjudicated by us.
            </p>

            <a
              href="https://panta.market"
              target="_blank"
              rel="noreferrer"
              className="mt-7 inline-flex items-center gap-2 text-[0.875rem] text-paper/80 transition-colors duration-500 ease-[var(--ease-spring)] hover:text-paper"
            >
              Powered by Panta
              <svg width="10" height="10" viewBox="0 0 11 11" fill="none" aria-hidden>
                <path
                  d="M2 9L9 2M9 2H3.5M9 2V7.5"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </a>
          </div>

          <div className="grid grid-cols-2 gap-8 text-[0.875rem] sm:col-span-6 sm:grid-cols-2">
            <ul className="space-y-3">
              {[
                ["Methodology", "/methodology/kamino-liquidation-e0"],
                ["Factory status", "/status"],
                ["Risk price API", "/api/risk/kamino"],
              ].map(([label, href]) => (
                <li key={label}>
                  <a
                    href={href}
                    className="text-paper/65 transition-colors duration-500 ease-[var(--ease-spring)] hover:text-paper"
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
            <ul className="space-y-3">
              <li>
                <a
                  href="https://github.com/Venkat5599/Panta"
                  target="_blank"
                  rel="noreferrer"
                  className="text-paper/65 transition-colors duration-500 ease-[var(--ease-spring)] hover:text-paper"
                >
                  Source
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-14 flex flex-wrap items-baseline justify-between gap-3 border-t border-paper/10 py-5 font-mono text-[0.75rem] text-paper/45">
          <span>Solana mainnet · USDC</span>
          <span>Built for the Panta API Sidetrack</span>
        </div>
      </div>

      {/* Anchored to the very bottom, clipped by the edge, above the texture. */}
      <div aria-hidden className="select-none px-5 sm:px-8">
        <div className="mx-auto max-w-6xl">
          <span className="block translate-y-[0.16em] text-[21vw] leading-[0.8] font-semibold tracking-[0.015em] text-paper/[0.055] sm:text-[15.5rem]">
            PREMIUM
          </span>
        </div>
      </div>
    </footer>
  );
}
