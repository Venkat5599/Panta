import { type Logger, epochAt } from "@premium/core";
import type { Database } from "@premium/db";
import { desc, eq, heartbeats, markets } from "@premium/db";

/**
 * Liveness, exposed for an external watchdog.
 *
 * The watchdog runs on a different provider on purpose (ARCHITECTURE.md §5):
 * one inside the process it watches cannot report that the process is gone.
 * This endpoint only states facts; the judgement about whether they are bad
 * lives outside this box, where it survives this box dying.
 */

export interface HealthState {
  bootedAt: number;
  lastTickAt: number | null;
  lastTickError: string | null;
  wallet: string;
  balanceLamports: number | null;
}

export function createHealthServer(
  db: Database,
  state: HealthState,
  port: number,
  logger: Logger,
) {
  const server = Bun.serve({
    port,
    idleTimeout: 30,
    async fetch(request) {
      const { pathname } = new URL(request.url);

      if (pathname === "/health" || pathname === "/") {
        const currentEpoch = epochAt();
        const latest = await db
          .select()
          .from(markets)
          .orderBy(desc(markets.createdAt))
          .limit(1);
        const beat = await db.query.heartbeats.findFirst({
          where: eq(heartbeats.id, "factory"),
        });

        const lastMarket = latest[0];
        // The watchdog's actual question: is the market for the epoch we are
        // currently in present? Everything else is context for a human.
        const currentEpochCovered = lastMarket?.epochIndex === currentEpoch.index;

        return Response.json({
          ok: state.lastTickError === null && currentEpochCovered,
          bootedAt: state.bootedAt,
          uptimeSeconds: Math.floor((Date.now() - state.bootedAt) / 1000),
          lastTickAt: state.lastTickAt,
          lastTickError: state.lastTickError,
          lastHeartbeatAt: beat?.beatAt ?? null,
          wallet: state.wallet,
          balanceLamports: state.balanceLamports,
          currentEpoch: {
            index: currentEpoch.index,
            label: currentEpoch.label,
            endsAt: currentEpoch.endsAt.toISOString(),
          },
          currentEpochCovered,
          lastMarket: lastMarket
            ? {
                slug: lastMarket.slug,
                epochIndex: lastMarket.epochIndex,
                createdAt: lastMarket.createdAt,
                signature: lastMarket.creationSignature,
              }
            : null,
        });
      }

      return new Response("not found", { status: 404 });
    },
  });

  logger.info("health server listening", { port });
  return server;
}

/** Record a tick. The watchdog reads staleness of this through /health. */
export async function beat(db: Database, note: string): Promise<void> {
  await db
    .insert(heartbeats)
    .values({ id: "factory", beatAt: Date.now(), note })
    .onConflictDoUpdate({
      target: heartbeats.id,
      set: { beatAt: Date.now(), note },
    });
}
