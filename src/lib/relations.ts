import type { Db } from "../db.ts";
import { MemoryError } from "../db.ts";

export interface RelationCreateInput {
  source_id: string;
  target_id: string;
  relation_type: string;
  weight?: number;
}

/**
 * Create a relation. On UNIQUE(source, target, relation_type) conflict the
 * weight is UPDATED instead of erroring (per spec).
 */
export async function createRelation(db: Db, input: RelationCreateInput) {
  const source =
    await db`SELECT namespace_id FROM entities WHERE id = ${input.source_id} LIMIT 1`;
  if (!source[0]) {
    throw new MemoryError("not_found", `entity '${input.source_id}' not found`);
  }
  const target =
    await db`SELECT namespace_id FROM entities WHERE id = ${input.target_id} LIMIT 1`;
  if (!target[0]) {
    throw new MemoryError("not_found", `entity '${input.target_id}' not found`);
  }
  if (input.source_id === input.target_id) {
    throw new MemoryError(
      "invalid_input",
      "source_id and target_id must differ",
    );
  }
  // Relations live in the source entity's namespace.
  const namespaceId = String(source[0].namespace_id);
  const rows = await db`
    INSERT INTO relations (namespace_id, source_id, target_id, relation_type, weight)
    VALUES (${namespaceId}, ${input.source_id}, ${input.target_id},
            ${input.relation_type}, ${input.weight ?? 0.5})
    ON CONFLICT (source_id, target_id, relation_type)
    DO UPDATE SET weight = EXCLUDED.weight
    RETURNING *
  `;
  return rows[0];
}

export async function deleteRelation(db: Db, id: string) {
  const res = await db`DELETE FROM relations WHERE id = ${id} RETURNING id`;
  const row = res[0];
  if (!row) throw new MemoryError("not_found", `relation '${id}' not found`);
  return row;
}

/** List relations: in + out for one entity, or all relations in a namespace. */
export async function listRelations(
  db: Db,
  opts: { entity_id?: string; namespace?: string } = {},
) {
  if (opts.entity_id) {
    const rows = await db`
      SELECT r.*, s.name AS source_name, t.name AS target_name,
             s.type AS source_type, t.type AS target_type
      FROM relations r
      JOIN entities s ON s.id = r.source_id
      JOIN entities t ON t.id = r.target_id
      WHERE r.source_id = ${opts.entity_id} OR r.target_id = ${opts.entity_id}
      ORDER BY r.weight DESC, r.created_at DESC
    `;
    return rows;
  }
  if (opts.namespace) {
    const rows = await db`
      SELECT r.*, s.name AS source_name, t.name AS target_name,
             s.type AS source_type, t.type AS target_type
      FROM relations r
      JOIN namespaces n ON n.id = r.namespace_id
      JOIN entities s ON s.id = r.source_id
      JOIN entities t ON t.id = r.target_id
      WHERE n.name = ${opts.namespace}
      ORDER BY r.weight DESC, r.created_at DESC
    `;
    return rows;
  }
  const rows = await db`
    SELECT r.*, s.name AS source_name, t.name AS target_name,
           s.type AS source_type, t.type AS target_type
    FROM relations r
    JOIN entities s ON s.id = r.source_id
    JOIN entities t ON t.id = r.target_id
    ORDER BY r.weight DESC, r.created_at DESC
    LIMIT 200
  `;
  return rows;
}
