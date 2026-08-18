import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema.ts";

/**
 * Drizzle client. Type-safe query builder + `sql` template tag (parameterized,
 * no injection surface) + `db.batch()` for atomic multi-writes in one Neon
 * HTTP round trip. Schema (./schema.ts) is the single source of truth for the
 * MCP server, the REST API, and the dashboard.
 */
export type Db = NeonHttpDatabase<typeof schema>;

let cached: Db | null = null;

/**
 * Lazy Drizzle client — protocol-only ops work without DATABASE_URL.
 * Accepts an explicit URL (e.g. from SvelteKit's $env/dynamic/private) and
 * falls back to process.env.DATABASE_URL.
 */
export function db(url?: string): Db {
  if (cached) return cached;
  const resolved = url ?? process.env.DATABASE_URL;
  if (!resolved) {
    throw new Error(
      "DATABASE_URL is not set — add it to .env (see .env.example) or run: fly secrets set DATABASE_URL=...",
    );
  }
  const client = neon(resolved);
  cached = drizzle({ client, schema });
  return cached;
}
