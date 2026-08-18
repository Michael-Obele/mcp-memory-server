import type { Db } from "../client.ts";
import { MemoryError } from "../errors.ts";
import type { BatchItem } from "drizzle-orm/batch";
import { and, desc, eq, getTableColumns, gte, inArray, sql } from "drizzle-orm";
import {
  entities,
  memories,
  memoryEntityLinks,
  namespaces,
} from "../schema.ts";
import { resolveNamespaceId } from "./util.ts";

export interface MemoryCreate {
  content: string;
  type?: "fact" | "observation" | "preference" | "instruction";
  importance?: number;
  namespace?: string;
  entity_ids?: string[];
  metadata?: Record<string, unknown>;
}

export interface MemoryUpdate {
  content?: string;
  type?: "fact" | "observation" | "preference" | "instruction";
  importance?: number;
  metadata?: Record<string, unknown>;
  archived?: boolean;
  /** If provided, REPLACES the entity link set. */
  entity_ids?: string[];
}

/** A full memory row as stored in the DB. */
export type Memory = typeof memories.$inferSelect;

/**
 * Create a memory (optionally linked to 0-3 entities). The id is generated
 * client-side so the memory and its links insert atomically in one
 * transaction.
 */
export async function createMemory(
  db: Db,
  input: MemoryCreate,
  source?: string,
): Promise<(Memory & { namespace: string }) | undefined> {
  const namespaceId = await resolveNamespaceId(
    db,
    input.namespace ?? "personal",
  );
  if (input.entity_ids?.length) {
    // Entities must exist AND live in the same namespace as the memory.
    const found = await db
      .select({ id: entities.id })
      .from(entities)
      .where(
        and(
          inArray(entities.id, input.entity_ids),
          eq(entities.namespaceId, namespaceId),
        ),
      );
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
  const metadata = input.metadata ?? {};

  // db.batch() = memory + link inserts in ONE Neon HTTP call (atomic).
  const queries: BatchItem<"pg">[] = [
    db.insert(memories).values({
      id,
      namespaceId,
      content: input.content,
      type,
      importance,
      source: source ?? null,
      metadata,
    }),
    ...(input.entity_ids ?? []).map((entityId) =>
      db.insert(memoryEntityLinks).values({ memoryId: id, entityId }),
    ),
  ];
  // db.batch requires a non-empty tuple type; the array always has ≥1 item.
  await db.batch(queries as [BatchItem<"pg">, ...BatchItem<"pg">[]]);

  const rows = await db
    .select({
      ...getTableColumns(memories),
      namespace: namespaces.name,
    })
    .from(memories)
    .innerJoin(namespaces, eq(namespaces.id, memories.namespaceId))
    .where(eq(memories.id, id))
    .limit(1);
  return rows[0];
}

/** Full memory detail: memory + linked entity names. */
export async function getMemory(db: Db, id: string) {
  const rows = await db
    .select({
      ...getTableColumns(memories),
      namespace: namespaces.name,
    })
    .from(memories)
    .innerJoin(namespaces, eq(namespaces.id, memories.namespaceId))
    .where(eq(memories.id, id))
    .limit(1);
  const memory = rows[0];
  if (!memory) throw new MemoryError("not_found", `memory '${id}' not found`);
  const links = await db
    .select({
      id: entities.id,
      name: entities.name,
      type: entities.type,
    })
    .from(memoryEntityLinks)
    .innerJoin(entities, eq(entities.id, memoryEntityLinks.entityId))
    .where(eq(memoryEntityLinks.memoryId, id))
    .orderBy(entities.name);
  return { ...memory, entities: links };
}

export async function updateMemory(db: Db, id: string, update: MemoryUpdate) {
  const sets: Partial<typeof memories.$inferInsert> = {};
  if (update.content !== undefined) sets.content = update.content;
  if (update.type !== undefined) sets.type = update.type;
  if (update.importance !== undefined) sets.importance = update.importance;
  if (update.metadata !== undefined) sets.metadata = update.metadata;
  if (update.archived !== undefined) sets.archived = update.archived;

  const queries: BatchItem<"pg">[] = [];
  if (Object.keys(sets).length > 0) {
    queries.push(
      db
        .update(memories)
        .set({ ...sets, updatedAt: sql`now()` })
        .where(eq(memories.id, id)),
    );
  }
  if (update.entity_ids !== undefined) {
    // Verify the target entities exist before replacing the link set.
    if (update.entity_ids.length) {
      const found = await db
        .select({ id: entities.id })
        .from(entities)
        .where(
          and(
            inArray(entities.id, update.entity_ids),
            // Same namespace as the memory being updated.
            eq(
              entities.namespaceId,
              sql`(SELECT namespace_id FROM memories WHERE id = ${id})`,
            ),
          ),
        );
      const foundIds = new Set(found.map((r) => String(r.id)));
      const missing = update.entity_ids.filter((x) => !foundIds.has(x));
      if (missing.length) {
        throw new MemoryError(
          "entity_not_found",
          `entity_ids refer to entities that don't exist: ${missing.join(", ")}`,
        );
      }
    }
    queries.push(
      db.delete(memoryEntityLinks).where(eq(memoryEntityLinks.memoryId, id)),
    );
    for (const entityId of update.entity_ids) {
      queries.push(
        db.insert(memoryEntityLinks).values({ memoryId: id, entityId }),
      );
    }
  }
  if (queries.length === 0) {
    throw new MemoryError("invalid_input", "no fields to update");
  }
  await db.batch(queries as [BatchItem<"pg">, ...BatchItem<"pg">[]]);
  return getMemory(db, id);
}

export async function deleteMemory(db: Db, id: string) {
  const res = await db
    .delete(memories)
    .where(eq(memories.id, id))
    .returning({ id: memories.id });
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
  const conditions = [eq(memories.archived, filters.archived ?? false)];
  if (filters.type !== undefined) {
    conditions.push(eq(memories.type, filters.type));
  }
  if (filters.namespace !== undefined) {
    const nsId = await resolveNamespaceId(db, filters.namespace);
    conditions.push(eq(memories.namespaceId, nsId));
  }
  if (filters.importance_min !== undefined) {
    conditions.push(gte(memories.importance, filters.importance_min));
  }
  const limit = Math.min(filters.limit ?? 20, 50);
  return db
    .select({
      ...getTableColumns(memories),
      namespace: namespaces.name,
    })
    .from(memories)
    .innerJoin(namespaces, eq(namespaces.id, memories.namespaceId))
    .where(and(...conditions))
    .orderBy(desc(memories.importance), desc(memories.updatedAt))
    .limit(limit);
}
