export * from "./schema.ts";
export * from "./client.ts";

/**
 * Re-exported query helpers.
 *
 * Apps depend on @premium/db, never on drizzle directly, so the ORM stays an
 * implementation detail of this package and the migrations folder is resolved
 * here rather than through a fragile relative path from each caller.
 */
export { and, asc, desc, eq, gte, inArray, lte, or, sql, sum } from "drizzle-orm";
export { runMigrations } from "./migrate.ts";
