import type { McpServer } from "tmcp";
import * as v from "valibot";
import { SearchToolInput } from "@sepia/shared";
import { db } from "../db.ts";
import { search } from "@sepia/shared";
import { safe } from "./util.ts";

export function registerSearchTools(server: McpServer<any, any>) {
  server.tool(
    {
      name: "search",
      description:
        "Unified keyword + metadata search across memories, entity names, and entity summaries. " +
        "Input: q (required; empty string returns recent items), namespace?, type?, limit? (max 25). " +
        "Ranked: exact word match > substring match, then importance, then recency. Returns merged, de-duplicated hits with kind (memory|entity), id, snippet, score.",
      schema: SearchToolInput,
    },
    safe(async (args: v.InferInput<typeof SearchToolInput>) => {
      const hits = await search(db(), args);
      return { count: hits.length, hits };
    }),
  );
}
