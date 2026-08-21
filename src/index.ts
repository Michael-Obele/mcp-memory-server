import { McpServer } from "tmcp";
import { HttpTransport } from "@tmcp/transport-http";
import { ValibotJsonSchemaAdapter } from "@tmcp/adapter-valibot";
import { MEMORY_CONTRACT } from "./instructions.ts";
import { authEnabled, requireAuth } from "./auth.ts";
import { handleApi } from "./api.ts";
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

// ── Skill + installer endpoints ────────────────────────────────────────────
// The bundled Agent Skill (skills/sepia/) is served over HTTP so clients can
// install it without cloning the repo:
//   - GET /skill                    → SKILL.md (works with `npx skills add <url>`)
//   - GET /skill/references/tools.md → per-tool reference
//   - GET /install                  → remote installer script (curl | bash)
//   - GET /instructions/{vscode,cursor,claude,agents}
//                                  → always-on instruction files (skills/sepia/always-on/)
const SKILL_DIR = new URL("../skills/sepia/", import.meta.url);

function serveSkillFile(relPath: string, contentType: string) {
  const file = Bun.file(new URL(relPath, SKILL_DIR));
  if (!file.exists()) return new Response("Not Found", { status: 404 });
  return new Response(file, {
    headers: { "content-type": contentType },
  });
}

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
        skill: "/skill",
        install: "/install",
        instructions: {
          vscode: "/instructions/vscode",
          cursor: "/instructions/cursor",
          claude: "/instructions/claude",
          agents: "/instructions/agents",
        },
        auth: authEnabled()
          ? "bearer-token"
          : "dev-mode (MCP_BEARER_TOKEN not set)",
        tools: 7,
      });
    }

    // Skill + installer are public (no auth) — they're static docs.
    if (url.pathname === "/skill") {
      return serveSkillFile("SKILL.md", "text/markdown; charset=utf-8");
    }
    if (url.pathname === "/skill/references/tools.md") {
      return serveSkillFile(
        "references/tools.md",
        "text/markdown; charset=utf-8",
      );
    }
    // Always-on instruction files (the "system prompt" channel — skills are
    // on-demand only; these are injected into EVERY session by the editor's
    // own instruction system). Same contract as the MCP `instructions` field.
    if (url.pathname === "/instructions/vscode") {
      return serveSkillFile(
        "always-on/vscode.instructions.md",
        "text/markdown; charset=utf-8",
      );
    }
    if (url.pathname === "/instructions/cursor") {
      return serveSkillFile("always-on/cursor.mdc", "text/markdown; charset=utf-8");
    }
    if (url.pathname === "/instructions/claude") {
      return serveSkillFile("always-on/claude.md", "text/markdown; charset=utf-8");
    }
    if (url.pathname === "/instructions/agents") {
      return serveSkillFile("always-on/agents.md", "text/markdown; charset=utf-8");
    }
    if (url.pathname === "/install") {
      const script = Bun.file(
        new URL("../scripts/remote-install.sh", import.meta.url),
      );
      if (!script.exists()) return new Response("Not Found", { status: 404 });
      return new Response(script, {
        headers: { "content-type": "text/x-shellscript; charset=utf-8" },
      });
    }

    if (url.pathname.startsWith("/mcp")) {
      const auth = requireAuth(request);
      if (auth) return auth;
      const response = await transport.respond(request);
      return response ?? new Response("Not Found", { status: 404 });
    }

    // /api/* (dashboard REST) — same process, same auth, CORS allowlist.
    // OPTIONS preflights are answered before auth (browsers don't send the
    // Authorization header on preflight).
    if (url.pathname.startsWith("/api")) {
      if (request.method === "OPTIONS") {
        const response = await handleApi(request, url);
        return response ?? new Response("Not Found", { status: 404 });
      }
      const auth = requireAuth(request);
      if (auth) return auth;
      const response = await handleApi(request, url);
      return response ?? new Response("Not Found", { status: 404 });
    }

    return new Response("Not Found", { status: 404 });
  },
});

console.log(
  `memory MCP server listening on :${PORT} (/mcp) — auth: ${
    authEnabled() ? "bearer token" : "DEV MODE (set MCP_BEARER_TOKEN)"
  }`,
);
