import type { Db } from "../client.ts";
import { MemoryError } from "../errors.ts";
import { eq, sql } from "drizzle-orm";
import { namespaces } from "../schema.ts";
import { DEFAULT_NAMESPACE } from "../../types.ts";
import { getNamespaceByIdOrName } from "./util.ts";

export interface NamespaceStats {
  id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
  entity_count: number;
  memory_count: number;
  relation_count: number;
}

export async function createNamespace(db: Db, name: string, description = "") {
  const rows = await db
    .insert(namespaces)
    .values({ name, description })
    .onConflictDoNothing()
    .returning();
  const row = rows[0];
  if (!row) {
    throw new MemoryError(
      "already_exists",
      `namespace '${name}' already exists (use manage_namespace action=list to see namespaces)`,
    );
  }
  return row;
}

export async function listNamespaces(db: Db): Promise<NamespaceStats[]> {
  // Correlated count subqueries. Use db.execute with explicit `n.id` — a
  // query-builder ${namespaces.id} renders unqualified and resolves wrong.
  const res = await db.execute(sql`
    SELECT n.id, n.name, n.description, n.created_at, n.updated_at,
      (SELECT count(*)::int FROM entities e WHERE e.namespace_id = n.id) AS entity_count,
      (SELECT count(*)::int FROM memories m WHERE m.namespace_id = n.id) AS memory_count,
      (SELECT count(*)::int FROM relations r WHERE r.namespace_id = n.id) AS relation_count
    FROM ${namespaces} n
    ORDER BY n.name
  `);
  return res.rows as unknown as NamespaceStats[];
}

export async function getNamespace(db: Db, idOrName: string) {
  const row = await getNamespaceByIdOrName(db, idOrName);
  const id = String(row.id);
  // No-FROM select with correlated subqueries.
  const counts = await db.execute(sql`
    SELECT
      (SELECT count(*)::int FROM entities e WHERE e.namespace_id = ${id}) AS entity_count,
      (SELECT count(*)::int FROM memories m WHERE m.namespace_id = ${id}) AS memory_count,
      (SELECT count(*)::int FROM relations r WHERE r.namespace_id = ${id}) AS relation_count
  `);
  return { ...row, ...counts.rows[0] };
}

export async function deleteNamespace(db: Db, idOrName: string) {
  const row = await getNamespaceByIdOrName(db, idOrName);
  if (String(row.name) === DEFAULT_NAMESPACE) {
    throw new MemoryError(
      "invalid_input",
      `cannot delete the default namespace '${DEFAULT_NAMESPACE}'`,
    );
  }
  const id = String(row.id);
  const res = await db
    .delete(namespaces)
    .where(eq(namespaces.id, id))
    .returning({ id: namespaces.id, name: namespaces.name });
  return res[0];
}
