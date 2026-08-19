import type { Db } from "../client.ts";
import { MemoryError } from "../errors.ts";
import { eq, sql } from "drizzle-orm";
import { entities, relations } from "../schema.ts";

export interface GraphNode {
  id: string;
  label: string;
  type: string;
  importance: number;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  weight: number;
}

export interface GraphResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
  depth_reached: number;
}

/**
 * BFS traversal of the knowledge graph from a start entity, in both
 * directions, up to `depth` hops (max 3). Deduplicates visited entities and
 * edges. Same shape as the /api/graph endpoint.
 */
export async function traverseGraph(
  db: Db,
  startId: string,
  depth = 1,
): Promise<GraphResult> {
  const start = await db
    .select()
    .from(entities)
    .where(eq(entities.id, startId))
    .limit(1);
  if (!start[0]) {
    throw new MemoryError("not_found", `entity '${startId}' not found`);
  }

  const nodes = new Map<string, GraphNode>();
  const edges = new Map<string, GraphEdge>();
  const addNode = (row: Record<string, unknown>) => {
    const id = String(row.id);
    if (!nodes.has(id)) {
      nodes.set(id, {
        id,
        label: String(row.name),
        type: String(row.type),
        importance: Number(row.importance),
      });
    }
  };
  addNode(start[0] as unknown as Record<string, unknown>);

  let frontier = new Set<string>([startId]);
  const visited = new Set<string>([startId]);
  let depthReached = 0;

  const hops = Math.min(Math.max(1, Math.floor(depth)), 3);
  for (let d = 1; d <= hops; d++) {
    if (frontier.size === 0) break;
    depthReached = d;
    const ids = [...frontier];
    // Double self-join; pass ids as a Postgres array literal (a raw JS array
    // renders as ANY(($1)) with one string param and fails).
    const idArray = `{${ids.join(",")}}`;
    const res = await db.execute(sql`
      SELECT r.id, r.source_id, r.target_id, r.relation_type, r.weight,
             s.name AS source_name, s.type AS source_type, s.importance AS source_importance,
             t.name AS target_name, t.type AS target_type, t.importance AS target_importance
      FROM ${relations} r
      JOIN ${entities} s ON s.id = r.source_id
      JOIN ${entities} t ON t.id = r.target_id
      WHERE r.source_id = ANY(${idArray}) OR r.target_id = ANY(${idArray})
    `);
    const rows = res.rows as Array<Record<string, unknown>>;
    const next = new Set<string>();
    for (const row of rows) {
      const edgeId = String(row.id);
      if (!edges.has(edgeId)) {
        edges.set(edgeId, {
          id: edgeId,
          source: String(row.source_id),
          target: String(row.target_id),
          label: String(row.relation_type),
          weight: Number(row.weight),
        });
      }
      for (const side of [
        {
          id: String(row.source_id),
          name: row.source_name,
          type: row.source_type,
          importance: row.source_importance,
        },
        {
          id: String(row.target_id),
          name: row.target_name,
          type: row.target_type,
          importance: row.target_importance,
        },
      ]) {
        addNode({
          id: side.id,
          name: side.name,
          type: side.type,
          importance: side.importance,
        });
        if (!visited.has(side.id)) {
          visited.add(side.id);
          next.add(side.id);
        }
      }
    }
    frontier = next;
  }

  return {
    nodes: [...nodes.values()],
    edges: [...edges.values()],
    depth_reached: depthReached,
  };
}

/**
 * The entire knowledge graph: every entity as a node and every relation as
 * an edge. Same shape as `traverseGraph` (`depth_reached` is 0 — this is not
 * a traversal). Powers the dashboard's Obsidian-style "full graph" view.
 */
export async function fullGraph(db: Db): Promise<GraphResult> {
  const [entityRows, relationRows] = await Promise.all([
    db.select().from(entities),
    db.execute(sql`
      SELECT r.id, r.source_id, r.target_id, r.relation_type, r.weight,
             s.name AS source_name, s.type AS source_type, s.importance AS source_importance,
             t.name AS target_name, t.type AS target_type, t.importance AS target_importance
      FROM ${relations} r
      JOIN ${entities} s ON s.id = r.source_id
      JOIN ${entities} t ON t.id = r.target_id
    `),
  ]);

  const nodes: GraphNode[] = entityRows.map((e) => ({
    id: e.id,
    label: e.name,
    type: e.type,
    importance: e.importance ?? 0.5,
  }));

  const edges: GraphEdge[] = (relationRows.rows as Array<Record<string, unknown>>).map((r) => ({
    id: String(r.id),
    source: String(r.source_id),
    target: String(r.target_id),
    label: String(r.relation_type),
    weight: Number(r.weight),
  }));

  return { nodes, edges, depth_reached: 0 };
}
