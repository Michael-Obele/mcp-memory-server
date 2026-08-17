import type { Db } from "../db.ts";
import { MemoryError } from "../db.ts";

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
 * edges. Same shape as the future /api/graph endpoint.
 */
export async function traverseGraph(
  db: Db,
  startId: string,
  depth = 1,
): Promise<GraphResult> {
  const start = await db`SELECT * FROM entities WHERE id = ${startId} LIMIT 1`;
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
    const rows = await db`
      SELECT r.id, r.source_id, r.target_id, r.relation_type, r.weight,
             s.name AS source_name, s.type AS source_type, s.importance AS source_importance,
             t.name AS target_name, t.type AS target_type, t.importance AS target_importance
      FROM relations r
      JOIN entities s ON s.id = r.source_id
      JOIN entities t ON t.id = r.target_id
      WHERE r.source_id = ANY(${ids}) OR r.target_id = ANY(${ids})
    `;
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
