/**
 * Navigation.
 *
 * Contained and floated rather than a flush bar welded to the top edge. The
 * wordmark is set type, not an icon inside a gradient tile — that lockup is
 * one of the most recognisable machine-made logos there is.
 *
 * backdrop-blur is applied here and only here: it is sticky, so it does not
 * repaint as content scrolls beneath it.
 */
export function Nav() {
  return (
    <header className="sticky top-0 z-20 px-5 pt-5 sm:px-8 sm:pt-6">
      <nav className="mx-auto flex max-w-6xl items-center justify-between gap-6 rounded-full border border-[rgb(17_19_15_/_0.07)] bg-[rgb(251_251_248_/_0.82)] py-2.5 pl-6 pr-2.5 backdrop-blur-xl">
        <a href="/" className="flex items-baseline gap-2.5">
          <span className="text-[1.0625rem] font-semibold tracking-[-0.02em] text-ink">
            PREMIUM
          </span>
          <span className="hidden text-[0.75rem] text-muted sm:inline">
            onchain risk, priced
          </span>
        </a>

        <div className="flex items-center gap-1">
          <a
            href="/dashboard"
            className="hidden rounded-full px-4 py-2 text-[0.875rem] text-ink-soft transition-colors duration-400 ease-[var(--ease-spring)] hover:text-ink sm:block"
          >
            Dashboard
          </a>
          <a
            href="/methodology/kamino-liquidation-e0"
            className="hidden rounded-full px-4 py-2 text-[0.875rem] text-ink-soft transition-colors duration-400 ease-[var(--ease-spring)] hover:text-ink sm:block"
          >
            Methodology
          </a>
          <a
            href="/status"
            className="hidden rounded-full px-4 py-2 text-[0.875rem] text-ink-soft transition-colors duration-400 ease-[var(--ease-spring)] hover:text-ink sm:block"
          >
            Status
          </a>
          <a
            href="#how"
            className="rounded-full bg-ink px-5 py-2 text-[0.875rem] font-medium text-paper transition-colors duration-400 ease-[var(--ease-spring)] hover:bg-[#232720]"
          >
            How it settles
          </a>
        </div>
      </nav>
    </header>
  );
}
