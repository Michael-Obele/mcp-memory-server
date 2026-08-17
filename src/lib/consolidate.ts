import type { Db } from "../db.ts";
import {
  PURGE_AFTER_DAYS,
  STALE_AFTER_DAYS,
  STALE_IMPORTANCE,
} from "@memory/shared";

export interface ConsolidateResult {
  archived_stale: number;
  archived_duplicates: number;
  purged: number;
}

/**
 * Idempotent maintenance sweep — pure SQL, no LLM calls, no embeddings.
 *
 * 1. Archive stale: importance < 0.3 AND untouched for 90 days.
 * 2. Dedup: per namespace, trimmed case-insensitive exact content match —
 *    keep the highest importance (tie: oldest), archive the rest.
 * 3. Purge: hard-delete rows archived for more than 30 days.
 */
export async function consolidate(db: Db): Promise<ConsolidateResult> {
  const stale = await db`
    UPDATE memories SET archived = true, updated_at = now()
    WHERE NOT archived
      AND importance < ${STALE_IMPORTANCE}
      AND updated_at < now() - (${STALE_AFTER_DAYS} * interval '1 day')
    RETURNING id
  `;

  const duplicates = await db`
    UPDATE memories m SET archived = true, updated_at = now()
    WHERE NOT m.archived AND EXISTS (
      SELECT 1 FROM memories k
      WHERE k.namespace_id = m.namespace_id
        AND lower(btrim(k.content)) = lower(btrim(m.content))
        AND (
          k.importance > m.importance
          OR (k.importance = m.importance AND k.created_at < m.created_at)
          OR (k.importance = m.importance AND k.created_at = m.created_at AND k.id < m.id)
        )
    )
    RETURNING id
  `;

  const purged = await db`
    DELETE FROM memories
    WHERE archived AND updated_at < now() - (${PURGE_AFTER_DAYS} * interval '1 day')
    RETURNING id
  `;

  return {
    archived_stale: stale.length,
    archived_duplicates: duplicates.length,
    purged: purged.length,
  };
}
