import { z } from "zod";

/**
 * Configuration, validated once at boot.
 *
 * The factory is expected to run unattended for three weeks, so a missing or
 * malformed variable must fail loudly on the first second rather than at 3am
 * during the one epoch boundary that mattered. Everything is required unless
 * there is a genuinely safe default.
 */

const RiskConfig = z.object({
  protocol: z.string().regex(/^[a-z0-9-]+$/),
  programId: z.string().min(32),
  riskClass: z.enum(["liquidation", "utilization"]),
  /** Metric threshold in USDC base units, as an integer string. */
  thresholdBaseUnits: z.string().regex(/^\d+$/),
});
export type RiskConfig = z.infer<typeof RiskConfig>;

const Env = z.object({
  PANTA_API_BASE_URL: z.string().url().default("https://live-api.panta.market/api/v1"),
  PANTA_API_KEY: z.string().min(1, "mint a key at panta.market — the factory cannot run without one"),
  PANTA_USER_ID: z.string().optional(),

  RPC_URL: z.string().url("set a Helius or RPC Fast endpoint"),

  /**
   * Path to the factory's hot wallet.
   *
   * Never inlined as an env var: a keypair in the environment leaks into
   * process listings, crash dumps and log aggregators. A file with 600 perms
   * that only this unit can read is the smaller blast radius. Fund it with the
   * epoch budget only.
   */
  FACTORY_KEYPAIR_PATH: z.string().min(1),

  TURSO_DATABASE_URL: z.string().default("file:local.db"),
  TURSO_AUTH_TOKEN: z.string().optional(),

  /** USDC placed on our own curve at each market open. Always labelled as ours (X3). */
  SEED_USDC: z.coerce.number().nonnegative().default(50),

  /** Health server port. The watchdog polls this from outside the box. */
  HEALTH_PORT: z.coerce.number().int().positive().default(8787),

  /** Minutes between ticks. The epoch boundary is weekly; this only affects latency to it. */
  TICK_MINUTES: z.coerce.number().int().positive().default(5),

  /**
   * Refuse to create markets whose epoch index is below this.
   *
   * Guards against a clock skew or a genesis change causing the factory to
   * wake up and backfill months of markets, each of which costs a real fee.
   */
  MIN_EPOCH_INDEX: z.coerce.number().int().nonnegative().default(0),

  /** Hard ceiling on markets created in one boot. Backstop against a runaway loop. */
  MAX_CREATES_PER_BOOT: z.coerce.number().int().positive().default(4),

  DRY_RUN: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
});

export type Config = z.infer<typeof Env> & { risks: RiskConfig[] };

/**
 * MVP scope: Kamino liquidation only.
 *
 * PRD.md P2 allows Kamino and Drift, and TODO.md cuts that to one question
 * type for a solo build. The factory reads this list rather than hard-coding a
 * market, so widening scope is a config change with no new code — which is the
 * "risk market factory, not one market type" claim in PREMIUM.md §6.
 */
const DEFAULT_RISKS: RiskConfig[] = [
  {
    protocol: "kamino",
    programId: "KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD",
    riskClass: "liquidation",
    // $2,000,000 in USDC base units.
    thresholdBaseUnits: "2000000000000",
  },
];

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = Env.safeParse(env);
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((i) => `  ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`Factory configuration is invalid:\n${problems}\n`);
  }
  return { ...parsed.data, risks: DEFAULT_RISKS };
}
