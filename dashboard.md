---
title: Web Dashboard Spec
status: in-progress
---

# Web Dashboard Spec

A web UI for the memory server: **see** what agents have stored, **search** it, **edit** it, and **connect** online AIs. Static SPA on **Netlify** (free CDN, existing `svelte-apps.me` domain), talking to the memory server's REST API on Fly.io.

## Goals

1. **Visibility** — browse every namespace, entity, relation, and memory the agents wrote (memory you can see is memory you can trust)
2. **Interaction** — search, edit, delete, create from the browser; fix bad memories agents wrote
3. **Graph view** — explore the knowledge graph visually
4. **Connect-an-AI** — copy-paste configs for Grok, ChatGPT, Claude, Gemini, Perplexity, and the local editors
5. **Stats** — what's in memory, what's decaying, what's archived

## Architecture

```
Browser (memory.svelte-apps.me)
   │  static SPA served from Netlify CDN (instant, always warm)
   ▼
fetch → https://mcp-memory.fly.dev/api/*   (origin CORS-allowlisted)
   │  Authorization: Bearer <token> (Phase 1) or PKCE token (Phase 2)
   ▼
Bun REST handlers (same process + auth as /mcp)
   │
   ▼
Neon Postgres (same tables as MCP tools)
```

- **Svelte 5 + SvelteKit** with `@sveltejs/adapter-static` (project preference), Tailwind CSS v4
- **Hosted on Netlify** free plan — global CDN, instant loads, zero cold starts; subdomain `memory.svelte-apps.me` off the existing `svelte-apps.me` domain
- No SSR: `adapter-static` with `prerender = true` + `fallback: 'index.html'` (SPA mode — data always comes from `/api/*`)
- The dashboard never touches the Fly VM except for real API calls — the machine stays scaled-to-zero until an agent connects

## Auth on the dashboard

- **Phase 1**: Bearer token. The dashboard shows a "Sign in" screen that stores the token in `sessionStorage` (on the Netlify origin) and sends it as `Authorization: Bearer ...` on every `/api/*` call. No cookies involved, so the cross-origin request stays simple — only a CORS allowlist is needed on the API.
- **Phase 2** (with OAuth): **cookies can't cross origins**, so the dashboard uses the **Authorization Code + PKCE** flow as a public client: redirect to the auth server on Fly (`/oauth/authorize`), callback back to `memory.svelte-apps.me/oauth/callback`, exchange the code with the PKCE verifier for an access token, keep it in memory/localStorage, and send it as a Bearer header. The auth server registers the dashboard as a pre-registered public client (PKCE-only, no secret) with the Netlify URL in its allowed redirect URIs. The consent screen stays on Fly.

**CORS requirements on the Fly API:**

