/**
 * Repairs data that would violate the new constraints in `drizzle/0001_*.sql`.
 *
 * Run BEFORE `bunx drizzle-kit migrate` on an existing DB (the live Neon DB
 * almost certainly has rows that violate the new constraints — duplicate
 * entities, out-of-range importance/weight, invalid memory types).
 *
 * Idempotent — safe to re-run. Uses Bun.sql (TCP) so it works against both a
 * local Postgres and Neon's pooled connection string.
 *
 *   bun run db:cleanup   # then: bunx drizzle-kit migrate
 */
import { SQL } from "bun";

const sql = new SQL(process.env.DATABASE_URL!);

async function main() {
  console.log(
    "1/4 — deduplicating entities (keep highest importance, oldest, lowest id)…",
  );

  // Re-point relations whose source/target is a duplicate entity.
  await sql`
    UPDATE relations r SET source_id = s.survivor_id
    FROM (
      SELECT id, first_value(id) OVER (
        PARTITION BY namespace_id, name
        ORDER BY importance DESC, created_at ASC, id ASC
      ) AS survivor_id
      FROM entities
    ) s
    WHERE r.source_id = s.id AND r.source_id <> s.survivor_id
  `;
  await sql`
    UPDATE relations r SET target_id = s.survivor_id
    FROM (
      SELECT id, first_value(id) OVER (
        PARTITION BY namespace_id, name
        ORDER BY importance DESC, created_at ASC, id ASC
      ) AS survivor_id
      FROM entities
    ) s
    WHERE r.target_id = s.id AND r.target_id <> s.survivor_id
  `;
  // Re-point memory links.
  await sql`
    UPDATE memory_entity_links l SET entity_id = s.survivor_id
    FROM (
      SELECT id, first_value(id) OVER (
        PARTITION BY namespace_id, name
        ORDER BY importance DESC, created_at ASC, id ASC
      ) AS survivor_id
      FROM entities
    ) s
    WHERE l.entity_id = s.id AND l.entity_id <> s.survivor_id
  `;
  // Delete duplicate entities.
  const del = await sql`
    DELETE FROM entities e
    USING (
      SELECT id, first_value(id) OVER (
        PARTITION BY namespace_id, name
        ORDER BY importance DESC, created_at ASC, id ASC
      ) AS survivor_id
      FROM entities
    ) s
    WHERE e.id = s.id AND e.id <> s.survivor_id
    RETURNING e.id
  `;
  console.log(`   removed ${del.length} duplicate entities`);

  // Re-pointing can create duplicate relations — dedupe those too.
  const dupRel = await sql`
    DELETE FROM relations r
    USING relations r2
    WHERE r.id > r2.id
      AND r.source_id = r2.source_id
      AND r.target_id = r2.target_id
      AND r.relation_type = r2.relation_type
    RETURNING r.id
  `;
  if (dupRel.length)
    console.log(`   removed ${dupRel.length} duplicate relations`);

  console.log("2/4 — clamping importance/weight into [0, 1]…");
  const m = await sql`
    UPDATE memories SET importance = LEAST(GREATEST(COALESCE(importance, 0.5), 0), 1)
    WHERE importance < 0 OR importance > 1 OR importance IS NULL RETURNING id
  `;
  const e = await sql`
    UPDATE entities SET importance = LEAST(GREATEST(COALESCE(importance, 0.5), 0), 1)
    WHERE importance < 0 OR importance > 1 OR importance IS NULL RETURNING id
  `;
  const r = await sql`
    UPDATE relations SET weight = LEAST(GREATEST(COALESCE(weight, 0.5), 0), 1)
    WHERE weight < 0 OR weight > 1 OR weight IS NULL RETURNING id
  `;
  console.log(
    `   clamped ${m.length} memories, ${e.length} entities, ${r.length} relations`,
  );

  console.log("3/4 — fixing invalid memory types…");
  const t = await sql`
    UPDATE memories SET type = 'fact'
    WHERE type NOT IN ('fact', 'observation', 'preference', 'instruction')
    RETURNING id
  `;
  console.log(`   fixed ${t.length} memories`);

  console.log("4/4 — done. Now run: bunx drizzle-kit migrate");
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
