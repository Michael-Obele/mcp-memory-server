---
title: Architecture Decisions
status: in-progress
---

# Architecture Decisions

## Why Bun over Node.js?

| Criteria           | Bun                       | Node.js              |
| ------------------ | ------------------------- | -------------------- |
| Startup time       | ~30ms                     | ~200ms               |
| Package install    | 5-10x faster              | Baseline             |
| TypeScript native  | ✅ Built-in               | ❌ Needs ts-node/tsx |
| TMCP compatibility | ✅ (HTTP transport works) | ✅                   |
| `Bun.serve` single-process app (MCP + API + static) | ✅ First-class | ⚠️ Needs extra wiring |
| **Winner**         | **Bun**                   | —                    |

Bun's fast startup matters for an MCP server that may cold-start on Fly's scale-to-zero and Neon's scale-to-zero database. Every millisecond counts when an AI agent is waiting.

## Why TMCP over Cloudflare Agents SDK / raw SDK?

TMCP gives us:

- Clean, composable API with Valibot schema support (Standard Schema)
- `instructions` support **built into the `McpServer` config** (verified: tmcp.io/docs/core/mcp-server)
- `HttpTransport` that **mounts at a path inside an existing `Bun.serve`** (verified: `new HttpTransport(server, { path: "/mcp" })` + `transport.respond(request)` in your own fetch handler) — this is what makes the single-process MCP + REST + dashboard app possible
- `@tmcp/auth` for OAuth 2.1 (authorization server + discovery endpoints)
- Runs anywhere Bun/Node/Deno/Workers runs

Cloudflare Agents SDK would lock us into Workers/Durable Objects and its `createMcpHandler` API, which is less elegant than TMCP and would force the dashboard into a separate Worker. Since we host on Fly.io, TMCP is the natural choice.

## Why Neon Postgres over SQLite / Fly Postgres?

| Criteria           | Neon Postgres         | SQLite          | Fly Postgres |
| ------------------ | --------------------- | --------------- | ------------ |
| Remote access      | ✅ (TCP/HTTP)         | ❌ (file-local) | ✅           |
| Serverless / scale-to-zero | ✅           | ❌              | ❌ (needs a VM always on) |
| Free tier          | ✅ 0.5GB              | ✅              | ❌ (billed VM) |
| Vector search      | ⚠️ (pgvector on paid) | ✅ (sqlite-vec) | ⚠️ (pgvector) |
| Ops burden         | None (managed)       | ✅ (local)      | ⚠️ (backups, upgrades) |
| **Winner**         | **Neon**              | —               | —            |

Since this is a _remote_ MCP server (not local), we need a network-accessible database. Neon is serverless Postgres with a generous free tier that scales to zero — matching Fly's scale-to-zero philosophy. Fly Postgres would work but adds a paid always-on VM and ops burden for zero benefit at this scale.

## Why Fly.io over Oracle Cloud + Coolify

| Approach            | Setup     | Cost        | Always-on | Ops burden | Notes |
| ------------------- | --------- | ----------- | --------- | ---------- | ----- |
| Oracle VM + Coolify | ⚠️ Medium | $0          | ✅        | High (patch the VM, babysit Coolify) | Best raw hardware deal, worst maintenance |
| **Fly.io** (chosen) | ✅ Easy   | $0 (scale-to-zero) | ⚠️ cold start ~1-2s | ✅ Low | Official MCP hosting docs, `fly mcp proxy`, `fly secrets`, TLS by default |
| Render              | ✅ Easy   | $0 (sleeps) | ❌        | ✅ Low | Sleeps on free tier; less MCP tooling |
| Railway             | ✅ Easy   | ~$5/mo      | ✅        | ✅ Low | Not free for long |

Oracle + Coolify won the original comparison on **cost + control**. This revision flips to Fly.io because:

