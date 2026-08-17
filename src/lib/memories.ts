import type { Db } from "../db.ts";
import { MemoryError } from "../db.ts";
import { resolveNamespaceId } from "./util.ts";

export interface MemoryCreateInput {
  content: string;
  type?: "fact" | "observation" | "preference" | "instruction";
  importance?: number;
  namespace?: string;
  entity_ids?: string[];
  metadata?: Record<string, unknown>;
}

export interface MemoryUpdateInput {
  content?: string;
  type?: "fact" | "observation" | "preference" | "instruction";
  importance?: number;
  metadata?: Record<string, unknown>;
  /** If provided, REPLACES the entity link set. */
  entity_ids?: string[];
}

/**
 * Create a memory (optionally linked to 0-3 entities). The id is generated
 * client-side so the memory and its links insert atomically in one
 * transaction.
 */
export async function createMemory(
  db: Db,
  input: MemoryCreateInput,
  source?: string,
) {
  const namespaceId = await resolveNamespaceId(
    db,
    input.namespace ?? "personal",
  );
  if (input.entity_ids?.length) {
    const found = await db`
      SELECT id FROM entities WHERE id = ANY(${input.entity_ids})
    `;
    const foundIds = new Set(found.map((r) => String(r.id)));
    const missing = input.entity_ids.filter((id) => !foundIds.has(id));
    if (missing.length) {
      throw new MemoryError(
        "entity_not_found",
        `entity_ids refer to entities that don't exist: ${missing.join(", ")}`,
      );
    }
  }

  const id = crypto.randomUUID();
  const type = input.type ?? "fact";
  const importance = input.importance ?? 0.5;
  const metadata = JSON.stringify(input.metadata ?? {});

  const queries = [
    db`
      INSERT INTO memories (id, namespace_id, content, type, importance, source, metadata)
      VALUES (${id}, ${namespaceId}, ${input.content}, ${type}, ${importance},
              ${source ?? null}, ${metadata})
    `,
  ];
  for (const entityId of input.entity_ids ?? []) {
    queries.push(db`
      INSERT INTO memory_entity_links (memory_id, entity_id)
      VALUES (${id}, ${entityId})
    `);
  }
  await db.transaction(queries);

  const rows = await db`
    SELECT m.*, n.name AS namespace FROM memories m
    JOIN namespaces n ON n.id = m.namespace_id WHERE m.id = ${id} LIMIT 1
  `;
  return rows[0];
}

/** Full memory detail: memory + linked entity names. */
export async function getMemory(db: Db, id: string) {
  const rows = await db`
    SELECT m.*, n.name AS namespace FROM memories m
    JOIN namespaces n ON n.id = m.namespace_id WHERE m.id = ${id} LIMIT 1
  `;
  const memory = rows[0];
  if (!memory) throw new MemoryError("not_found", `memory '${id}' not found`);
  const links = await db`
    SELECT e.id, e.name, e.type FROM memory_entity_links l
    JOIN entities e ON e.id = l.entity_id WHERE l.memory_id = ${id}
    ORDER BY e.name
  `;
  return { ...memory, entities: links };
}

export async function updateMemory(
  db: Db,
  id: string,
  update: MemoryUpdateInput,
) {
  const sets: string[] = [];
  const params: unknown[] = [];
  const assign = (col: string, value: unknown) => {
    params.push(value);
    sets.push(`${col} = $${params.length}`);
  };
  if (update.content !== undefined) assign("content", update.content);
  if (update.type !== undefined) assign("type", update.type);
  if (update.importance !== undefined) assign("importance", update.importance);
  if (update.metadata !== undefined)
    assign("metadata", JSON.stringify(update.metadata));

  const queries: ReturnType<Db>[] = [];
  if (sets.length > 0) {
    params.push(id);
    queries.push(
      db.query(
        `UPDATE memories SET ${sets.join(", ")}, updated_at = now()
         WHERE id = $${params.length} RETURNING id`,
        params,
      ),
    );
  }
  if (update.entity_ids !== undefined) {
    // Verify the target entities exist before replacing the link set.
    if (update.entity_ids.length) {
      const found =
        await db`SELECT id FROM entities WHERE id = ANY(${update.entity_ids})`;
      const foundIds = new Set(found.map((r) => String(r.id)));
      const missing = update.entity_ids.filter((x) => !foundIds.has(x));
      if (missing.length) {
        throw new MemoryError(
          "entity_not_found",
          `entity_ids refer to entities that don't exist: ${missing.join(", ")}`,
        );
      }
    }
    queries.push(db`DELETE FROM memory_entity_links WHERE memory_id = ${id}`);
    for (const entityId of update.entity_ids) {
      queries.push(db`
        INSERT INTO memory_entity_links (memory_id, entity_id) VALUES (${id}, ${entityId})
      `);
    }
  }
  if (queries.length === 0) {
    throw new MemoryError("invalid_input", "no fields to update");
  }
  await db.transaction(queries);
  return getMemory(db, id);
}

export async function deleteMemory(db: Db, id: string) {
  const res = await db`DELETE FROM memories WHERE id = ${id} RETURNING id`;
  const row = res[0];
  if (!row) throw new MemoryError("not_found", `memory '${id}' not found`);
  return row;
}

export interface MemoryQueryFilters {
  type?: "fact" | "observation" | "preference" | "instruction";
  namespace?: string;
  importance_min?: number;
  archived?: boolean;
  limit?: number;
}

/** Query memories: ordered by importance DESC, then updated_at DESC. */
export async function queryMemories(db: Db, filters: MemoryQueryFilters = {}) {
  const where: string[] = [];
  const params: unknown[] = [];
  const bind = (value: unknown) => {
    params.push(value);
    return `$${params.length}`;
  };
  where.push(`m.archived = ${bind(filters.archived ?? false)}`);
  if (filters.type !== undefined) {
    where.push(`m.type = ${bind(filters.type)}`);
  }
  if (filters.namespace !== undefined) {
    const nsId = await resolveNamespaceId(db, filters.namespace);
    where.push(`m.namespace_id = ${bind(nsId)}`);
  }
  if (filters.importance_min !== undefined) {
    where.push(`m.importance >= ${bind(filters.importance_min)}`);
  }
  const limit = Math.min(filters.limit ?? 20, 50);
  return db.query(
    `SELECT m.*, n.name AS namespace FROM memories m
     JOIN namespaces n ON n.id = m.namespace_id
     WHERE ${where.join(" AND ")}
     ORDER BY m.importance DESC, m.updated_at DESC
     LIMIT ${bind(limit)}`,
    params,
  );
}
