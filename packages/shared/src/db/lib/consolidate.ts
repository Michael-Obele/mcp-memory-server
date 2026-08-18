import type { Db } from "../client.ts";
import { sql } from "drizzle-orm";
import { memories } from "../schema.ts";
import {
  PURGE_AFTER_DAYS,
  STALE_AFTER_DAYS,
  STALE_IMPORTANCE,
} from "../../types.ts";

export interface ConsolidateResult {
  archived_stale: number;
  archived_duplicates: number;
  purged: number;
}

/**
 * Idempotent maintenance sweep — pure SQL, no LLM calls.
 * 1. Archive stale (importance < 0.3, untouched 90d).
 * 2. Dedup per namespace (trimmed case-insensitive content; keep highest
 *    importance, tie: oldest).
 * 3. Purge archived rows older than 30d.
 */
export async function consolidate(db: Db): Promise<ConsolidateResult> {
  const stale = await db.execute(sql`
    UPDATE ${memories} SET archived = true, updated_at = now()
    WHERE NOT archived
      AND importance < ${STALE_IMPORTANCE}
      AND updated_at < now() - (${STALE_AFTER_DAYS} * interval '1 day')
    RETURNING id
  `);

  const duplicates = await db.execute(sql`
    UPDATE ${memories} m SET archived = true, updated_at = now()
    WHERE NOT m.archived AND EXISTS (
      SELECT 1 FROM ${memories} k
      WHERE k.namespace_id = m.namespace_id
        AND lower(btrim(k.content)) = lower(btrim(m.content))
        AND (
          k.importance > m.importance
          OR (k.importance = m.importance AND k.created_at < m.created_at)
          OR (k.importance = m.importance AND k.created_at = m.created_at AND k.id < m.id)
        )
    )
    RETURNING id
  `);

  const purged = await db.execute(sql`
    DELETE FROM ${memories}
    WHERE archived AND updated_at < now() - (${PURGE_AFTER_DAYS} * interval '1 day')
    RETURNING id
  `);

  return {
    archived_stale: stale.rows.length,
    archived_duplicates: duplicates.rows.length,
    purged: purged.rows.length,
  };
}
