import type { Db } from "../db.ts";
import { SEARCH_LIMIT_MAX } from "@memory/shared";

export interface SearchOptions {
  q: string;
  namespace?: string;
  type?: string;
  limit?: number;
}

export interface SearchHit {
  kind: "memory" | "entity";
  id: string;
  name?: string;
  content?: string;
  type: string;
  importance: number;
  updated_at: string;
  namespace: string;
  snippet: string;
  score: number;
}

const WORD_RE = /[a-z0-9]+/gi;

/** 2 points per exact whole-word match, 1 per substring match. */
function matchScore(text: string, words: string[]): number {
  const lower = text.toLowerCase();
  let score = 0;
  for (const word of words) {
    if (lower.includes(word)) score += 1;
    const re = new RegExp(`(^|[^a-z0-9])${escapeRegExp(word)}([^a-z0-9]|$)`);
    if (re.test(lower)) score += 1;
  }
  return score;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function snippet(text: string, max = 200): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed;
}

/**
 * Unified search over memories.content, entities.name, entities.summary.
 * Case-insensitive substring matching in SQL, then ranked in JS:
 * exact word match > substring match, then importance DESC, then
 * updated_at DESC. Empty `q` returns recent items.
 */
export async function search(
  db: Db,
  opts: SearchOptions,
): Promise<SearchHit[]> {
  const limit = Math.min(opts.limit ?? 10, SEARCH_LIMIT_MAX);

  if (!opts.q.trim()) {
    const [memories, entities] = await Promise.all([
      db`
        SELECT m.id, m.content, m.type, m.importance, m.updated_at, n.name AS namespace
        FROM memories m JOIN namespaces n ON n.id = m.namespace_id
        WHERE NOT m.archived
        ORDER BY m.updated_at DESC LIMIT ${limit}
      `,
      db`
        SELECT e.id, e.name, e.type, e.importance, e.updated_at, n.name AS namespace
        FROM entities e JOIN namespaces n ON n.id = e.namespace_id
        ORDER BY e.updated_at DESC LIMIT ${limit}
      `,
    ]);
    return [
      ...memories.map((m: Record<string, unknown>) => ({
        kind: "memory" as const,
        id: String(m.id),
        content: String(m.content),
        type: String(m.type),
        importance: Number(m.importance),
        updated_at: String(m.updated_at),
        namespace: String(m.namespace),
        snippet: snippet(String(m.content)),
        score: 0,
      })),
      ...entities.map((e: Record<string, unknown>) => ({
        kind: "entity" as const,
        id: String(e.id),
        name: String(e.name),
        type: String(e.type),
        importance: Number(e.importance),
        updated_at: String(e.updated_at),
        namespace: String(e.namespace),
        snippet: snippet(String(e.summary ?? e.name)),
        score: 0,
      })),
    ];
  }

  const words = (opts.q.match(WORD_RE) ?? []).map((w) => w.toLowerCase());
  const like = `%${opts.q}%`;

  const where: string[] = [];
  const params: unknown[] = [];
  const bind = (value: unknown) => {
    params.push(value);
    return `$${params.length}`;
  };
  if (opts.namespace !== undefined) {
    where.push(`n.name = ${bind(opts.namespace)}`);
  }
  if (opts.type !== undefined) {
    where.push(`(m.type = ${bind(opts.type)} OR e.type = ${bind(opts.type)})`);
  }
  const nsWhere = where.length ? `AND ${where.join(" AND ")}` : "";

  const rows = await db.query(
    `SELECT 'memory' AS kind, m.id, m.content AS text, m.type, m.importance, m.updated_at, n.name AS namespace
       FROM memories m JOIN namespaces n ON n.id = m.namespace_id
       WHERE NOT m.archived AND m.content ILIKE ${bind(like)} ${nsWhere}
     UNION ALL
     SELECT 'entity' AS kind, e.id, e.name AS text, e.type, e.importance, e.updated_at, n.name AS namespace
       FROM entities e JOIN namespaces n ON n.id = e.namespace_id
       WHERE (e.name ILIKE ${bind(like)} OR e.summary ILIKE ${bind(like)}) ${nsWhere}
     ORDER BY updated_at DESC
     LIMIT ${bind(limit * 4)}`,
    params,
  );

  const hits: SearchHit[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const kind = row.kind as "memory" | "entity";
    const key = `${kind}:${String(row.id)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const text = String(row.text);
    const score = matchScore(text, words);
    hits.push({
      kind,
      id: String(row.id),
      name: kind === "entity" ? text : undefined,
      content: kind === "memory" ? text : undefined,
      type: String(row.type),
      importance: Number(row.importance),
      updated_at: String(row.updated_at),
      namespace: String(row.namespace),
      snippet: snippet(text),
      score,
    });
  }

  hits.sort(
    (a, b) =>
      b.score - a.score ||
      b.importance - a.importance ||
      String(b.updated_at).localeCompare(String(a.updated_at)),
  );
  return hits.slice(0, limit);
}
