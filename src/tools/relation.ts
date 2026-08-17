import type { McpServer } from "tmcp";
import * as v from "valibot";
import { RelationToolInput } from "@memory/shared";
import { db } from "../db.ts";
import {
  createRelation,
  deleteRelation,
  listRelations,
} from "../lib/relations.ts";
import { safe } from "./util.ts";

export function registerRelationTools(server: McpServer<any, any>) {
  server.tool(
    {
      name: "manage_relation",
      description:
        "Create, delete, or list relations — directed, weighted edges between entities. " +
        "Actions: create (relation: {source_id, target_id, relation_type, weight?} — updates weight if the same relation exists) | " +
        "delete (id) | list (by entity_id — in + out — or namespace).",
      schema: RelationToolInput,
    },
    safe(async (args: v.InferInput<typeof RelationToolInput>) => {
      const sql = db();
      switch (args.action) {
        case "create": {
          if (!args.relation)
            throw new Error("action=create requires relation");
          return {
            action: "create",
            relation: await createRelation(sql, args.relation),
          };
        }
        case "delete": {
          if (!args.id) throw new Error("action=delete requires id");
          return {
            action: "delete",
            deleted: await deleteRelation(sql, args.id),
          };
        }
        case "list":
          return {
            action: "list",
            relations: await listRelations(sql, {
              entity_id: args.entity_id,
              namespace: args.namespace,
            }),
          };
      }
    }),
  );
}
