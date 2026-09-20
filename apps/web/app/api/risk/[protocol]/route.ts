import { epochAt } from "@premium/core";

/**
 * The embeddable public risk price (PRD.md B12).
 *
 * Deliberately a plain JSON endpoint with permissive CORS: the whole point is
 * that a lending protocol or a treasury can consume the number without asking
 * us for anything. That is what makes it infrastructure rather than a dashboard.
 */

export const dynamic = "force-dynamic";

const SUPPORTED = ["kamino", "drift"] as const;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ protocol: string }> },
) {
  const { protocol } = await params;
  const key = protocol.toLowerCase();

  if (!SUPPORTED.includes(key as (typeof SUPPORTED)[number])) {
    return Response.json(
      { error: `unsupported protocol: ${protocol}`, supported: SUPPORTED },
      { status: 404 },
    );
  }

  const epoch = epochAt();

  // `price` stays null until a market actually trades. Emitting an invented
  // number here would be the worst possible failure for a risk oracle: a
  // downstream consumer cannot tell a placeholder from a real price, and might
  // set an LTV against it.
  return Response.json(
    {
      protocol: key,
      riskClass: "liquidation",
      epoch: {
        index: epoch.index,
        label: epoch.label,
        endsAt: epoch.endsAt.toISOString(),
      },
      price: null,
      status: "no-market-open",
      note: "Carries a market-implied probability in [0,1] once a market opens.",
      methodology: `/methodology/${key}-liquidation-e${epoch.index}`,
    },
    {
      headers: {
        "access-control-allow-origin": "*",
        "cache-control": "public, max-age=30, stale-while-revalidate=120",
      },
    },
  );
}