1. **User preference** — explicit ask to host on Fly.io
2. **Maintenance** — a personal memory server doesn't justify patching an Oracle VM; Fly handles infra
3. **Scale-to-zero** — idle machine stops → effectively free, matching the $0 goal
4. **First-class MCP story** — Fly publishes [remote MCP server docs](https://fly.io/docs/blueprints/remote-mcp-servers/), [Streaming HTTP guide](https://fly.io/docs/mcp/transports/streaming-http/), and `fly mcp proxy` for legacy stdio-only clients
5. **Cold-start reality** — the server is a thin Bun process (~30ms start); a 1-2s cold start on first call per idle period is acceptable for personal use (and `min_machines_running = 1` costs ~$1-3/mo if it's not)

## Why 7 Tools Instead of 17

FlarelyLegal's 17 tools are split across:

```
namespaces (1)   → manage_namespace (1 tool, 4 actions)
entity (1)       → manage_entity (1 tool, 5 actions)
entity-search (1)│
relation (2)     → manage_relation (1 tool, 3 actions)
memory (1)       → manage_memory (1 tool, 5 actions)
memory-queries (1)│
search (1)       → search (1 tool)
traversal (1)    → traverse_graph (1 tool)
admin (5)        → consolidate (1 tool)
conversation (2) → REMOVED
message (2)      → REMOVED
                 ──────          ──────
                 17 tools        7 tools
```

**Removed:**

- **Conversations & Messages**: Personal use doesn't need per-conversation chat history. The knowledge graph (entities + relations + memories) is sufficient.
- **Admin tools** (reindex, workflow status, claim namespaces, namespace stats): Simplified into a single `consolidate` tool for decay/cleanup.
- **RBAC/namespace access tools**: No multi-user sharing needed.

## Why Server Instructions + A Skill (the "no reminders" design)

Two complementary channels, one contract (`src/instructions.ts`):

1. **MCP `instructions`** — sent in `InitializeResult`; clients that support it (Claude Code, Codex, VS Code Copilot Chat, Goose, Claude Desktop) inject it into the system prompt. The model then recalls before working and persists after learning — **without any user prompt**.
2. **Agent Skill** (`skills/sepia/SKILL.md`) — the open [Agent Skills](https://agentskills.io) standard, discovered by Zed, Cursor, Claude Code, Codex, OpenCode. Covers editors that ignore `instructions`.

Rationale: the MCP maintainers themselves recommend [server instructions for global usage guidance](https://blog.modelcontextprotocol.io/posts/2025-11-03-using-server-instructions/) — but client support is inconsistent, so the skill is the portable guarantee. This belt-and-suspenders pattern is exactly what Creed ships (server sends an "instructions field carrying the read-before-work contract").

## Why MCP + REST on Fly, Dashboard on Netlify

**MCP server + REST API** share one Bun process on one Fly.io machine (TMCP's `HttpTransport` mounts at `/mcp` inside `Bun.serve` — verified pattern). This keeps auth, business logic (`src/lib/*`), and deploys unified for everything an agent touches.

The **dashboard is a static SPA on Netlify** (revised 2026-08-15 — was: served from the Fly app):

| Criterion | Dashboard on Fly (old) | Dashboard on Netlify (new) |
| --------- | ---------------------- | -------------------------- |
| UI load time | Cold start 1-2s after idle (VM + Neon) | Instant from CDN, always warm |
| Fly usage | Every visit consumes Fly egress + wakes VM | Zero — VM stays asleep until an agent connects |
| Domain | `sepia.fly.dev/` | `sepia.svelte-apps.me` (already owned) |
| Deploys | UI + server coupled (one `fly deploy`) | Decoupled: `netlify deploy` doesn't touch the server |
| Cost | $0 (free tier) | $0 (300 free credits/mo; SPA uses ~20-60) |
| Extra wiring | None | CORS allowlist + preflight on the API |

**Why this wins:** the dashboard is a *browsing* surface, not an agent surface. It should never be the thing that wakes the machine or burns egress. The API stays the single source of truth — the dashboard is a pure static client of `/api/*`.

**Tradeoffs accepted:** (1) two deploy targets instead of one — mitigated because the dashboard is a static build with a build-time `PUBLIC_API_URL`; (2) CORS middleware on the API — one small allowlist, and the `/mcp` endpoint needs no CORS at all (MCP clients aren't browsers); (3) Phase 2 OAuth login for the dashboard uses **PKCE public-client** flow instead of session cookies (cookies can't cross origins) — a standard SPA pattern.

**Alternative rejected:** Cloudflare Pages — equally capable (500 builds/mo, unlimited bandwidth) and a zero-code swap, but the `svelte-apps.me` domain and existing Netlify setup make Netlify the zero-friction choice. The swap path is documented in the plan either way.

## Why a Bun Workspace Monorepo (not Turborepo, not plain folders)

The repo is a **Bun workspace monorepo** with three packages:

- `sepia` (root) — MCP server + REST API (deployed by Fly.io via root `Dockerfile`)
- `sepia-dashboard` (`dashboard/`) — SvelteKit SPA (deployed by Netlify via root `netlify.toml`)
- `@sepia/shared` (`packages/shared/`) — Valibot schemas, types, and constants; **no build step** (Bun and Vite both import TS directly)

| Criterion | Bun workspaces (chosen) | Plain folders (alternative) | Turborepo/Nx |
| --------- | ----------------------- | --------------------------- | ------------ |
| Shared schemas/types between server + dashboard | ✅ one `@sepia/shared` | ❌ duplicated types → drift | ✅ (but overkill) |
| Lockfiles | One `bun.lock` | Two (root + dashboard) | One |
| Install | `bun install` once at root | Per-folder installs | Task runner + config |
| Docker image size | `bun install --frozen-lockfile` keeps SvelteKit out | Same (per-folder) | Same |
| Tooling cost | Zero (Bun native) | Zero | New dep + config for 2 packages |
| Mental model | Workspaces + filter | Each folder = own repo | Workspaces + pipeline |

**Why workspaces win here:** the dashboard is a *second client* of the API. Sharing Valibot schemas (`packages/shared/schemas.ts`) means the dashboard's forms validate against exactly what the server enforces, and `scripts/gen-skill-ref.ts` generates `skills/sepia/references/tools.md` from the same schemas — three consumers, one source of truth.

**Why not Turborepo/Nx:** a task runner pays off with many packages, build-graph caching, and parallel pipelines. We have two packages and one edge; the server runs TS directly under Bun (no build), and SvelteKit has its own build. Ceremony without benefit.

**Why not plain folders:** workable, and the deploy configs would be identical — but you'd duplicate `entity`/`memory`/`relation` types and Valibot schemas in `src/` and `dashboard/`, and the skill-reference generator would have no schema source. The drift is exactly the bug this plan exists to avoid (agents writing memories that don't match the dashboard's expectations).

**Deploy entries:** each environment selects its package explicitly — Fly: root `Dockerfile` with `bun install --frozen-lockfile`; Netlify: root `netlify.toml` (installs workspace, builds `dashboard/`); skill: static install script. Documented in README → Project Structure.

**Docker gotcha (verified):** with `--frozen-lockfile`, Bun validates the whole workspace graph — so the Dockerfile must copy **every** workspace `package.json` (including `dashboard/`'s) before installing, even when filtering to the server ([vpontis/bun-workspace-docker-example](https://github.com/vpontis/bun-workspace-docker-example)). The layer-cached copy order in the README's Dockerfile handles this.

## Why Static SvelteKit for the Dashboard

- Svelte 5 / SvelteKit is the project's preferred stack
- `adapter-static` + SPA mode → plain files **any static host** (Netlify) can serve — no SSR server, no runtime cost
- All data via `/api/*` — the REST layer is the contract, the dashboard is a thin client (same `src/lib/*` the MCP tools use, so no API drift)
- Follow-up option: move to SSR (`adapter-netlify`) later without changing the API

## Why Bearer Token First, OAuth 2.1 Second

| Phase | Auth | Serves | Cost |
| ----- | ---- | ------ | ---- |
| 1 | Static `MCP_BEARER_TOKEN` | Claude, Cursor, Zed, Claude Code, Copilot, OpenCode — anything that sends headers | ~30 min |
| 2 | OAuth 2.1 + PKCE + DCR via `@tmcp/auth` | ChatGPT, Gemini Spark, Perplexity, Le Chat, Grok — paste-URL-and-sign-in | ~1 day |

OAuth is the 2026 default for hosted MCP servers (the spec mandates it for HTTP transports when protected), but a personal server with a bearer token is pragmatic and works with the local editors immediately. Phase 2 keeps the bearer token working as a fallback.

## Why Keyword Search (for now) Instead of Semantic

- v1 ships keyword + metadata search: deterministic, zero LLM/embedding cost, no extra services
- Semantic search (pgvector on Neon paid tier, or a small embedding endpoint) is a clean follow-up because `search` is already a single tool — swap the engine, keep the schema
- The official server-memory has no search at all; even keyword search is a step up, and it's honest about recall

## Oracle Cloud + Coolify Over PaaS — SUPERSEDED

The original v1 decision (Oracle + Coolify) is replaced by Fly.io per the table above. The v1 reasoning — $0 cost + full control + always-on — is preserved by Fly's free tier + scale-to-zero with far less maintenance. See [notes.md](./notes.md) for the refreshed hosting research.

[Back to Plan](./README.md)
