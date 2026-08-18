import type { McpServer } from "tmcp";
import * as v from "valibot";
import { MemoryToolInput } from "@sepia/shared";
import { db } from "../db.ts";
import {
  createMemory,
  deleteMemory,
  getMemory,
  queryMemories,
  updateMemory,
} from "../lib/memories.ts";
import { safe } from "./util.ts";

export function registerMemoryTools(server: McpServer<any, any>) {
  server.tool(
    {
      name: "manage_memory",
      description:
        "Create, get, update, delete, or query memories — knowledge fragments (facts, observations, preferences, instructions) with importance scoring. " +
        "Actions: create (memory: {content, type?, importance?, namespace?, entity_ids? [0-3], metadata?} — source auto-set to client name) | " +
        "get (id — includes linked entities) | update (id + update — entity_ids REPLACES the link set) | " +
        "delete (id) | query (filters: type, namespace, importance_min, archived; ordered importance DESC, updated_at DESC; limit max 50).",
      schema: MemoryToolInput,
    },
    safe(async (args: v.InferInput<typeof MemoryToolInput>) => {
      const sql = db();
      switch (args.action) {
        case "create": {
          if (!args.memory) throw new Error("action=create requires memory");
          const source =
            server.ctx.sessionInfo?.clientInfo?.name ?? "unknown-client";
          return {
            action: "create",
            memory: await createMemory(sql, args.memory, source),
          };
        }
        case "get": {
          if (!args.id) throw new Error("action=get requires id");
          return { action: "get", memory: await getMemory(sql, args.id) };
        }
        case "update": {
          if (!args.id) throw new Error("action=update requires id");
          if (!args.update) throw new Error("action=update requires update");
          return {
            action: "update",
            memory: await updateMemory(sql, args.id, args.update),
          };
        }
        case "delete": {
          if (!args.id) throw new Error("action=delete requires id");
          return {
            action: "delete",
            deleted: await deleteMemory(sql, args.id),
          };
        }
        case "query": {
          const memories = await queryMemories(sql, {
            type: args.type,
            namespace: args.namespace,
            importance_min: args.importance_min,
            archived: args.archived,
            limit: args.limit,
          });
          return { action: "query", count: memories.length, memories };
        }
      }
    }),
  );
}
