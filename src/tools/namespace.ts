import type { McpServer } from "tmcp";
import * as v from "valibot";
import { NamespaceToolInput } from "@sepia/shared";
import { db } from "../db.ts";
import {
  createNamespace,
  deleteNamespace,
  getNamespace,
  listNamespaces,
} from "@sepia/shared";
import { safe } from "./util.ts";

export function registerNamespaceTools(server: McpServer<any, any>) {
  server.tool(
    {
      name: "manage_namespace",
      description:
        "Create, list, get, or delete namespaces — isolated memory containers. " +
        "Actions: create (name, description?) | list | get (id or name) | delete (id or name, cascades all contents).",
      schema: NamespaceToolInput,
    },
    safe(async (args: v.InferInput<typeof NamespaceToolInput>) => {
      const sql = db();
      switch (args.action) {
        case "create": {
          if (!args.name) throw new Error("action=create requires name");
          return {
            action: "create",
            namespace: await createNamespace(sql, args.name, args.description),
          };
        }
        case "list":
          return { action: "list", namespaces: await listNamespaces(sql) };
        case "get": {
          const idOrName = args.id ?? args.name;
          if (!idOrName) throw new Error("action=get requires id or name");
          return {
            action: "get",
            namespace: await getNamespace(sql, idOrName),
          };
        }
        case "delete": {
          const idOrName = args.id ?? args.name;
          if (!idOrName) throw new Error("action=delete requires id or name");
          return {
            action: "delete",
            deleted: await deleteNamespace(sql, idOrName),
          };
        }
      }
    }),
  );
}
