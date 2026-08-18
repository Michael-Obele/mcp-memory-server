import type { McpServer } from "tmcp";
import * as v from "valibot";
import { ConsolidateToolInput } from "@sepia/shared";
import { db } from "../db.ts";
import { consolidate } from "@sepia/shared";
import { safe } from "./util.ts";

export function registerConsolidateTools(server: McpServer<any, any>) {
  server.tool(
    {
      name: "consolidate",
      description:
        "Idempotent maintenance sweep — pure SQL, no LLM calls. " +
        "1) Archives stale memories (importance < 0.3, untouched > 90 days). " +
        "2) De-duplicates exact content within each namespace (keeps highest importance, oldest on tie). " +
        "3) Hard-deletes rows archived > 30 days. Returns counts of what it did.",
      schema: ConsolidateToolInput,
    },
    safe(async () => consolidate(db())),
  );
}
