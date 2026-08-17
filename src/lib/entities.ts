import type { Db } from "../db.ts";
import { MemoryError } from "../db.ts";
import { resolveNamespaceId } from "./util.ts";

export interface EntityCreateInput {
  name: string;
  type: string;
  summary?: string;
  importance?: number;
  metadata?: Record<string, unknown>;
}

export interface EntityUpdateInput {
  name?: string;
  type?: string;
  summary?: string;
  importance?: number;
  metadata?: Record<string, unknown>;
}

export async function createEntity(
  db: Db,
  namespaceName: string,
  input: EntityCreateInput,
) {
  const namespaceId = await resolveNamespaceId(db, namespaceName);
  const rows = await db`
    INSERT INTO entities (namespace_id, name, type, summary, metadata, importance)
    VALUES (${namespaceId}, ${input.name}, ${input.type}, ${input.summary ?? ""},
            ${JSON.stringify(input.metadata ?? {})}, ${input.importance ?? 0.5})
    RETURNING *
  `;
  return rows[0];
}

/** Full entity detail: entity + linked memories + in/out relations. */
export async function getEntity(db: Db, id: string) {
  const rows = await db`
    SELECT e.*, n.name AS namespace
    FROM entities e
    JOIN namespaces n ON n.id = e.namespace_id
    WHERE e.id = ${id} LIMIT 1
  `;
  const entity = rows[0];
  if (!entity) throw new MemoryError("not_found", `entity '${id}' not found`);

  // Bump access count — feeds dashboard "top entities" stats.
  await db`UPDATE entities SET access_count = access_count + 1 WHERE id = ${id}`;

  const [memories, relationsOut, relationsIn] = await Promise.all([
    db`
      SELECT m.* FROM memories m
      JOIN memory_entity_links l ON l.memory_id = m.id
      WHERE l.entity_id = ${id} AND NOT m.archived
      ORDER BY m.importance DESC, m.updated_at DESC
    `,
    db`
      SELECT r.id, r.target_id AS other_id, r.relation_type, r.weight,
             e.name AS other_name, e.type AS other_type
      FROM relations r JOIN entities e ON e.id = r.target_id
      WHERE r.source_id = ${id} ORDER BY r.weight DESC
    `,
    db`
      SELECT r.id, r.source_id AS other_id, r.relation_type, r.weight,
             e.name AS other_name, e.type AS other_type
      FROM relations r JOIN entities e ON e.id = r.source_id
      WHERE r.target_id = ${id} ORDER BY r.weight DESC
    `,
  ]);

  return {
    ...entity,
    memories,
    relations_out: relationsOut,
    relations_in: relationsIn,
  };
}

export async function updateEntity(
  db: Db,
  id: string,
  update: EntityUpdateInput,
) {
  const sets: string[] = [];
  const params: unknown[] = [];
  const assign = (col: string, value: unknown) => {
    params.push(value);
    sets.push(`${col} = $${params.length}`);
  };
  if (update.name !== undefined) assign("name", update.name);
  if (update.type !== undefined) assign("type", update.type);
  if (update.summary !== undefined) assign("summary", update.summary);
  if (update.importance !== undefined) assign("importance", update.importance);
  if (update.metadata !== undefined)
    assign("metadata", JSON.stringify(update.metadata));
  if (sets.length === 0) {
    throw new MemoryError("invalid_input", "no fields to update");
  }
  sets.push("updated_at = now()");
  params.push(id);

  const rows = await db.query(
    `UPDATE entities SET ${sets.join(", ")} WHERE id = $${params.length} RETURNING *`,
    params,
  );
  const row = rows[0];
  if (!row) throw new MemoryError("not_found", `entity '${id}' not found`);
  return row;
}

export async function deleteEntity(db: Db, id: string) {
  const res =
    await db`DELETE FROM entities WHERE id = ${id} RETURNING id, name`;
  const row = res[0];
  if (!row) throw new MemoryError("not_found", `entity '${id}' not found`);
  return row;
}

/** Find entities by name (exact or substring) with optional type + namespace filters. */
export async function findEntities(
  db: Db,
  namespaceName: string | undefined,
  query: string | undefined,
  type: string | undefined,
  limit = 10,
) {
  const where: string[] = [];
  const params: unknown[] = [];
  if (query !== undefined) {
    params.push(`%${query}%`);
    where.push(`e.name ILIKE $${params.length}`);
  }
  if (type !== undefined) {
    params.push(type);
    where.push(`e.type = $${params.length}`);
  }
  if (namespaceName !== undefined) {
    const nsId = await resolveNamespaceId(db, namespaceName);
    params.push(nsId);
    where.push(`e.namespace_id = $${params.length}`);
  }
  params.push(Math.min(limit, 10));
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  return db.query(
    `SELECT e.*, n.name AS namespace FROM entities e
     JOIN namespaces n ON n.id = e.namespace_id
     ${whereSql}
     ORDER BY e.importance DESC, e.updated_at DESC
     LIMIT $${params.length}`,
    params,
  );
}
