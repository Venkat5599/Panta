import { epochStatus } from "@premium/core";
import { DashboardSidebar } from "@/components/DashboardSidebar";

/**
 * Dashboard shell.
 *
 * A real layout rather than tabs on one page, so every section has its own URL
 * and can be linked, bookmarked and shared. A judge should be able to be sent
 * straight to the attribution figures.
 */

export const dynamic = "force-dynamic";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { epoch, preGenesis } = epochStatus();
  const label = preGenesis ? `${epoch.label} · opens soon` : epoch.label;

  return (
    <div className="relative z-[2] min-h-screen px-5 py-4 sm:px-6">
      <div className="mx-auto grid max-w-[82rem] gap-6 lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-8">
        <DashboardSidebar epochLabel={label} />
        <main className="min-w-0 py-4 lg:py-6">{children}</main>
      </div>
    </div>
  );
}
