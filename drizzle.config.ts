import { defineConfig } from "drizzle-kit";

/**
 * Drizzle Kit config. `schema` = source of truth (packages/shared/src/db/schema.ts),
 * `out` = generated migrations (drizzle/).
 *
 * Commands: db:generate | db:migrate | db:push | db:cleanup | db:baseline
 * (see package.json). Migrations use the `pg` driver (TCP) — the Neon HTTP
 * driver can't do transactions.
 */
export default defineConfig({
  out: "./drizzle",
  schema: "./packages/shared/src/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