- `Access-Control-Allow-Origin: https://memory.svelte-apps.me` (+ `http://localhost:5173` for dev)
- Allow headers `Authorization`, `Content-Type`; answer `OPTIONS` preflights with `204`
- No `Access-Control-Allow-Credentials` needed — we never send cookies (the MCP endpoint `/mcp` needs no CORS at all: MCP clients aren't browsers)

## REST API (`/api/*`)

All endpoints require auth. JSON in/out. Shapes mirror the MCP tool schemas so one set of lib functions (`src/lib/*`) serves both surfaces.

| Method | Path | Purpose |
| ------ | ---- | ------- |
| GET | `/api/namespaces` | List namespaces + memory/entity counts |
| POST | `/api/namespaces` | Create namespace |
| GET | `/api/entities?namespace=&type=&q=&limit=` | List/filter entities |
| GET | `/api/entities/:id` | Entity detail (incl. linked memories + relations) |
| POST | `/api/entities` | Create entity |
| PATCH | `/api/entities/:id` | Update entity (name, type, summary, importance, metadata) |
| DELETE | `/api/entities/:id` | Delete entity (cascades relations; memories unlink) |
| GET | `/api/memories?namespace=&type=&q=&importance_min=&archived=` | List/filter memories |
| GET | `/api/memories/:id` | Memory detail |
| POST | `/api/memories` | Create memory (accepts `entity_ids`) |
| PATCH | `/api/memories/:id` | Update memory |
| DELETE | `/api/memories/:id` | Delete memory |
| GET | `/api/search?q=&namespace=&limit=` | Unified search (same engine as the MCP `search` tool) |
| GET | `/api/graph?root=&depth=` | Graph payload: nodes + edges for cytoscape |
| GET | `/api/relations?entity_id=` | Relations for an entity |
| POST | `/api/relations` | Create relation |
| DELETE | `/api/relations/:id` | Delete relation |
| POST | `/api/consolidate` | Run decay/dedup sweep (same as MCP `consolidate`) |
| GET | `/api/stats` | Counts by type, top entities by access_count, decay candidates, archived count |
| GET | `/api/healthz` | Health check (for Fly's optional TCP check) |

**Error shape:** `{ "error": { "code": "...", "message": "..." } }` with proper status codes (401 with `WWW-Authenticate`, 404, 422 for validation).

## Pages

### `/` — Home (search + pulse)
- Search bar (debounced, hits `/api/search`) with namespace dropdown
- "Recent memories" feed (created/updated last 24h, grouped by namespace)
- Stat cards: entities, memories, relations, namespaces, decay candidates
- Quick actions: New memory, New entity, Run consolidate

### `/entities/:id` — Entity detail
- Name, type, summary, importance (editable), metadata JSON editor
- Linked memories (read/update/delete)
- Incoming/outgoing relations (create/delete)
- "Open in graph" button → `/graph?focus=<id>`

### `/memories` — Memory browser
- Filters: namespace, type, importance range, archived toggle, text query
- Bulk actions: archive, delete, re-score importance
- Create memory with entity linking (entity picker with search)

### `/graph` — Knowledge graph
- cytoscape.js canvas, dagre layout
- Node color by type, edge label = relation_type, size by importance
- Click node → entity detail drawer; "focus" query param centers an entity
- Namespace selector; depth slider (BFS from root)

### `/connect` — Connect an AI
- Table of targets (Grok, ChatGPT, Claude, Gemini Spark, Perplexity, Le Chat + local editors) with the server URL pre-filled and per-platform steps (from [README Part 5](../mcp-memory-server/README.md#part-5-connect-clients))
- Phase 1: shows the Bearer token config snippets; Phase 2: shows OAuth URLs + a "Test connection" button that runs `tools/list` and displays the 7 tools

### `/settings`
- Namespace management (create/rename/delete with warnings)
- Token display/rotate (Phase 1); OAuth clients list (Phase 2)
- Data export: download all namespaces as JSON or Markdown

## Graph payload shape

```json
{
  "nodes": [
    { "id": "uuid", "label": "Bun", "type": "tool", "importance": 0.7 }
  ],
  "edges": [
    {
      "id": "uuid",
      "source": "entity-a-uuid",
      "target": "entity-b-uuid",
      "label": "uses",
      "weight": 0.8
    }
  ]
}
```

## Deployment (Netlify)

The dashboard lives in the **same repo as the server** (Bun workspace monorepo — one lockfile; see README → Project Structure). Netlify installs the whole workspace at the repo root, then builds only `dashboard/`:

```toml
# netlify.toml (repo ROOT — the workspace install must happen at the root)
[build]
  command = "cd dashboard && bun run build"
  publish = "dashboard/build"

[build.environment]
  PUBLIC_API_URL = "https://mcp-memory.fly.dev"    # REST API base
  PUBLIC_MCP_URL = "https://mcp-memory.fly.dev/mcp"  # shown on /connect
```

1. Push the repo to GitHub; create the site in Netlify (New site from Git, base = repo root, build command + publish dir as above — or use `netlify deploy --prod` from the repo root for CLI deploys)
2. Attach the domain: Netlify → Domain management → add `memory.svelte-apps.me` as a subdomain of the existing `svelte-apps.me` (Let's Encrypt SSL is automatic)
3. Add the origin to the Fly API's CORS allowlist (`src/index.ts` `ALLOWED_ORIGINS`)
4. `dashboard/package.json` is named `memory-dashboard` and depends on `@memory/shared` via `workspace:*` — no separate lockfile, no version drift

**Credit math (Netlify free plan, 2026):** 300 credits/mo hard cap — bandwidth 20 credits/GB, production deploys 15 each, web requests 2 credits/10k. A lean SPA (~150-250KB total, no images) with a few hundred requests/mo lands around **20-60 credits/mo**. Keep the bundle lean; if it ever binds, swap to Cloudflare Pages (500 builds/mo, unlimited bandwidth) — the dashboard code doesn't change, only `PUBLIC_API_URL` and the CORS entry.
## SvelteKit notes (Svelte 5 runes)

- `src/lib/api.ts`: `fetch` wrapper that injects the token from `sessionStorage` and throws typed errors from the error shape above
- State with `$state()` runes; no stores needed for v1
- `PUBLIC_API_URL` (REST base) and `PUBLIC_MCP_URL` (shown on the connect page) are baked in at build time via `import.meta.env.PUBLIC_*`
- `adapter-static` config:

```js
// dashboard/svelte.config.js
import adapter from "@sveltejs/adapter-static";
export default {
  kit: {
    adapter: adapter({ fallback: "index.html" }),
    prerender: { entries: ["/"] },
  },
};
```

## Acceptance criteria

- [ ] `/` search returns the same results as the MCP `search` tool (same engine)
- [ ] Entity CRUD from the browser is reflected immediately in a Claude Code session that calls the MCP server (no cache drift)
- [ ] Graph view renders for a seeded demo namespace; clicking a node opens its detail drawer
- [ ] `DELETE /api/entities/:id` cascades correctly (relations gone, memories unlinked, not deleted)
- [ ] Dashboard loads instantly on Netlify even while the Fly machine is scaled to zero; API calls wake it (1-2s) and succeed
- [ ] CORS: `OPTIONS` preflight passes from `memory.svelte-apps.me`; requests from other origins are rejected
- [ ] Phase 2: PKCE login completes from the Netlify origin against the Fly auth server

## Follow-ups

- Live updates (SSE from Bun → "memory just written by Claude" toast)
- Export to Markdown for the `basic-memory`-style human-readable copy
- Mobile pass (the dashboard is already responsive-ish via Tailwind)

[Back to Plan](./README.md) · [Skill spec](./skill.md)
