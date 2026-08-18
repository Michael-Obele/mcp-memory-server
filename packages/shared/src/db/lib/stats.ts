import type { Db } from "../client.ts";
import { eq, sql } from "drizzle-orm";
import { entities, memories, namespaces, relations } from "../schema.ts";
import { STALE_AFTER_DAYS, STALE_IMPORTANCE } from "../../types.ts";

export interface Stats {
  namespaces: number;
  entities: number;
  memories: number;
  relations: number;
  archived: number;
  /** Memories by type (fact/observation/preference/instruction). */
  memories_by_type: Record<string, number>;
  /** Entities by type. */
  entities_by_type: Record<string, number>;
  /** Top entities by access_count (most-viewed). */
  top_entities: Array<{
    id: string;
    name: string;
    type: string;
    access_count: number;
    importance: number;
  }>;
  /** Memories that would be archived by the next consolidate sweep. */
  decay_candidates: number;
  /** Most recently updated memories (for the home feed). */
  recent_memories: Array<{
    id: string;
    content: string;
    type: string;
    importance: number;
    namespace: string;
    updated_at: string;
  }>;
}

/** Dashboard stats: counts, top entities, decay candidates, recent feed. */
export async function getStats(db: Db): Promise<Stats> {
  const [
    ns,
    ent,
    mem,
    rel,
    archived,
    memByType,
    entByType,
    top,
    decay,
    recent,
  ] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(namespaces),
    db.select({ n: sql<number>`count(*)::int` }).from(entities),
    db.select({ n: sql<number>`count(*)::int` }).from(memories),
    db.select({ n: sql<number>`count(*)::int` }).from(relations),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(memories)
      .where(eq(memories.archived, true)),
    db
      .select({ type: memories.type, n: sql<number>`count(*)::int` })
      .from(memories)
      .groupBy(memories.type),
    db
      .select({ type: entities.type, n: sql<number>`count(*)::int` })
      .from(entities)
      .groupBy(entities.type),
    db
      .select({
        id: entities.id,
        name: entities.name,
        type: entities.type,
        access_count: entities.accessCount,
        importance: entities.importance,
      })
      .from(entities)
      .orderBy(sql`${entities.accessCount} DESC`)
      .limit(8),
    db.execute(sql`
        SELECT count(*)::int AS n FROM ${memories}
        WHERE NOT archived
          AND importance < ${STALE_IMPORTANCE}
          AND updated_at < now() - (${STALE_AFTER_DAYS} * interval '1 day')
      `),
    db
      .select({
        id: memories.id,
        content: memories.content,
        type: memories.type,
        importance: memories.importance,
        namespace: namespaces.name,
        updated_at: memories.updatedAt,
      })
      .from(memories)
      .innerJoin(namespaces, eq(namespaces.id, memories.namespaceId))
      .where(eq(memories.archived, false))
      .orderBy(sql`${memories.updatedAt} DESC`)
      .limit(10),
  ]);

  const memoriesByType: Record<string, number> = {};
  for (const r of memByType) memoriesByType[String(r.type)] = Number(r.n);
  const entitiesByType: Record<string, number> = {};
  for (const r of entByType) entitiesByType[String(r.type)] = Number(r.n);

  return {
    namespaces: Number(ns[0]?.n ?? 0),
    entities: Number(ent[0]?.n ?? 0),
    memories: Number(mem[0]?.n ?? 0),
    relations: Number(rel[0]?.n ?? 0),
    archived: Number(archived[0]?.n ?? 0),
    memories_by_type: memoriesByType,
    entities_by_type: entitiesByType,
    top_entities: top.map((e) => ({
      id: String(e.id),
      name: String(e.name),
      type: String(e.type),
      access_count: Number(e.access_count),
      importance: Number(e.importance),
    })),
    decay_candidates: Number(decay.rows[0]?.n ?? 0),
    recent_memories: recent.map((m) => ({
      id: String(m.id),
      content: String(m.content),
      type: String(m.type),
      importance: Number(m.importance),
      namespace: String(m.namespace),
      updated_at: String(m.updated_at),
    })),
  };
}
