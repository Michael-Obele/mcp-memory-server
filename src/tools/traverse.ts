import type { McpServer } from "tmcp";
import * as v from "valibot";
import { TraverseToolInput } from "@sepia/shared";
import { db } from "../db.ts";
import { traverseGraph } from "../lib/graph.ts";
import { safe } from "./util.ts";

export function registerTraverseTools(server: McpServer<any, any>) {
  server.tool(
    {
      name: "traverse_graph",
      description:
        "BFS-walk the knowledge graph from a start entity (both directions). " +
        "Input: start_id (entity id), depth? (default 1, max 3). Returns nodes (id, label, type, importance) and edges (source, target, label, weight) — same shape as the dashboard graph view.",
      schema: TraverseToolInput,
    },
    safe(async (args: v.InferInput<typeof TraverseToolInput>) => {
      const graph = await traverseGraph(db(), args.start_id, args.depth);
      return {
        start_id: args.start_id,
        ...graph,
      };
    }),
  );
}
