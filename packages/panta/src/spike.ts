#!/usr/bin/env bun
/**
 * Day-zero API spike.
 *
 * Replaces the guesses in schemas.ts with observed fact. Hits the live API with
 * a real key, writes every raw response to `fixtures/`, and prints the field
 * names actually returned so the schemas can be corrected against reality.
 *
 *   PANTA_API_KEY=pk_test_… bun run packages/panta/src/spike.ts
 *
 * Read-only by default. Nothing here creates a market, places a trade or
 * spends USDC — probing an API should never cost money by accident.
 *
 * The single most important output is whether the creation quote accepts an
 * `oracle` field carrying our methodology URL. The resolution-agnostic
 * invariant in ARCHITECTURE.md §3 depends on it, and every downstream design
 * decision assumes it holds.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { createLogger } from "@premium/core";
import { PantaHttp } from "./http.ts";
import { PATHS } from "./client.ts";

const log = createLogger("spike");
const FIXTURES = `${import.meta.dir}/../fixtures`;

/** Field names at every level, so nested shapes are visible at a glance. */
function describeShape(value: unknown, prefix = "", depth = 0): string[] {
  if (depth > 3 || value === null || typeof value !== "object") return [];
  if (Array.isArray(value)) {
    return value.length > 0 ? describeShape(value[0], `${prefix}[]`, depth + 1) : [];
  }
  const out: string[] = [];
  for (const [k, v] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${k}` : k;
    const kind = v === null ? "null" : Array.isArray(v) ? "array" : typeof v;
    out.push(`${path}: ${kind}`);
    out.push(...describeShape(v, path, depth + 1));
  }
  return out;
}

async function probe(http: PantaHttp, name: string, path: string): Promise<void> {
  try {
    const body = await http.get<unknown>(path);
    await writeFile(`${FIXTURES}/${name}.json`, JSON.stringify(body, null, 2));
    const shape = describeShape(body);
    log.info(`✓ ${name}`, { path, fields: shape.length });
    for (const line of shape.slice(0, 40)) console.log(`      ${line}`);
  } catch (error) {
    // A failure is a result too: it tells us the route or the auth is wrong.
    log.error(`✗ ${name}`, { path, error });
  }
}

async function main(): Promise<void> {
  const apiKey = process.env.PANTA_API_KEY;
  if (!apiKey) {
    console.error(
      "PANTA_API_KEY is not set.\n\n" +
        "  1. Register at https://panta.market and mint a pk_test_ key\n" +
        "  2. PANTA_API_KEY=pk_test_… bun run packages/panta/src/spike.ts\n",
    );
    process.exit(1);
  }

  await mkdir(FIXTURES, { recursive: true });
  const http = new PantaHttp({ logger: log, maxRetries: 1 });

  log.info("probing read-only endpoints", {
    baseUrl: process.env.PANTA_API_BASE_URL ?? "https://live-api.panta.market/api/v1",
  });

  await probe(http, "whoami", PATHS.whoami);
  await probe(http, "markets", PATHS.markets);
  await probe(http, "positions", `${PATHS.positions}?wallet=11111111111111111111111111111111`);

  // Market detail needs a real id, so take one from the listing.
  try {
    const list = await http.get<unknown>(PATHS.markets);
    const first = Array.isArray(list)
      ? list[0]
      : (list as { results?: unknown[] })?.results?.[0];
    const id = (first as { id?: string | number })?.id;
    if (id !== undefined) await probe(http, "market-detail", PATHS.market(id));
    else log.warn("no markets returned, skipping detail probe");
  } catch (error) {
    log.error("could not resolve a market id", { error });
  }

  console.log(`
────────────────────────────────────────────────────────────────
Raw responses written to packages/panta/fixtures/

Still to confirm by hand — these cannot be probed read-only:

  1. Does the creation quote accept `oracle` as our methodology URL?
     THE critical one. The whole resolution design rests on it.

  2. Exact route for create quote / build / register.
     Currently guessed as ${PATHS.createQuote}, ${PATHS.createBuild},
     ${PATHS.createRegister}.

  3. Is the creation fee an integer base-units string, and the primary
     buy a decimal string? ARCHITECTURE.md §7 says yes; verify it.

  4. Bonding curve, parimutuel, or CLOB? Panta's docs say bonding curve.
     Confirm in #dev-chat before the pitch claims it.

Then correct packages/panta/src/schemas.ts and PATHS in client.ts,
and re-run: bun test packages/panta
────────────────────────────────────────────────────────────────
`);
}

await main();
