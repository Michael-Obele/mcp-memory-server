/**
 * Baselines an EXISTING database against the drizzle migration history.
 *
 * The live Neon DB already has the full schema (from the original
 * `sql/schema.sql`), but it has no `__drizzle_migrations` tracking table. If
 * you ran `drizzle-kit migrate` directly it would try to re-apply
 * `drizzle/0000_*.sql` and fail on `CREATE TABLE` (no IF NOT EXISTS).
 *
 * This script creates the tracking table and marks `0000` (the baseline) as
 * already applied, so a subsequent `bun run db:migrate` applies only the
 * pending migrations (currently `0001` — constraints + trigram indexes).
 *
 * Order for an existing DB:
 *   bun run db:cleanup    # repair data that would violate the new constraints
 *   bun run db:baseline   # mark 0000 as applied (this script)
 *   bun run db:migrate    # apply 0001
 *
 * Idempotent — safe to re-run. Uses Bun.sql (TCP) so it works against both a
 * local Postgres and Neon's pooled connection string.
 */
import { SQL } from "bun";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const sql = new SQL(process.env.DATABASE_URL!);

async function main() {
  // 1. Create the tracking table exactly as drizzle-kit does.
  await sql`
    CREATE SCHEMA IF NOT EXISTS drizzle
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
      id         SERIAL PRIMARY KEY,
      hash       TEXT NOT NULL,
      created_at BIGINT
    )
  `;

  // 2. Compute the hash of the baseline migration (sha256 of raw file content,
  //    matching drizzle-orm's readMigrationFiles).
  const file = resolve(import.meta.dir, "../drizzle/0000_deep_tony_stark.sql");
  const content = readFileSync(file, "utf8");
  const hash = createHash("sha256").update(content).digest("hex");

  // 3. drizzle-kit migrate decides what to apply by TIMESTAMP, not hash: it
  //    applies any journal entry whose `when` is newer than the last tracked
  //    migration's created_at. So the baseline row must use the journal's
  //    `when` for 0000 — NOT Date.now(), or drizzle-kit will think every
  //    later migration is already applied and skip them.
  const journal = JSON.parse(
    readFileSync(
      resolve(import.meta.dir, "../drizzle/meta/_journal.json"),
      "utf8",
    ),
  );
  const entry = journal.entries.find(
    (e: { tag: string }) => e.tag === "0000_deep_tony_stark",
  );
  if (!entry) {
    throw new Error(
      "0000_deep_tony_stark not found in drizzle/meta/_journal.json",
    );
  }
  const created_at = entry.when as number;

  // 4. Insert the baseline row if not already present.
  const existing = await sql`
    SELECT id FROM drizzle.__drizzle_migrations WHERE hash = ${hash}
  `;
  if (existing.length === 0) {
    await sql`
      INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
      VALUES (${hash}, ${created_at})
    `;
    console.log("baselined 0000_deep_tony_stark.sql");
  } else {
    console.log("baseline already present — nothing to do");
  }

  const rows =
    await sql`SELECT id, hash, created_at FROM drizzle.__drizzle_migrations ORDER BY id`;
  console.log(`tracked migrations: ${rows.length}`);
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
