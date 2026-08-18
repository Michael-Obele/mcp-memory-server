import { McpServer } from "tmcp";
import { HttpTransport } from "@tmcp/transport-http";
import { ValibotJsonSchemaAdapter } from "@tmcp/adapter-valibot";
import { MEMORY_CONTRACT } from "./instructions.ts";
import { authEnabled, requireAuth } from "./auth.ts";
import { registerNamespaceTools } from "./tools/namespace.ts";
import { registerEntityTools } from "./tools/entity.ts";
import { registerRelationTools } from "./tools/relation.ts";
import { registerMemoryTools } from "./tools/memory.ts";
import { registerSearchTools } from "./tools/search.ts";
import { registerTraverseTools } from "./tools/traverse.ts";
import { registerConsolidateTools } from "./tools/consolidate.ts";

const server = new McpServer(
  {
    name: "sepia",
    version: "1.0.0",
    description:
      "Sepia — personal knowledge-graph memory server: entities, relations, memories in namespaces, with search, traversal, and consolidation.",
  },
  {
    adapter: new ValibotJsonSchemaAdapter(),
    capabilities: { tools: {} },
    // Injected into the model's system prompt by supporting clients —
    // the "remember without being asked" contract.
    instructions: MEMORY_CONTRACT,
  },
);

// The 7 tools.
registerNamespaceTools(server);
registerEntityTools(server);
registerRelationTools(server);
registerMemoryTools(server);
registerSearchTools(server);
registerTraverseTools(server);
registerConsolidateTools(server);

// Streamable HTTP transport mounted at /mcp inside this Bun.serve process.
const transport = new HttpTransport(server, { path: "/mcp" });

const PORT = Number(process.env.PORT ?? 8080);

Bun.serve({
  port: PORT,
  async fetch(request) {
    const url = new URL(request.url);

    // Health check for Fly's optional TCP check (NOT an HTTP smoke check —
    // those confuse Streamable HTTP servers).
    if (url.pathname === "/healthz") {
      return Response.json({ ok: true, service: "sepia" });
    }

    if (url.pathname === "/") {
      return Response.json({
        name: "sepia",
        version: "1.0.0",
        mcp: "/mcp",
        health: "/healthz",
        auth: authEnabled()
          ? "bearer-token"
          : "dev-mode (MCP_BEARER_TOKEN not set)",
        tools: 7,
      });
    }

    if (url.pathname.startsWith("/mcp")) {
      const auth = requireAuth(request);
      if (auth) return auth;
      const response = await transport.respond(request);
      return response ?? new Response("Not Found", { status: 404 });
    }

    // /api/* (dashboard REST) lands in M3 — same process, same auth.
    return new Response("Not Found", { status: 404 });
  },
});

console.log(
  `memory MCP server listening on :${PORT} (/mcp) — auth: ${
    authEnabled() ? "bearer token" : "DEV MODE (set MCP_BEARER_TOKEN)"
  }`,
);
