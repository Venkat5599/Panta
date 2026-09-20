import { PantaClient, positionsOf } from "@premium/panta";

/**
 * Positions for a wallet, proxied from Panta.
 *
 * Proxied rather than called from the browser so the API key stays server-side.
 * The playground keeps its key in localStorage, which is fine for a demo and
 * wrong for anything holding real value.
 *
 * When the key is absent this says so explicitly instead of returning an empty
 * list. An empty list means "this wallet holds nothing", which is a different
 * fact from "we cannot currently tell", and a dashboard that conflates the two
 * is lying to the person reading it.
 */

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const wallet = new URL(request.url).searchParams.get("wallet")?.trim();

  if (!wallet) {
    return Response.json({ error: "wallet is required" }, { status: 400 });
  }

  // Base58, 32-byte pubkeys land in this length range. Cheap guard against
  // sending obvious junk upstream.
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(wallet)) {
    return Response.json(
      { error: "that does not look like a Solana address" },
      { status: 400 },
    );
  }

  if (!process.env.PANTA_API_KEY) {
    return Response.json(
      {
        configured: false,
        positions: [],
        reason:
          "PANTA_API_KEY is not set on this deployment, so positions cannot be read yet.",
      },
      { status: 503 },
    );
  }

  try {
    const panta = new PantaClient();
    const positions = positionsOf(await panta.getPositions(wallet));
    return Response.json({ configured: true, wallet, positions });
  } catch (error) {
    return Response.json(
      {
        configured: true,
        positions: [],
        error: error instanceof Error ? error.message : "upstream request failed",
      },
      { status: 502 },
    );
  }
}
