import type { Db } from "../client.ts";
import { MemoryError } from "../errors.ts";
import { eq, sql } from "drizzle-orm";
import { entities, namespaces, relations } from "../schema.ts";

export interface RelationCreate {
  source_id: string;
  target_id: string;
  relation_type: string;
  weight?: number;
}

/** A full relation row as stored in the DB. */
export type Relation = typeof relations.$inferSelect;

/**
 * Create a relation. On UNIQUE(source, target, relation_type) conflict the
 * weight is UPDATED instead of erroring (per spec).
 */
export async function createRelation(
  db: Db,
  input: RelationCreate,
): Promise<Relation | undefined> {
  const source = await db
    .select({ namespaceId: entities.namespaceId })
    .from(entities)
    .where(eq(entities.id, input.source_id))
    .limit(1);
  if (!source[0]) {
    throw new MemoryError("not_found", `entity '${input.source_id}' not found`);
  }
  const target = await db
    .select({ namespaceId: entities.namespaceId })
    .from(entities)
    .where(eq(entities.id, input.target_id))
    .limit(1);
  if (!target[0]) {
    throw new MemoryError("not_found", `entity '${input.target_id}' not found`);
  }
  if (input.source_id === input.target_id) {
    throw new MemoryError(
      "invalid_input",
      "source_id and target_id must differ",
    );
  }
  if (String(source[0].namespaceId) !== String(target[0].namespaceId)) {
    throw new MemoryError(
      "invalid_input",
      "source_id and target_id must be in the same namespace",
    );
  }
  // Relations live in the source entity's namespace.
  const namespaceId = String(source[0].namespaceId);
  const rows = await db
    .insert(relations)
    .values({
      namespaceId,
      sourceId: input.source_id,
      targetId: input.target_id,
      relationType: input.relation_type,
      weight: input.weight ?? 0.5,
    })
    .onConflictDoUpdate({
      target: [relations.sourceId, relations.targetId, relations.relationType],
      set: { weight: sql`excluded.weight` },
    })
    .returning();
  return rows[0];
}

export async function deleteRelation(db: Db, id: string) {
  const res = await db
    .delete(relations)
    .where(eq(relations.id, id))
    .returning({ id: relations.id });
  const row = res[0];
  if (!row) throw new MemoryError("not_found", `relation '${id}' not found`);
  return row;
}

/** List relations: in + out for one entity, or all relations in a namespace. */
export async function listRelations(
  db: Db,
  opts: { entity_id?: string; namespace?: string } = {},
) {
  // Joins entities twice (source + target) — query builder can't express a
  // double self-join, so use the sql template tag.
  const cols = sql`
    r.*, s.name AS source_name, s.type AS source_type,
    t.name AS target_name, t.type AS target_type
  `;
  if (opts.entity_id) {
    const res = await db.execute(sql`
      SELECT ${cols}
      FROM ${relations} r
      JOIN ${entities} s ON s.id = r.source_id
      JOIN ${entities} t ON t.id = r.target_id
      WHERE r.source_id = ${opts.entity_id} OR r.target_id = ${opts.entity_id}
      ORDER BY r.weight DESC, r.created_at DESC
    `);
    return res.rows;
  }
  if (opts.namespace) {
    const res = await db.execute(sql`
      SELECT ${cols}
      FROM ${relations} r
      JOIN ${namespaces} n ON n.id = r.namespace_id
      JOIN ${entities} s ON s.id = r.source_id
      JOIN ${entities} t ON t.id = r.target_id
      WHERE n.name = ${opts.namespace}
      ORDER BY r.weight DESC, r.created_at DESC
    `);
    return res.rows;
  }
  const res = await db.execute(sql`
    SELECT ${cols}
    FROM ${relations} r
    JOIN ${entities} s ON s.id = r.source_id
    JOIN ${entities} t ON t.id = r.target_id
    ORDER BY r.weight DESC, r.created_at DESC
    LIMIT 200
  `);
  return res.rows;
}
