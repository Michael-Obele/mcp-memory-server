import type { McpServer } from "tmcp";
import * as v from "valibot";
import { DEFAULT_NAMESPACE, EntityToolInput } from "@memory/shared";
import { db } from "../db.ts";
import {
  createEntity,
  deleteEntity,
  findEntities,
  getEntity,
  updateEntity,
} from "../lib/entities.ts";
import { safe } from "./util.ts";

export function registerEntityTools(server: McpServer<any, any>) {
  server.tool(
    {
      name: "manage_entity",
      description:
        "Create, get, update, delete, or find entities — knowledge graph nodes (people, projects, concepts, tools). " +
        "Actions: create (entity: {name, type, summary?, importance?, metadata?}) | get (id — includes linked memories and relations) | " +
        "update (id + update: any subset of name/type/summary/importance/metadata) | delete (id — cascades relations, unlinks memories) | " +
        "find (query, optional type + namespace — up to 10 matches).",
      schema: EntityToolInput,
    },
    safe(async (args: v.InferInput<typeof EntityToolInput>) => {
      const sql = db();
      switch (args.action) {
        case "create": {
          if (!args.entity) throw new Error("action=create requires entity");
          return {
            action: "create",
            entity: await createEntity(
              sql,
              args.namespace ?? DEFAULT_NAMESPACE,
              args.entity,
            ),
          };
        }
        case "get": {
          if (!args.id) throw new Error("action=get requires id");
          return { action: "get", entity: await getEntity(sql, args.id) };
        }
        case "update": {
          if (!args.id) throw new Error("action=update requires id");
          if (!args.update) throw new Error("action=update requires update");
          return {
            action: "update",
            entity: await updateEntity(sql, args.id, args.update),
          };
        }
        case "delete": {
          if (!args.id) throw new Error("action=delete requires id");
          return {
            action: "delete",
            deleted: await deleteEntity(sql, args.id),
          };
        }
        case "find": {
          const entities = await findEntities(
            sql,
            args.namespace,
            args.query,
            args.type,
          );
          return { action: "find", count: entities.length, entities };
        }
      }
    }),
  );
}
