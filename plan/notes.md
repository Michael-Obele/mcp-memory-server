---
title: Research Notes & Alternatives
status: in-progress
---

# Research Notes & Alternatives

Research refreshed **2026-08-15** (original: May 2026). All claims sourced; citations at the bottom.

## Competition Analysis (August 2026)

### Official MCP memory server (`@modelcontextprotocol/server-memory`)

- **Pros**: Minimal, canonical, maintained alongside the protocol, Apache-2.0 transition in progress
- **Cons**: Single local JSONL file, substring/keyword matching only (no embeddings), local-only, "a basic implementation" per its own README
- **Verdict**: The reference point, not a remote server

### mem0 (62.8K stars umbrella) — hosted-first now

- The standalone `mem0-mcp` repo was archived **March 2026**; OpenMemory was **removed from the monorepo July 29, 2026**
- Current MCP entry point is **hosted**: `https://mcp.mem0.ai/mcp` with OAuth sign-in
- Hobby $0: 10K adds / 1K retrievals per month; Starter $19/mo
- **Takeaway**: the open local path is gone — validates our self-host approach

### basic-memory (basicmachines-co, ~3.6K stars)

- Plain Markdown files as source of truth + semantic graph in local SQLite (Postgres optional); Obsidian-compatible
- Local-first; paid cloud tier $15/seat/mo; AGPL-3.0
- **Takeaway**: excellent for human-readable local memory; not a remote multi-client server

### claude-mem (~90K stars)

- Claude Code lifecycle hooks auto-capture → compressed observations in SQLite; local web viewer at localhost:37777; optional cloud mirror
- **Takeaway**: best-in-class auto-capture UX, but Claude-Code-centric and local; our `consolidate` + dashboard echo its decay/viewer ideas

### Creed (creed.md)

- Personal context profile server; **OAuth-first MCP** (paste URL, browser consent, token refresh)
- **Notable pattern**: server sends an `instructions` field carrying the read-before-work contract — the same mechanism this plan uses
- **Takeaway**: validates the OAuth + instructions UX; Creed is a profile file, we're a knowledge graph + dashboard + skill

### Context Cloud, Supermemory, Mnemoverse, Zep/Graphiti

- Context Cloud: team workspaces, typed chunks, **web UI with knowledge-graph view** — the dashboard bar this plan's dashboard should clear
- Supermemory: hosted on Cloudflare Workers/DO, profiles + forgetting
- Zep/Graphiti: temporal knowledge graphs, $25-475/mo, enterprise-shaped
- **Takeaway**: the hosted/team tier is crowded; nobody serves the **self-hosted single-user remote KG + dashboard + skill** niche

### Verdict

Our differentiators, in order: (1) self-hosted remote Streamable HTTP server on infra you control, (2) **MCP server instructions** for zero-reminder usage, (3) **bundled Agent Skill** for every editor, (4) **web dashboard** with graph view, (5) **online AI connectors** (Grok, ChatGPT, Claude, Gemini, Perplexity), (6) 7-tool KG design with decay.

## MCP Server Instructions (the "system prompt" mechanism)

