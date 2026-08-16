---
title: Memory MCP Server
status: in-progress
owner: "@Michael-Obele"
tags:
  [mcp, tmcp, bun, valibot, neon-postgres, fly-io, agent-skills, dashboard, oauth, knowledge-graph]
estimated_time: "5-7 days"
prototype: false
demo_url: ""
---

# Memory MCP Server

A personal, remote knowledge-graph memory MCP server for AI coding agents — self-hosted on **Fly.io**, with a **bundled Agent Skill**, **MCP server instructions** (auto-injected into the model's system prompt), a **web dashboard**, and out-of-the-box support for **online AIs that speak MCP** (Grok, ChatGPT, Claude, Gemini, Perplexity).

**7 tools. 1 purpose: remember everything so your AI doesn't forget — and never needs to be reminded.**

## Why This Exists

The official MCP memory server is a local JSONL file — no remote access, no semantic search, no scaling. FlarelyLegal/memory-mcp solves the remote problem but ships **17 tools** with RBAC, audit trails, conversations, and admin workflows — overkill for personal use.

The 2026 hosted options went the other direction: mem0's local server is gone (hosted-only now, OAuth SaaS), basic-memory is local Markdown, and team products (Context Cloud, Zep) are enterprise-shaped. **Nobody ships a self-hosted, single-user, remote knowledge-graph memory server with a dashboard and a skill.** That's the gap this plan fills — the Goldilocks version, on infra you control.

## What Changed in This Revision (2026-08-15)

Revived from `archive/` with major new scope:

| Change | Why |
| ------ | --- |
| **Fly.io** instead of Oracle Cloud + Coolify | No VM babysitting; scale-to-zero fits free tier; official MCP hosting docs; `fly mcp proxy` for old clients |
| **MCP server instructions** | The server sends a usage contract in the `initialize` handshake; clients (Claude Code, Codex, Copilot, Goose, VS Code) inject it into the system prompt automatically → **no manual reminder prompt needed** |
| **Bundled Agent Skill** (`skills/memory/`) | Open Agent Skills standard (`SKILL.md`) works in Zed, Cursor, Claude Code, Codex, OpenCode — teaches any editor how to use the memory tools properly |
| **Web dashboard** | Static SPA on **Netlify** (free CDN, existing `svelte-apps.me` domain); API + MCP stay on Fly with a CORS allowlist — the dashboard never wakes the Fly VM |
| **Online AI support** | Grok, ChatGPT, Claude web, Gemini (Spark), Perplexity, Le Chat all accept remote MCP connectors → memory follows you to the web |
| **OAuth 2.1** (Phase 2) | Required by ChatGPT/Gemini/Grok-style connectors; `@tmcp/auth` + Fly.io secret; Phase 1 = Bearer token |

## Architecture

```
                        ┌─────────────────────────────────┐
                        │         Browser (you)            │
                        │  memory.svelte-apps.me           │
                        │  Dashboard SPA (static,          │
                        │  served from Netlify CDN)        │
                        └───────────────┬─────────────────┘
                                        │ HTTPS + Bearer token / PKCE
                                        ▼
┌────────────────────────┐   ┌────────────────────────────────────┐
│       MCP Clients       │   │       Fly.io App (Bun.serve)       │
│                         │   │                                    │
│  Local: Cursor, Zed,    │──▶│  /mcp     TMCP server (7 tools +   │
│  Claude Code, Copilot,  │   │           instructions)            │
│  OpenCode               │   │  /api/*   REST (same auth, CORS    │
│  Web: Grok, ChatGPT,    │   │           allowlist)               │
│  Claude.ai, Gemini,     │   └───────────────┬────────────────────┘
│  Perplexity             │                   │ @neondatabase/serverless
└────────────────────────┘                   ▼
                              ┌────────────────────────────────────┐
                              │      Neon Postgres (Free Tier)      │
                              │  namespaces · entities · relations  │
                              └────────────────────────────────────┘
```

**Key decision (revised 2026-08-15):** the MCP endpoint and the REST API share **one Bun process** on **one Fly.io machine** — TMCP's `HttpTransport` mounts at `/mcp` inside an existing `Bun.serve` (verified against [tmcp.io docs](https://tmcp.io/docs/core/ctx)). The dashboard is a **static SPA on Netlify**: free CDN, instant loads, and it **never wakes the Fly VM** (which scales to zero) — the machine only spins up for real API calls from agents. Because the dashboard is a static build talking to `/api/*` via a build-time `PUBLIC_API_URL` env var + CORS allowlist, the hosting choice stays swappable (Netlify / Cloudflare Pages / Fly) with a one-line change.

## The 7 Tools

| #   | Tool               | Actions                            | What it does                                       |
| --- | ------------------ | ---------------------------------- | -------------------------------------------------- |
| 1   | `manage_namespace` | create, list, get, delete          | Organize memory into isolated spaces               |
| 2   | `manage_entity`    | create, get, update, delete, find  | Knowledge graph nodes (people, concepts, projects) |
| 3   | `manage_relation`  | create, delete, list               | Directed edges between entities                    |
| 4   | `manage_memory`    | create, get, update, delete, query | Facts/observations with importance scoring         |
| 5   | `search`           | —                                  | Unified keyword + metadata search across all data  |
| 6   | `traverse_graph`   | —                                  | BFS walk the knowledge graph from an entity        |
| 7   | `consolidate`      | —                                  | Decay sweep + dedup + maintenance                  |

**Why 7 instead of 17:** FlarelyLegal separates entity search, memory queries, messages, conversations, and admin into separate tools. By using `action` enums inside `manage_*` tools, the LLM surface stays clean while covering all capabilities. No RBAC, no conversations, no audit trails — those are team features we don't need. (Semantic/vector search is a deliberate **future** upgrade — see [Milestones](#milestones) — so `search` stays keyword+metadata for v1.)

## Tool Behavior Spec (v1 — implement exactly this)

Enough for an agent to implement every tool without re-deriving intent. The DB schema above is authoritative; this section defines semantics. All text matching is case-insensitive.

**Namespaces** — `manage_namespace` actions: `create` (name, description?), `list` (with counts), `get` (by id or name), `delete` (cascades entities → relations/memories via FKs). Seed a default `personal` namespace in the seed step.

**Entities** — `manage_entity` actions:

- `create`: name (required), type (required), summary?, importance? (0-1, default 0.5), metadata?
- `get`: by id → entity + linked memories (via `memory_entity_links`) + in/out relations
- `update`: any subset of name/type/summary/importance/metadata; bump `updated_at`
- `delete`: cascades relations (FK); **unlinks but keeps** linked memories
- `find`: by name (exact or substring) + optional type + optional namespace; return up to 10

**Relations** — `create` (source_id, target_id, relation_type, weight?): on UNIQUE(source, target, relation_type) conflict, **update weight instead of erroring**. `delete` by id. `list`: by entity (in + out) or by namespace.

**Memories** — `manage_memory` actions:

- `create`: content (required), type (fact|observation|preference|instruction, default fact), importance (default 0.5), namespace (default personal), entity_ids (0-3) → insert links
- `get`: by id
- `update`: content/type/importance/metadata; entity_ids **replaces** the link set
- `query`: filters type, namespace, importance_min, archived; order importance DESC, updated_at DESC; limit default 20, max 50

**search** — one `q` param (required), optional namespace + type + limit (default 10, max 25). Case-insensitive substring match over `memories.content`, `entities.name`, `entities.summary`. Rank: exact word match > substring match, then importance DESC, then updated_at DESC. Return a merged, de-duplicated list with `kind` (memory|entity), id, snippet, score. Empty `q` → return recent items (updated_at DESC, limit 10).

**traverse_graph** — start entity id, depth (default 1, max 3). BFS over relations in both directions; return nodes + edges (same shape as `/api/graph` in dashboard.md). Deduplicate visited entities.

**consolidate** — idempotent maintenance sweep, returns counts of what it did:

1. **Archive stale**: memories with importance < 0.3 AND updated_at older than 90 days → `archived = true`
2. **Dedup**: within each namespace, trimmed case-insensitive exact content match → keep highest importance (tie: oldest), archive the rest
3. **Purge**: hard-delete rows archived for more than 30 days
4. No LLM calls, no embeddings — pure SQL

## Remember Without Being Asked: Server Instructions

This is the mechanism that makes the "no reminder" workflow real. The MCP protocol has an optional **`instructions`** field in the `InitializeResult`: the server sends a usage contract during the handshake, and supporting clients inject it into the model's **system prompt** — the model reads it before any tool schemas or user messages.

TMCP supports this natively (verified against [tmcp.io/docs/core/mcp-server](https://tmcp.io/docs/core/mcp-server) — Server instructions section):

```typescript
const server = new McpServer(
  { name: "memory", version: "1.0.0" },
  {
    adapter: new ValibotJsonSchemaAdapter(),
    capabilities: { tools: {} },
    instructions: MEMORY_CONTRACT, // ← injected into the model's system prompt
  },
);
```

### The contract (draft — `src/instructions.ts`)

```
You are connected to the user's personal memory server. It stores a
knowledge graph (entities, relations, memories) in namespaces (default
"personal") about the user's projects, preferences, decisions, people,
conventions, and technical stack.

Usage contract:
1. BEFORE starting meaningful work, call `search` with the user's current
   task and topic keywords to recall relevant memories.
2. WHEN you learn a durable fact (preference, decision, project fact,
   convention, person), call `manage_memory` with action=create, and link
   it to entities via the entity_ids field — creating entities with
   `manage_entity` (action=create) as needed.
3. PREFER update over duplicate: search first, then `manage_memory`
   action=update or `manage_entity` action=update.
4. USE `manage_relation` to connect related entities (e.g. "project X
   uses tool Y", "user prefers Z").
5. SCORE importance 0-1: 0.9+ core identity/preferences, 0.6-0.8 project
   facts, 0.3-0.5 normal observations, <=0.2 transient details.
6. DO NOT store: ephemeral chat content, code snippets, credentials,
   secrets, or anything the user would not want persisted.
7. If a search returns nothing, say so plainly — do not fabricate memories.
```

**Caveat (verified):** support varies by client. As of late 2025/2026, **Claude Code, Codex, VS Code Copilot Chat, Goose, and Claude Desktop** inject `instructions` into the system prompt; Cursor's handling varies and some clients ignore it entirely ([MCP maintainer blog, Nov 2025](https://blog.modelcontextprotocol.io/posts/2025-11-03-using-server-instructions/)). That's exactly why the **skill** exists — it carries the same contract through the skill mechanism, which works in every editor regardless of `instructions` support. Belt and suspenders.

## The Bundled Skill

An Agent Skill (`SKILL.md`, open standard at [agentskills.io](https://agentskills.io)) that ships in the server repo and teaches any AI editor **how** to use the memory server: when to recall, when to write, tool-by-tool guidance, examples, and guardrails.

- Works in: **Zed** (`~/.agents/skills/`), **Cursor** (`.cursor/skills/`), **Claude Code** (`.claude/skills/`), **Codex** (`.codex/skills/`), **OpenCode**
- Same contract as server instructions, but loaded on demand by the skill system — so editors that ignore `instructions` still behave correctly
- Full draft + install matrix: [skill.md](./skill.md)

## The Dashboard

A web UI served from the same Fly.io app (`/`), talking to the same database through a small REST API (`/api/*`) with the same auth:

- 🔍 Search all memories/entities; browse by namespace, type, importance
- 🕸️ Interactive knowledge-graph view (cytoscape.js)
- ✏️ CRUD on memories, entities, relations directly from the browser
- 📊 Stats: counts, top entities, recent memories, decay/consolidation status
- 🔗 "Connect an AI" page: copy-paste configs for Grok, ChatGPT, Claude, etc.

Built with **Svelte 5 + SvelteKit (`adapter-static`)** → static build hosted free on **Netlify** at `memory.svelte-apps.me` (existing domain); talks to the Fly API over CORS. Hosting is swappable (Cloudflare Pages / Fly) via one env var.

Full spec: [dashboard.md](./dashboard.md)

## Database Schema (Neon Postgres)

```sql
-- Namespaces: isolated memory containers
CREATE TABLE namespaces (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT DEFAULT '',
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- Entities: nodes in the knowledge graph
CREATE TABLE entities (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  namespace_id  UUID NOT NULL REFERENCES namespaces(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  type          TEXT NOT NULL,          -- 'person', 'concept', 'project', 'tool', etc.
  summary       TEXT DEFAULT '',
  metadata      JSONB DEFAULT '{}',
  importance    REAL DEFAULT 0.5,       -- 0.0 to 1.0
  access_count  INT DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_entities_namespace ON entities(namespace_id);
CREATE INDEX idx_entities_type ON entities(type);

-- Relations: weighted directed edges
CREATE TABLE relations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  namespace_id  UUID NOT NULL REFERENCES namespaces(id) ON DELETE CASCADE,
  source_id     UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  target_id     UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  relation_type TEXT NOT NULL,          -- 'knows', 'uses', 'depends_on', 'part_of', etc.
  weight        REAL DEFAULT 0.5,       -- 0.0 to 1.0
  created_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(source_id, target_id, relation_type)
);

CREATE INDEX idx_relations_source ON relations(source_id);
CREATE INDEX idx_relations_target ON relations(target_id);

-- Memories: knowledge fragments (observations, facts, preferences)
CREATE TABLE memories (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  namespace_id  UUID NOT NULL REFERENCES namespaces(id) ON DELETE CASCADE,
  content       TEXT NOT NULL,
  type          TEXT DEFAULT 'fact',    -- 'fact', 'observation', 'preference', 'instruction'
  importance    REAL DEFAULT 0.5,       -- 0.0 to 1.0, higher = decays slower
  source        TEXT,                   -- where this came from (client name)
  metadata      JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),
  archived      BOOLEAN DEFAULT FALSE   -- marked for deletion by consolidation
);

CREATE INDEX idx_memories_namespace ON memories(namespace_id);
CREATE INDEX idx_memories_type ON memories(type);

-- Many-to-many link between memories and entities
CREATE TABLE memory_entity_links (
  memory_id UUID NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  PRIMARY KEY (memory_id, entity_id)
);

-- OAuth clients (Phase 2, @tmcp/auth)
CREATE TABLE oauth_clients (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     TEXT NOT NULL UNIQUE,
  client_secret TEXT,                   -- NULL for public (PKCE) clients
  name          TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT now()
);
```

## Project Structure

A **Bun workspace monorepo**: one repo, one lockfile, and three deploy entries — Fly.io builds the server from the root `Dockerfile`, Netlify builds `dashboard/` from `netlify.toml`, and the skill is installed by a script (no build). Each environment installs only what it needs (`bun install --filter ...`).

```
mcp-memory-server/                    # git repo — Bun workspace monorepo
├── package.json                      # name "memory-server"; workspaces: ["packages/*", "dashboard"]; root scripts
├── bun.lock                          # ONE lockfile for the whole repo
├── tsconfig.json
├── Dockerfile                        # ← Fly.io entry: installs ONLY the server's deps (--filter)
├── fly.toml                          # ← Fly.io deploy config
├── netlify.toml                      # ← Netlify entry: builds dashboard, publishes dashboard/build
├── .dockerignore                     # node_modules, dashboard/build, .git
├── .env.example
├── src/                              # ← SERVER (deployed by Fly.io)
│   ├── index.ts                      # Bun.serve: mounts /mcp + /api/* (CORS)
│   ├── instructions.ts               # The memory contract (system prompt injection)
│   ├── auth.ts                       # Bearer token check (Phase 1) / OAuth guard (Phase 2)
│   ├── db.ts                         # Neon Postgres connection + query helpers
│   ├── tools/                        # 7 tools (schemas imported from @memory/shared)
│   │   ├── namespace.ts              # manage_namespace tool
│   │   ├── entity.ts                 # manage_entity tool
│   │   ├── relation.ts               # manage_relation tool
│   │   ├── memory.ts                 # manage_memory tool
│   │   ├── search.ts                 # search tool
│   │   ├── traverse.ts               # traverse_graph tool
│   │   └── consolidate.ts            # consolidate tool
│   ├── lib/                          # CRUD + search + graph + decay (shared by tools and /api/*)
│   │   ├── entities.ts
│   │   ├── relations.ts
│   │   ├── memories.ts
│   │   ├── search.ts
│   │   ├── graph.ts                  # Graph traversal (BFS)
│   │   └── consolidate.ts            # Decay + cleanup logic
│   └── api/                          # REST handlers for the dashboard
│       └── routes.ts                 # /api/* router (same auth as /mcp)
├── packages/
│   └── shared/                       # ← SHARED types + Valibot schemas (no build step)
│       ├── package.json              # name "@memory/shared"; "exports": { ".": "./src/index.ts" }
│       └── src/
│           ├── index.ts              # re-exports
│           ├── schemas.ts            # Valibot schemas: entity / relation / memory / search
│           └── types.ts              # constants: memory types, relation types, importance bounds
├── dashboard/                        # ← DASHBOARD (deployed by Netlify)
│   ├── package.json                  # name "memory-dashboard"; depends on @memory/shared
│   ├── svelte.config.js
│   ├── vite.config.ts
│   └── src/
│       ├── routes/
│       │   ├── +page.svelte          # search + recent memories
│       │   ├── entities/[id]/+page.svelte
│       │   ├── memories/+page.svelte
│       │   ├── graph/+page.svelte
│       │   └── connect/+page.svelte  # per-AI connector configs
│       └── lib/
│           └── api.ts                # fetch wrapper w/ bearer token
├── skills/
│   └── memory/                       # ← SKILL (static; installed by script — no deploy)
│       ├── SKILL.md
│       └── references/
│           └── tools.md              # generated from @memory/shared schemas (scripts/gen-skill-ref.ts)
├── sql/
│   └── schema.sql                    # Database schema (above)
└── scripts/
    ├── install-skill.sh              # copies skills/memory into the right dir per editor
    ├── gen-skill-ref.ts              # regenerates references/tools.md from shared schemas
    └── seed.ts                       # optional: demo namespace + sample memories
```

```json
// packages/shared/package.json — types + schemas only, imported as TS directly (no build step)
{
  "name": "@memory/shared",
  "version": "0.1.0",
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "dependencies": { "valibot": "^1" }
}
```

Server and dashboard both depend on it via `"@memory/shared": "workspace:*"`. Bun links it into `node_modules`; the server imports it natively and Vite resolves it in the SvelteKit build — no build step, no bundler config.

**How each deploy environment picks its entry:**

| Deploy target | Entry | Build | Run |
| ------------- | ----- | ----- | --- |
| Fly.io | root `Dockerfile` + `fly.toml` | Docker: `bun install --frozen-lockfile --filter memory-server` | `bun run src/index.ts` |
| Netlify | root `netlify.toml` | `bun install` (workspaces) → `cd dashboard && bun run build` | serves `dashboard/build` |
| Editors (skill) | `scripts/install-skill.sh` | none (static files) | n/a |

Root convenience scripts: `bun run dev` (server), `bun run dev:dashboard`, `bun run deploy:server`, `bun run deploy:dashboard`, `bun run install:skill`, `bun run gen:skill-ref`.

---

## Part 1: Deploy on Fly.io

Prereqs: `flyctl` installed (`curl -L https://fly.io/install.sh | sh`), logged in (`fly auth login`), and a Fly account (free tier: 3 shared-cpu-1x 256MB VMs, 160GB outbound).

### 1.1 Create the app

```bash
fly apps create mcp-memory
```

### 1.2 Dockerfile

```dockerfile
FROM oven/bun:1-slim

WORKDIR /app

# 1) Workspace manifests + lockfile first → Docker layer caching.
#    NOTE: Bun validates the ENTIRE workspace graph against the lockfile, so all
#    workspace package.jsons must be copied even though we only install the server
#    (documented Bun gotcha — see notes.md).
COPY package.json bun.lock ./
COPY packages/shared/package.json packages/shared/
COPY dashboard/package.json dashboard/

# 2) Install ONLY the server's deps — SvelteKit/dashboard never enters the image
RUN bun install --frozen-lockfile --filter memory-server

# 3) Source — .dockerignore keeps node_modules, dashboard/build, .git out
COPY . .

# The dashboard is NOT built here — it deploys to Netlify (see dashboard.md).
# This image runs only the MCP server + REST API.

EXPOSE 8080
CMD ["bun", "run", "src/index.ts"]
```

### 1.3 fly.toml

```toml
app = "mcp-memory"
primary_region = "iad"

[build]
  dockerfile = "Dockerfile"

[http_service]
  internal_port = 8080
  force_https = true
  auto_stop_machines = "stop"   # scale to zero when idle
  auto_start_machines = true
  min_machines_running = 0      # 0 = free tier friendly; set 1 for always-on

[vm]
  memory = "256mb"
  cpu_kind = "shared"
  cpus = 1
```

> ⚠️ **Do not add a `/health` HTTP check.** Fly's smoke checks send raw HTTP GETs that confuse Streamable HTTP servers (verified against [Fly's own guide](https://fly.io/docs/mcp/transports/streaming-http/)). Create with `fly launch --ha=false --smoke-checks=false` or keep `min_machines_running = 0` and no checks block. If you want a health endpoint, expose `GET /healthz` from Bun and add a TCP check via `[http_service.checks]` with `path = "/healthz"` and a short grace period — test before relying on it.

### 1.4 Secrets

Never put credentials in the image:

```bash
fly secrets set DATABASE_URL="postgresql://..."      # Neon pooled connection
fly secrets set MCP_BEARER_TOKEN="$(openssl rand -hex 32)"
fly secrets set DASHBOARD_PASSWORD="$(openssl rand -hex 16)"   # Phase 1 dashboard login
# Phase 2: fly secrets set OAUTH_JWK_SECRET="..." (see Part 4)
```

### 1.5 Deploy + verify

```bash
fly deploy

# Smoke test the MCP endpoint (expect 401 without a token — that's correct)
curl -i https://mcp-memory.fly.dev/mcp

# With token — expect a JSON-RPC error for a bare POST, or use the inspector:
npx @modelcontextprotocol/inspector
# Transport: Streamable HTTP, URL: https://mcp-memory.fly.dev/mcp, headers: Authorization: Bearer <token>
```

## Part 2: Setup Neon Postgres

1. Create a project at [neon.tech](https://neon.tech) (free tier: 0.5 GB, 100 CU-hours/mo — plenty for ~10K memories).
2. Copy the pooled connection string → `fly secrets set DATABASE_URL=...` (the `-pooler` one, port 5432, so scale-to-zero wake-ups are cheap).
3. Apply the schema:

```bash
psql "$DATABASE_URL" -f sql/schema.sql
```

Also seed the default namespace: `INSERT INTO namespaces (name, description) VALUES ('personal', 'Default namespace') ON CONFLICT DO NOTHING;`

## Part 3: Build the Server

### 3.1 Scaffold + deps (workspace monorepo)

```bash
mkdir mcp-memory-server && cd mcp-memory-server && git init
bun init -y                              # root package.json → name: "memory-server"
# add to root package.json:
#   "workspaces": ["packages/*", "dashboard"]
#   scripts: dev / dev:dashboard / deploy:server / deploy:dashboard / install:skill

bun add tmcp @tmcp/transport-http @tmcp/adapter-valibot valibot @neondatabase/serverless

mkdir -p packages/shared/src
cd packages/shared && bun init -y        # name: "@memory/shared", exports ./src/index.ts
cd ../..
bunx sv create dashboard                 # SvelteKit + adapter-static + Tailwind

bun add @memory/shared@workspace:*       # from repo root: links shared into server
cd dashboard && bun add @memory/shared@workspace:*   # links shared into dashboard
cd ..

bun install                              # ONE lockfile for the whole repo
# Phase 2: bun add @tmcp/auth
```

### 3.2 Entry point — one process, two surfaces (MCP + API)

```typescript
// src/index.ts
import { McpServer } from "tmcp";
import { HttpTransport } from "@tmcp/transport-http";
import { ValibotJsonSchemaAdapter } from "@tmcp/adapter-valibot";
import { neon } from "@neondatabase/serverless";
import { MEMORY_CONTRACT } from "./instructions";
import { requireAuth } from "./auth";
import { apiRoutes } from "./api/routes";
import { registerNamespaceTools } from "./tools/namespace";
import { registerEntityTools } from "./tools/entity";
import { registerRelationTools } from "./tools/relation";
import { registerMemoryTools } from "./tools/memory";
import { registerSearchTools } from "./tools/search";
import { registerTraverseTools } from "./tools/traverse";
import { registerConsolidateTools } from "./tools/consolidate";

const sql = neon(process.env.DATABASE_URL!);
export type Db = typeof sql;

const server = new McpServer(
  { name: "memory", version: "1.0.0" },
  {
    adapter: new ValibotJsonSchemaAdapter(),
    capabilities: { tools: {} },
    instructions: MEMORY_CONTRACT, // ← system-prompt injection
  },
).withContext<{ db: Db }>();

// Register the 7 tools (see 3.3 for the pattern)
registerNamespaceTools(server);
registerEntityTools(server);
registerRelationTools(server);
registerMemoryTools(server);
registerSearchTools(server);
registerTraverseTools(server);
registerConsolidateTools(server);

const transport = new HttpTransport(server, { path: "/mcp" });

// The Netlify-hosted dashboard calls /api/* cross-origin — allowlist it.
const ALLOWED_ORIGINS = [
  "https://memory.svelte-apps.me", // Netlify dashboard (prod)
  "http://localhost:5173",         // SvelteKit dev server
];

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin") ?? "";
  if (!ALLOWED_ORIGINS.includes(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
  };
}

Bun.serve({
  port: 8080,
  async fetch(request) {
    const url = new URL(request.url);

    // CORS preflight for the dashboard's cross-origin API calls
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    // 1) MCP endpoint — Streamable HTTP, bearer-token guarded (no CORS: MCP clients aren't browsers)
    if (url.pathname.startsWith("/mcp")) {
      const auth = requireAuth(request);           // Phase 1
      if (auth instanceof Response) return auth;   // 401
      const response = await transport.respond(request, { db: sql });
      return response ?? new Response("Not Found", { status: 404 });
    }

    // 2) REST API for the dashboard — same auth, CORS allowlisted
    if (url.pathname.startsWith("/api/")) {
      const auth = requireAuth(request);
      if (auth instanceof Response) return auth;
      const response = await apiRoutes(request, { db: sql });
      return new Response(response.body, {
        status: response.status,
        headers: { ...response.headers, ...corsHeaders(request) },
      });
    }

    return new Response("Not Found", { status: 404 });
  },
});
```

### 3.3 Tool registration pattern (one file per tool)

```typescript
// src/tools/entity.ts
import { v } from "valibot";
import { McpServer, tool } from "tmcp";

const EntitySchema = v.object({
  name: v.pipe(v.string(), v.minLength(1)),
  type: v.string(),
  summary: v.optional(v.string(), ""),
  importance: v.optional(v.pipe(v.number(), v.minValue(0), v.maxValue(1)), 0.5),
  metadata: v.optional(v.record(v.string(), v.unknown()), {}),
});

export function registerEntityTools(server: McpServer) {
  server.tool(
    {
      name: "manage_entity",
      description:
        "Create, get, update, delete, or find entities (knowledge graph nodes: people, projects, concepts, tools). " +
        "Actions: create | get | update | delete | find.",
      schema: v.object({
        action: v.union([v.literal("create"), v.literal("get"), v.literal("update"), v.literal("delete"), v.literal("find")]),
        namespace: v.optional(v.string(), "personal"),
        id: v.optional(v.string()),
        entity: v.optional(EntitySchema),
        query: v.optional(v.string()),
        type: v.optional(v.string()),
      }),
    },
    async (args) => {
      const { db } = server.ctx.custom!;
      // ... CRUD against `db` (see lib/entities.ts), returning tool.text(...)
      return tool.text("Entity created: " + id);
    },
  );
}
```

> The full 7-tool implementation (create/get/update/delete/find + search + BFS + decay) follows this exact pattern; business logic lives in `src/lib/*`. See the archived v1 notes for reference code — same tools, same schema, new hosting.

### 3.4 Auth guard (Phase 1 — Bearer token)

```typescript
// src/auth.ts
export function requireAuth(request: Request): Response | null {
  const expected = process.env.MCP_BEARER_TOKEN;
  if (!expected) return null; // dev mode
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (token === expected) return null;
  return Response.json({ error: "unauthorized" }, {
    status: 401,
    headers: { "WWW-Authenticate": 'Bearer realm="mcp-memory"' },
  });
}
```

> For online AIs (ChatGPT/Gemini/Grok), **OAuth 2.1 is required** — see Part 4. Bearer-token mode still works for Claude connectors, Cursor, Claude Code, Zed, Copilot (static headers), and any client that supports `Authorization` headers.

## Part 4: Authentication

| Phase | Method | Works with | Effort |
| ----- | ------ | ---------- | ------ |
| **1 (ship first)** | Static Bearer token (`MCP_BEARER_TOKEN`) | Claude web/desktop/Code, Claude Code, Cursor, Zed, VS Code Copilot, OpenCode, Grok (if it supports custom headers — verify), any header-capable client | ~30 min |
| **2 (required for full web support)** | **OAuth 2.1 + PKCE + dynamic client registration** | ChatGPT (Plus+), Gemini Spark, Perplexity, Le Chat, Grok — paste-URL-and-sign-in | ~1 day |

Phase 2 plan: use `@tmcp/auth` (TMCP's first-party auth package, [tmcp.io/docs/auth/oauth](https://tmcp.io/docs/auth/oauth)). Fly.io runs the auth server on the same app:

- `/.well-known/oauth-protected-resource` (RFC 9728) — TMCP/auth provides this
- `/.well-known/oauth-authorization-server` (RFC 8414) — for clients that need discovery
- Dynamic client registration endpoint (RFC 7591) — so ChatGPT/Gemini don't need manual client IDs
- Authorization endpoint: a small HTML login page (`DASHBOARD_PASSWORD`, or email OTP later) issuing PKCE-verified codes
- JWKS endpoint — Fly.io secret `OAUTH_JWK_SECRET` as the signing key (or use `ssokenizer`/`tokenizer` from Superfly to delegate)

**Test with:** `npx @modelcontextprotocol/inspector` (supports OAuth flow), Claude Code (`/mcp` authorize), Codex (`codex mcp login`).

## Part 5: Connect Clients

### Local editors (Phase 1 — bearer token)

**Cursor** (`.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "memory": {
      "type": "http",
      "url": "https://mcp-memory.fly.dev/mcp",
      "headers": { "Authorization": "Bearer YOUR_TOKEN" }
    }
  }
}
```

**Claude Code**:

```bash
claude mcp add --transport http memory https://mcp-memory.fly.dev/mcp \
  --header "Authorization: Bearer YOUR_TOKEN"
```

**Zed** (Settings → Agent → MCP):

```json
{
  "mcp": {
    "memory": {
      "type": "http",
      "url": "https://mcp-memory.fly.dev/mcp",
      "headers": { "Authorization": "Bearer YOUR_TOKEN" }
    }
  }
}
```

**VS Code Copilot** (`.vscode/mcp.json`): same shape as Cursor.

**Older clients (stdio-only)** — use Fly's shim: `fly mcp proxy https://mcp-memory.fly.dev/mcp` (or `npx mcp-remote` with `--header "Authorization: Bearer ..."`).

### Online AIs (Phase 2 — OAuth; verified support as of mid-2026)

| AI | Where | Plan/plan-gate | Transport |
| -- | ----- | -------------- | --------- |
| **Claude** (claude.ai) | Settings → Connectors → Add custom connector → paste URL | Every plan (Free = 1 connector) | Streamable HTTP + OAuth (optional) |
| **Grok** (xAI) | grok.com/connectors → New Connector → Custom | Paid plans | Streamable HTTP + OAuth |
| **ChatGPT** | Settings → Apps → Developer mode → Create (paste URL, Scan Tools) | Plus and up, web only | Streamable HTTP + **OAuth required** |
| **Gemini** | Settings → Connected Apps → Custom apps for Spark → Add | Google AI Pro/Ultra (Spark); Antigravity is free preview | Streamable HTTP + OAuth (DCR) |
| **Perplexity** | Settings → Connectors → + Custom connector → Remote | Pro/Max/Enterprise | Streamable HTTP + OAuth |
| **Le Chat** (Mistral) | Connectors → + Add Connector → Custom | Free/paid | OAuth 2.1 + DCR auto-detect |

> All of these connect from the **provider's cloud**, so the server must be publicly reachable (it is — Fly.io with `force_https`). Local-only stdio configs won't work on web platforms; Streamable HTTP is the universal transport.

## Part 6: Dashboard

Full spec in [dashboard.md](./dashboard.md). Quick summary:

- SvelteKit (`adapter-static`) → `dashboard/build/` → deployed to **Netlify** (free CDN) at `memory.svelte-apps.me`
- REST API at `/api/*` on Fly (same Bearer token; Phase 2 uses a **PKCE OAuth login** — session cookies can't cross origins)
- Pages: search/home, entity detail, memories browser, **graph view**, connect-an-AI helper
- Deploy: `netlify deploy --prod` or Git-connected repo (see dashboard.md); Fly API has a CORS allowlist for the dashboard origin

## Part 7: Ship the Skill

Full skill draft + install matrix in [skill.md](./skill.md). Quick summary:

- Repo path: `skills/memory/SKILL.md` (+ `references/tools.md`)
- Install: `bun run scripts/install-skill.sh` (detects `~/.agents/skills`, `.cursor/skills`, `.claude/skills`, `.codex/skills`)
- It teaches: when to recall (`search` first), when to persist (`manage_memory`/`manage_entity`/`manage_relation`), importance scoring, dedup-before-write, and what **not** to store

## Milestones

| # | Milestone | Exit criteria | Est. |
| - | --------- | ------------- | ---- |
| M1 | Server on Fly.io, Bearer auth, 7 tools | Inspector connects; CRUD works end-to-end against Neon | 2 days |
| M2 | Server instructions + skill | New chat in Claude Code recalls a memory without a reminder prompt; skill works in Zed + Cursor | 1 day |
| M3 | REST API + SvelteKit dashboard on Netlify (CORS wired) | Browse/search/graph/CRUD from browser at `memory.svelte-apps.me`; stats load | 1.5 days |
| M4 | OAuth 2.1 (`@tmcp/auth`) | `codex mcp login` + inspector OAuth flow succeed; Claude connector works | 1 day |
| M5 | Online AI rollout | Grok + ChatGPT + Gemini connectors authorized; memory usable from web chats | 0.5 day |

**Release gate:** everything in M1-M3 works in a fresh chat with zero reminder prompts (verified via instructions + skill), and the dashboard shows the same data the agents write.

## Cost Breakdown (per month)

| Item | Cost | Notes |
| ---- | ---- | ----- |
| Fly.io (1 shared-cpu 256MB VM, scale-to-zero) | **$0** | Free tier includes 3 such VMs; scale-to-zero = idle costs nothing |
| Netlify (dashboard, static SPA) | **$0** | Free plan: 300 credits/mo (bandwidth 20/GB, deploy 15 each); a lean SPA uses ~20-60/mo |
| Neon Postgres free tier | **$0** | 0.5 GB, 100 CU-hours — fine for ~10K memories |
| Domain (optional) | $0–12/yr | `mcp-memory.fly.dev` + `memory.svelte-apps.me` subdomain are free |
| **Total** | **$0** | Always-on variant (`min_machines_running = 1`): ~$1–3/mo |

## Security & Privacy Notes

- All traffic TLS (`force_https = true`)
- Bearer token never in the image — `fly secrets set` only
- The memory store may contain personal data → the OAuth consent screen (Phase 2) should list scopes (`memory:read`, `memory:write`) and the dashboard shows what's stored
- `consolidate` purges `archived` rows; add a retention rule (e.g., importance < 0.2 and unaccessed 90 days → archive) as a follow-up
- **Don't** store credentials/secrets in memory — the contract forbids it; the dashboard should offer a per-memory "sensitive" flag as a future hardening step

## Future Enhancements

- **Semantic search**: pgvector on Neon (paid tier) or a small embeddings service; upgrade `search` to hybrid
- **Multi-user namespaces**: per-person namespaces + shared read-only access for a second device
- **Memory ingestion API**: browser extension or CLI to dump chat transcripts into memory
- **MCP resources**: expose the graph as `memory://` resources so clients can subscribe
- **Zed/Claude Code plugin packaging**: publish the skill to skills.sh and an MCP marketplace
- **Hosting swap**: the dashboard is a static build — moving it to Cloudflare Pages (or back to Fly) is one env var + one CORS allowlist entry

## Related Documents

- [skill.md](./skill.md) — the bundled Agent Skill (draft SKILL.md + install matrix)
- [dashboard.md](./dashboard.md) — web dashboard spec (REST API, pages, graph view)
- [arch.md](./arch.md) — architecture decisions (Bun, TMCP, Neon, Fly.io, instructions+skill, auth)
- [notes.md](./notes.md) — research notes, competition analysis, citations (Aug 2026)

[Back to top](#memory-mcp-server)
