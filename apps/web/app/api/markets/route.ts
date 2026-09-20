import { epochStatus, marketSlug } from "@premium/core";
import { PantaClient, marketsOf } from "@premium/panta";

/**
 * Markets we have opened, as seen by Panta.
 *
 * The dashboard asks Panta rather than our own database on purpose: Panta is
 * the authority on what exists, and a market that is live but missing from our
 * cache must still appear here. It is the same reasoning the factory uses when
 * it decides whether to create.
 */

export const dynamic = "force-dynamic";

const PROTOCOLS = ["kamino", "drift"] as const;

interface ExpectedMarket {
  protocol: string;
  slug: string;
}

/** Shape used whenever Panta could not be consulted. Built explicitly rather
 * than spread inside a map, which allocates a fresh object per row for no gain. */
function unknownMarket(m: ExpectedMarket) {
  return { protocol: m.protocol, slug: m.slug, live: false };
}

export async function GET() {
  const { epoch, preGenesis } = epochStatus();

  // Slugs are derived, so we know what to look for without storing anything.
  const expected = PROTOCOLS.map((protocol) => ({
    protocol,
    slug: marketSlug(protocol, "liquidation", epoch.index),
  }));

  if (!process.env.PANTA_API_KEY) {
    return Response.json(
      {
        configured: false,
        epoch: { index: epoch.index, label: epoch.label, preGenesis },
        markets: expected.map(unknownMarket),
        reason: "PANTA_API_KEY is not set on this deployment.",
      },
      { status: 503 },
    );
  }

  try {
    const panta = new PantaClient();
    const live = marketsOf(await panta.listMarkets());
    const bySlug = new Map(live.map((m) => [m.slug, m]));

    return Response.json({
      configured: true,
      epoch: { index: epoch.index, label: epoch.label, preGenesis },
      markets: expected.map((m) => {
        const found = bySlug.get(m.slug);
        return {
          protocol: m.protocol,
          slug: m.slug,
          live: Boolean(found),
          id: found?.id ?? null,
          url: found?.url ?? null,
          status: found?.status ?? found?.phase ?? null,
        };
      }),
    });
  } catch (error) {
    return Response.json(
      {
        configured: true,
        epoch: { index: epoch.index, label: epoch.label, preGenesis },
        markets: expected.map(unknownMarket),
        error: error instanceof Error ? error.message : "upstream request failed",
      },
      { status: 502 },
    );
  }
}
