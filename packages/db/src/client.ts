import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema.ts";

export type Database = ReturnType<typeof createDatabase>;

/**
 * Turso when configured, a local file otherwise.
 *
 * The local fallback exists so tests and a first run need no network and no
 * credentials — a developer cloning this repo should be able to run the suite
 * immediately. Production always passes a real URL.
 */
export function createDatabase(
  url = process.env.TURSO_DATABASE_URL ?? "file:local.db",
  authToken = process.env.TURSO_AUTH_TOKEN,
) {
  const client = createClient(authToken ? { url, authToken } : { url });
  return drizzle(client, { schema });
}

export { schema };
