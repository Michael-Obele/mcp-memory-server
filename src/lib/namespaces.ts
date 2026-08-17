import type { Db } from "../db.ts";
import { MemoryError } from "../db.ts";
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
  const rows = await db`
    INSERT INTO namespaces (name, description)
    VALUES (${name}, ${description})
    ON CONFLICT (name) DO NOTHING
    RETURNING *
  `;
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
  const rows = await db`
    SELECT
      n.id, n.name, n.description, n.created_at, n.updated_at,
      (SELECT count(*)::int FROM entities e WHERE e.namespace_id = n.id) AS entity_count,
      (SELECT count(*)::int FROM memories m WHERE m.namespace_id = n.id) AS memory_count,
      (SELECT count(*)::int FROM relations r WHERE r.namespace_id = n.id) AS relation_count
    FROM namespaces n
    ORDER BY n.name
  `;
  return rows as unknown as NamespaceStats[];
}

export async function getNamespace(db: Db, idOrName: string) {
  const row = await getNamespaceByIdOrName(db, idOrName);
  const id = String(row.id);
  const counts = await db`
    SELECT
      (SELECT count(*)::int FROM entities e WHERE e.namespace_id = ${id}) AS entity_count,
      (SELECT count(*)::int FROM memories m WHERE m.namespace_id = ${id}) AS memory_count,
      (SELECT count(*)::int FROM relations r WHERE r.namespace_id = ${id}) AS relation_count
  `;
  return { ...row, ...counts[0] };
}

export async function deleteNamespace(db: Db, idOrName: string) {
  const row = await getNamespaceByIdOrName(db, idOrName);
  const id = String(row.id);
  const res =
    await db`DELETE FROM namespaces WHERE id = ${id} RETURNING id, name`;
  return res[0];
}
