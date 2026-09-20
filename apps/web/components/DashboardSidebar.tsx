"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

/**
 * Dashboard sidebar.
 *
 * The active item is marked by type weight and a surface shift, never by a dot
 * tacked underneath. A lone dot is decoration standing in for a real active
 * state.
 *
 * On narrow screens this becomes a horizontally scrollable strip rather than a
 * hamburger: there are six destinations, they all fit, and a drawer would hide
 * navigation behind an interaction for no gain.
 */

interface Item {
  href: string;
  label: string;
  hint: string;
}

const PRIMARY: Item[] = [
  { href: "/dashboard", label: "Overview", hint: "This week at a glance" },
  { href: "/dashboard/markets", label: "Markets", hint: "Open and past epochs" },
  { href: "/dashboard/positions", label: "Positions", hint: "Any wallet, public data" },
  { href: "/dashboard/attribution", label: "Attribution", hint: "Volume driven through Panta" },
];

const SECONDARY: Item[] = [
  { href: "/methodology/kamino-liquidation-e0", label: "Methodology", hint: "" },
  { href: "/status", label: "Factory status", hint: "" },
];

function NavLink({ item, active }: { item: Item; active: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`block rounded-[0.75rem] px-3.5 py-2.5 transition-colors duration-400 ease-[var(--ease-spring)] ${
        active
          ? "bg-surface text-ink shadow-[0_1px_2px_rgb(17_19_15_/_0.05)]"
          : "text-ink-soft hover:bg-surface/60 hover:text-ink"
      }`}
    >
      <span className={`block text-[0.9375rem] ${active ? "font-medium" : ""}`}>
        {item.label}
      </span>
      {item.hint ? (
        <span className="mt-0.5 block text-[0.75rem] leading-snug text-muted">
          {item.hint}
        </span>
      ) : null}
    </Link>
  );
}

export function DashboardSidebar({ epochLabel }: { epochLabel: string }) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);

  return (
    <>
      {/* Desktop rail */}
      <aside className="hidden lg:flex lg:h-[calc(100vh-2rem)] lg:flex-col lg:sticky lg:top-4">
        <div className="flex h-full flex-col rounded-[1.5rem] bg-[#e3e6da] p-3">
          <Link href="/" className="block px-3.5 pt-2 pb-4">
            <span className="block text-[1rem] font-semibold tracking-[-0.02em] text-ink">
              PREMIUM
            </span>
            <span className="mt-0.5 block font-mono text-[0.75rem] text-muted">
              {epochLabel}
            </span>
          </Link>

          <nav className="space-y-1" aria-label="Dashboard">
            {PRIMARY.map((item) => (
              <NavLink key={item.href} item={item} active={isActive(item.href)} />
            ))}
          </nav>

          <div className="my-4 h-px bg-[rgb(17_19_15_/_0.07)]" />

          <nav className="space-y-1" aria-label="Reference">
            {SECONDARY.map((item) => (
              <NavLink key={item.href} item={item} active={isActive(item.href)} />
            ))}
          </nav>

          <div className="mt-auto px-3.5 pb-1 pt-4">
            <a
              href="https://panta.market"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-[0.75rem] text-muted transition-colors duration-400 hover:text-ink"
            >
              Powered by Panta
              <svg width="9" height="9" viewBox="0 0 11 11" fill="none" aria-hidden>
                <path
                  d="M2 9L9 2M9 2H3.5M9 2V7.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </a>
          </div>
        </div>
      </aside>

      {/* Narrow-screen strip. Every destination stays reachable without a drawer. */}
      <div className="lg:hidden">
        <div className="flex items-baseline justify-between px-1 pb-3">
          <Link href="/" className="text-[1rem] font-semibold tracking-[-0.02em] text-ink">
            PREMIUM
          </Link>
          <span className="font-mono text-[0.75rem] text-muted">{epochLabel}</span>
        </div>
        <nav
          aria-label="Dashboard"
          className="-mx-5 flex gap-1.5 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {[...PRIMARY, ...SECONDARY].map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`shrink-0 rounded-full px-4 py-2 text-[0.875rem] whitespace-nowrap transition-colors duration-400 ease-[var(--ease-spring)] ${
                  active
                    ? "bg-ink font-medium text-paper"
                    : "bg-[#e3e6da] text-ink-soft"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );
}
