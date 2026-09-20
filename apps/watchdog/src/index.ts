/**
 * External watchdog.
 *
 * Runs on Cloudflare, deliberately NOT on the VPS that runs the factory.
 * ARCHITECTURE.md §5: a watchdog inside the thing it watches is decoration —
 * it cannot report that the process is gone, and it dies with the box.
 *
 * It checks two independent things and alerts on either:
 *
 *   1. Is the factory's health endpoint reachable and reporting a fresh tick?
 *   2. Does the current epoch's market actually exist in Panta?
 *
 * The second matters because the first can lie by omission: a factory that is
 * up, ticking, and silently failing to create markets looks healthy from the
 * outside. Asking Panta directly is the check that cannot be fooled by a bug
 * in our own code.
 */

interface Env {
  /** Factory /health, e.g. https://premium.example.com/health */
  HEARTBEAT_URL: string;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_CHAT_ID: string;
  PANTA_API_BASE_URL?: string;
  PANTA_API_KEY?: string;
  /** Minutes without a tick before we escalate. */
  STALE_MINUTES?: string;
}

interface HealthPayload {
  ok?: boolean;
  lastTickAt?: number | null;
  lastTickError?: string | null;
  balanceLamports?: number | null;
  currentEpoch?: { index: number; label: string; endsAt: string };
  currentEpochCovered?: boolean;
  lastMarket?: { slug: string; epochIndex: number } | null;
}

const LAMPORTS_PER_SOL = 1_000_000_000;
const LOW_BALANCE_SOL = 0.05;
const DEFAULT_STALE_MINUTES = 20;

/** Telegram over SMS: free, instant, and a phone push rather than a log line. */
async function alert(env: Env, lines: string[]): Promise<void> {
  const text = lines.join("\n");
  const response = await fetch(
    `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: env.TELEGRAM_CHAT_ID,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    },
  );
  if (!response.ok) {
    // Nothing to escalate to from here; make it visible in `wrangler tail`.
    console.error("telegram send failed", response.status, await response.text());
  }
}

async function fetchHealth(url: string): Promise<HealthPayload | { error: string }> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
      headers: { accept: "application/json" },
    });
    if (!response.ok) return { error: `health returned ${response.status}` };
    return (await response.json()) as HealthPayload;
  } catch (error) {
    // Unreachable is the single most important signal: the box is gone.
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Independent confirmation from Panta.
 *
 * Deliberately does not trust our own health endpoint. If the factory is
 * confidently wrong, this is what catches it.
 */
async function currentEpochMarketExists(
  env: Env,
  epochIndex: number,
): Promise<boolean | null> {
  if (!env.PANTA_API_KEY) return null; // not configured; skip rather than false-alarm
  try {
    const base = env.PANTA_API_BASE_URL ?? "https://live-api.panta.market/api/v1";
    const response = await fetch(`${base}/markets/`, {
      headers: { "X-Api-Key": env.PANTA_API_KEY, accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as unknown;
    const list = Array.isArray(body)
      ? body
      : ((body as { results?: unknown[] }).results ?? []);
    return list.some(
      (m) => typeof (m as { slug?: string }).slug === "string" &&
        (m as { slug: string }).slug.endsWith(`-e${epochIndex}`),
    );
  } catch {
    return null;
  }
}

async function check(env: Env): Promise<void> {
  const staleMinutes = Number(env.STALE_MINUTES ?? DEFAULT_STALE_MINUTES);
  const health = await fetchHealth(env.HEARTBEAT_URL);

  if ("error" in health) {
    await alert(env, [
      "🚨 <b>PREMIUM factory unreachable</b>",
      `<code>${health.error}</code>`,
      "",
      "The box may be down, or the service may have failed to restart.",
      `Check: <code>systemctl status premium-factory</code>`,
    ]);
    return;
  }

  const problems: string[] = [];

  if (health.lastTickAt) {
    const ageMinutes = (Date.now() - health.lastTickAt) / 60_000;
    if (ageMinutes > staleMinutes) {
      problems.push(`Last tick was ${Math.round(ageMinutes)} minutes ago (limit ${staleMinutes}).`);
    }
  } else {
    problems.push("The factory has never completed a tick since boot.");
  }

  if (health.lastTickError) {
    problems.push(`Last tick reported: <code>${health.lastTickError}</code>`);
  }

  if (health.currentEpochCovered === false) {
    problems.push(
      `No market for the current epoch (${health.currentEpoch?.label ?? "unknown"}).`,
    );
  }

  if (
    typeof health.balanceLamports === "number" &&
    health.balanceLamports < LOW_BALANCE_SOL * LAMPORTS_PER_SOL
  ) {
    problems.push(
      `Wallet balance is ${(health.balanceLamports / LAMPORTS_PER_SOL).toFixed(4)} SOL. ` +
        "Fund it before the next epoch boundary.",
    );
  }

  // Cross-check against Panta. Catches a factory that is healthy and wrong.
  if (health.currentEpoch) {
    const exists = await currentEpochMarketExists(env, health.currentEpoch.index);
    if (exists === false) {
      problems.push(
        `Panta has no market ending in <code>-e${health.currentEpoch.index}</code>, ` +
          "even though the factory reports healthy.",
      );
    }
  }

  if (problems.length === 0) return; // quiet when healthy; noise trains you to ignore it

  await alert(env, [
    "⚠️ <b>PREMIUM factory needs attention</b>",
    "",
    ...problems.map((p) => `• ${p}`),
    "",
    `Epoch: ${health.currentEpoch?.label ?? "unknown"}`,
    `Last market: ${health.lastMarket?.slug ?? "none"}`,
  ]);
}

export default {
  /** Cron trigger. Schedule lives in wrangler.toml. */
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(check(env));
  },

  /** Manual probe, so the alert path can be tested without waiting for cron. */
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname === "/check") {
      await check(env);
      return new Response("checked\n");
    }
    if (pathname === "/test-alert") {
      await alert(env, ["✅ PREMIUM watchdog test alert — the alert path works."]);
      return new Response("sent\n");
    }
    return new Response("premium watchdog\n");
  },
};
