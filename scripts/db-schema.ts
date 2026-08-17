/**
 * Applies sql/schema.sql through the Neon HTTP driver — no local psql needed.
 *
 * Usage: bun run db:schema
 */
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set — add it to .env first.");
  process.exit(1);
}

const sqlText = readFileSync(
  new URL("../sql/schema.sql", import.meta.url),
  "utf8",
);

// Neon's driver sends statements over HTTP; split on semicolons, skipping
// comments and empty statements. (Simple, safe splitter for our schema —
// no dollar-quoted bodies exist in schema.sql.)
const statements = sqlText
  .split(";")
  .map((s) =>
    s
      .split("\n")
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n")
      .trim(),
  )
  .filter((s) => s.length > 0);

const sql = neon(url);
let ok = 0;
for (const statement of statements) {
  try {
    // DDL has no placeholders — use the conventional query() API (the
    // tagged-template form is for interpolated values).
    await sql.query(statement);
    ok++;
  } catch (error) {
    // "already exists" errors are fine on re-run — idempotent-ish apply.
    const message = error instanceof Error ? error.message : String(error);
    if (!/already exists|duplicate key/.test(message)) {
      console.error(
        `✗ statement failed:\n${statement.slice(0, 120)}…\n  ${message}`,
      );
      process.exit(1);
    }
  }
}
console.log(
  `✓ schema applied (${ok} statements; 'already exists' errors ignored)`,
);
