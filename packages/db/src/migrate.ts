import { migrate } from "drizzle-orm/libsql/migrator";
import type { Database } from "./client.ts";

/**
 * Apply migrations.
 *
 * The folder is resolved relative to this file, so callers never hard-code a
 * path into the package — that path broke the moment an app lived at a
 * different depth in the tree.
 */
export function runMigrations(db: Database): Promise<void> {
  return migrate(db, { migrationsFolder: `${import.meta.dir}/../migrations` });
}