- The `instructions` field is part of `InitializeResult` (spec: 2025-03-26 onward). Clients MAY inject it into the model's system prompt — the MCP maintainers' blog post (Nov 2025) explicitly recommends it for "global instructions the LLM should always read"
- **Known-supporting clients (as of late 2025/2026)**: Claude Code, Codex (reads it as "server-wide guidance alongside the server's tools" per OpenAI docs), VS Code Copilot Chat, Goose; Cursor varies; Claude Desktop supports it
- **Caveat**: behavior is implementation-defined; test each client (the plan's acceptance criteria include a fresh-chat recall test)
- TMCP: `instructions` is a first-class config option on `McpServer` (verified in tmcp docs)
- Sources: [MCP lifecycle spec](https://modelcontextprotocol.io/specification/2025-03-26/basic/lifecycle), [Server Instructions blog](https://blog.modelcontextprotocol.io/posts/2025-11-03-using-server-instructions/), [Codex MCP docs](https://learn.chatgpt.com/docs/extend/mcp)

## Agent Skills (the skill mechanism)

- **Open standard** ([agentskills.io](https://agentskills.io) / openagentskills.dev spec): a directory with `SKILL.md` (YAML frontmatter: `name`, `description` required; body = instructions; optional `references/`, `scripts/`, `assets/`)
- **Progressive disclosure**: only name+description (~100 tokens) preload into the system prompt; body loads on activation; keep `SKILL.md` < 500 lines
- **Supported in**: Zed (`~/.agents/skills/`), Cursor (`.cursor/skills/` + compatibility dirs), Claude Code (`.claude/skills/`, `/name` invocation, dynamic context injection), Codex (`.codex/skills/`), Anthropic's Skills API / claude.ai uploads
- **Distribution**: skills.sh registry, GitHub repos, zed://skill share links
- Sources: [Anthropic engineering post](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills), [Zed skills docs](https://zed.dev/docs/ai/skills), [Cursor skills docs](https://cursor.com/docs/skills), [Claude Code skills docs](https://code.claude.com/docs/en/skills)

## Online AI MCP support (verified mid-2026)

| AI | Custom MCP | Where | Gate | Auth |
| -- | ---------- | ----- | ---- | ---- |
| Claude | ✅ "Custom connector" | Settings → Connectors | Every plan (Free = 1) | OAuth or none |
| Grok (xAI) | ✅ "Bring your own MCP" | grok.com/connectors → New Connector → Custom | Paid plans; web/iOS/Android | OAuth |
| ChatGPT | ✅ "Custom app" (renamed Dec 2025) | Settings → Apps → Developer mode → Create | Plus+, web only | **OAuth required** |
| Gemini | ✅ via Spark custom apps | Settings → Connected Apps | Google AI Pro/Ultra (Spark); Antigravity free preview | OAuth (dynamic client registration) |
| Perplexity | ✅ Custom connector → Remote | Settings → Connectors | Pro/Max/Enterprise | OAuth |
| Le Chat | ✅ Custom MCP connector | Connectors → + Add | Free | OAuth 2.1 + DCR auto-detect |

- **Key constraints**: web platforms connect from the **provider's cloud** (public URL required, no stdio); ChatGPT is remote-only (no stdio at all); most require **OAuth 2.1** — bearer-token-only servers work with Claude + local editors but not ChatGPT/Gemini/Grok-style connectors
- Sources: [Tempreon guide (2026-07-18)](https://tempreon.com/blog/connect-custom-mcp-server-to-any-llm), [ChatForest cross-platform guide](https://chatforest.com/guides/mcp-across-ai-platforms/), [Claude Help Center](https://support.claude.com/en/articles/11175166-how-to-connect-remote-mcp-integrations-to-claude), [ChatGPT learn docs](https://learn.chatgpt.com/docs/extend/mcp), [tadata-org/mcp-client-compatibility](https://github.com/tadata-org/mcp-client-compatibility)

## MCP Authorization (OAuth 2.1)

- Protected servers must implement **OAuth 2.0 Protected Resource Metadata** (`/.well-known/oauth-protected-resource`, RFC 9728) advertising `authorization_servers`
- Clients use **dynamic client registration** (RFC 7591) → paste-URL-and-sign-in UX
- **Resource indicators** (RFC 8707): tokens bound to the specific MCP server (audience)
- **PKCE required** (OAuth 2.1); tokens via `Authorization: Bearer`, never query strings
- `@tmcp/auth` ships the authorization-server side; Superfly's `ssokenizer`/`tokenizer` can delegate auth to an IdP
- Sources: [MCP authorization spec](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization), [GitHub blog: secure remote MCP servers](https://github.blog/ai-and-ml/generative-ai/how-to-build-secure-and-scalable-remote-mcp-servers/), [example-remote-server oauth-implementation](https://github.com/modelcontextprotocol/example-remote-server/blob/main/docs/oauth-implementation.md)

## Dashboard Hosting: Netlify (verified 2026-08-15)

- Netlify moved to **credit-based pricing**: Free = $0 forever, **300 credits/month hard limit** (no auto recharge — projects pause at the cap, but the cap also means you can never be billed). Costs: bandwidth **20 credits/GB**, web requests 2 credits/10k, production deploys **15 credits each**, compute 10 credits/GB-hr
- A lean SPA (~150-250KB, no images) with a few hundred requests/mo ≈ **20-60 credits/mo** → comfortable margin, and the hard cap guarantees no surprise bill
- The limits are **pooled across all sites on the account** — worth monitoring if `svelte-apps.me` hosts several projects (Netlify shows usage in the dashboard)
- `svelte-apps.me` is already attached to the user's Netlify account → `memory.svelte-apps.me` subdomain is free, Let's Encrypt SSL automatic
- **Fallback:** Cloudflare Pages free tier is more generous (500 builds/mo, unlimited bandwidth) — because the dashboard is a static build with an env-var API URL, swapping is a config change, not a rewrite
- Sources: [netlify.com/pricing](https://www.netlify.com/pricing/), [credit-based plans docs](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/), [free-tier breakdown (2026-07)](https://gautamkhorana.com/blog/netlify-free-tier-limits-2026/)

## Bun Workspaces + Docker (verified 2026-08-15)

- `bun install --filter <pkg>` installs only a subset of workspaces — the documented way to keep SvelteKit out of the server image
- **Gotcha:** with `--frozen-lockfile`, Bun validates the full workspace graph, so ALL workspace `package.json` files must be present in the build context (copy them before `bun install` for layer caching) — otherwise: `error: lockfile had changes, but lockfile is frozen`. Real-world failure documented in [vpontis/bun-workspace-docker-example](https://github.com/vpontis/bun-workspace-docker-example); also covered by the project's own proposal there (`bun install --filter api` needs the whole workspace copied)
- `--filter` also runs scripts across workspaces (`bun --filter '*' build`) respecting dependency order — useful later if `@memory/shared` ever gains a build step
- Sources: [bun install docs](https://bun.com/docs/pm/cli/install), [bun --filter docs](https://bun.com/docs/pm/filter), [bun workspaces docs](https://bun.com/docs/pm/workspaces)

## Fly.io Hosting (verified)

- Official guides: [Deploying Remote MCP Servers](https://fly.io/docs/blueprints/remote-mcp-servers/) (single-tenant vs multi-tenant; `fly mcp proxy` for legacy clients), [Streaming HTTP transport](https://fly.io/docs/mcp/transports/streaming-http/) (deploy as-is, `--smoke-checks=false`, endpoint at `https://app.fly.dev/mcp`)
- **Scale-to-zero config**: `auto_stop_machines = "stop"`, `auto_start_machines = true`, `min_machines_running = 0` → free tier friendly (~$0); always-on via `min_machines_running = 1` (~$1-3/mo)
- Free tier: 3 shared-cpu-1x 256MB VMs, 160GB outbound/month
- **Gotcha**: HTTP smoke checks confuse Streamable HTTP servers — disable them or use a dedicated `/healthz` path with a TCP-friendly check
- Secrets via `fly secrets set` (env-in-image is a no-no)
- Source: [Fly docs](https://fly.io/docs/mcp/deploy-on/)

## TMCP Framework (verified against docs, Aug 2026)

- **Language**: TypeScript; **schema adapters**: Valibot (rec.), Zod v3/v4, ArkType, Effect (Standard Schema)
- **Transports**: STDIO, HTTP (Streamable HTTP), SSE (deprecated)
- **Auth**: `@tmcp/auth` (OAuth 2.1 helper)
- **Session managers**: Redis, Postgres, Cloudflare KV/DO (`@tmcp/session-manager-*`)
- **Key verified APIs**:
  - `new McpServer({ name, version }, { adapter, capabilities, instructions })` — instructions built in
  - `new HttpTransport(server, { path: "/mcp" })` + `transport.respond(request)` inside your own `Bun.serve` — single-process mounting
  - `server.tool({ name, description, schema }, handler)` with `server.ctx` (sessionInfo, auth, custom context)
  - Scaffolding: `bunx create-tmcp` wizard
- Sources: [tmcp.io docs](https://tmcp.io/docs), [get-documentation search results]

## Neon Postgres Free Tier Details (unchanged)

| Limit               | Value                                                          |
| ------------------- | -------------------------------------------------------------- |
| Projects            | 100                                                            |
| Storage per project | 0.5 GB                                                         |
| Compute             | 100 CU-hours/project/month                                     |
| Autoscaling         | Up to 2 CU (8GB RAM)                                           |
| Scale to zero       | After 5 min idle                                               |
| Network transfer    | 5 GB/month                                                     |
| **Enough for?**     | A personal MCP server with ~10K memories is well within limits |

## Key Citations

- FlarelyLegal/memory-mcp: https://github.com/FlarelyLegal/memory-mcp
- TMCP: https://tmcp.io/docs/getting-started
- MCP server instructions: https://blog.modelcontextprotocol.io/posts/2025-11-03-using-server-instructions/
- MCP lifecycle spec: https://modelcontextprotocol.io/specification/2025-03-26/basic/lifecycle
- MCP authorization spec: https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization
- Agent Skills spec: https://agentskills.io (openagentskills.dev/docs/specification)
- Zed skills: https://zed.dev/docs/ai/skills · Cursor skills: https://cursor.com/docs/skills · Claude Code skills: https://code.claude.com/docs/en/skills
- Anthropic Agent Skills: https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills
- Fly remote MCP: https://fly.io/docs/blueprints/remote-mcp-servers/ · Streaming HTTP: https://fly.io/docs/mcp/transports/streaming-http/ · Deploy on: https://fly.io/docs/mcp/deploy-on/
- Online AI connectors: https://tempreon.com/blog/connect-custom-mcp-server-to-any-llm · https://chatforest.com/guides/mcp-across-ai-platforms/
- Client compatibility matrix: https://github.com/tadata-org/mcp-client-compatibility
- Memory server landscape: https://mnemoverse.com/docs/library/memory-mcp-servers-compared · https://contextcloud.pro/blog/best-mcp-memory-servers-for-teams/ · https://mcp.directory/blog/claude-code-memory-mcp-servers-2026
- Neon Free Tier: https://neon.tech/docs/introduction/free-tier

## Open Questions

1. **Grok + bearer token**: does Grok's custom connector accept static header auth, or is OAuth mandatory? (Docs say OAuth; verify at build time.)
2. **Cursor `instructions` support**: current behavior unverified; the skill covers this either way.
3. **Zed global skill install path**: `~/.agents/skills/` confirmed; verify `.agents/skills/` project-level too.
4. **`@tmcp/auth` deployment on Fly**: confirm the JWKS + registration endpoints work behind Fly's edge TLS without extra config.
5. **Neon pgvector**: paid tier only — decide whether semantic search is worth it in a later milestone.
6. **CORS vs MCP on the same port**: verify that OPTIONS preflight handling never intercepts `/mcp` POSTs (guard by path — already designed that way in `src/index.ts`).

[Back to Plan](./README.md)
