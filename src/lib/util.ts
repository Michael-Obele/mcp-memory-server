import type { Db } from "../db.ts";
import { MemoryError } from "../db.ts";

export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Resolve a namespace by name to its id, or throw. */
export async function resolveNamespaceId(
  db: Db,
  name: string,
): Promise<string> {
  const rows = await db`SELECT id FROM namespaces WHERE name = ${name} LIMIT 1`;
  const row = rows[0];
  if (!row) {
    throw new MemoryError(
      "namespace_not_found",
      `namespace '${name}' does not exist (create it with manage_namespace)`,
    );
  }
  return String(row.id);
}

/** Fetch a namespace row by id or name. */
export async function getNamespaceByIdOrName(db: Db, idOrName: string) {
  const rows = UUID_RE.test(idOrName)
    ? await db`SELECT * FROM namespaces WHERE id = ${idOrName} LIMIT 1`
    : await db`SELECT * FROM namespaces WHERE name = ${idOrName} LIMIT 1`;
  const row = rows[0];
  if (!row) {
    throw new MemoryError("not_found", `namespace '${idOrName}' not found`);
  }
  return row;
}
