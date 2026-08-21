---
title: The Bundled Agent Skill + Always-On Instructions
status: in-progress
---

# The Bundled Agent Skill + Always-On Instructions

The memory server ships with an **Agent Skill** (`SKILL.md`, [Open Agent Skills standard](https://agentskills.io)) **plus per-editor always-on instruction files** (`always-on/`) so that **any AI editor** (Zed, Cursor, Claude Code, Codex, OpenCode, VS Code Copilot) uses the memory server correctly without the user pasting instructions.

## Why three mechanisms?

Skills are **on-demand by design** in every platform: the editor lists the skill's name + description at session start, but the full body loads only when the model decides it's relevant (or the user invokes `/sepia`). That's fine for reference material, but it can't _force_ memory usage. The always-on channels can:

| Mechanism                                  | How it reaches the model                                                                                                                                                                   | Coverage                                                                       | Notes                                                                                                                                             |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| MCP `instructions` field                   | Sent in `initialize` handshake → client injects into system prompt                                                                                                                         | Claude Code, Codex, VS Code Copilot Chat, Goose, Claude Desktop                | Zero setup, but client-dependent — **Cursor varies** ([source](https://blog.modelcontextprotocol.io/posts/2025-11-03-using-server-instructions/)) |
| Always-on instruction files (`always-on/`) | Editor's own instruction system injects into **every** session: VS Code `*.instructions.md` (`applyTo: '**/*'`), Cursor `.mdc` (`alwaysApply: true`), Claude Code `CLAUDE.md`, `AGENTS.md` | VS Code, Cursor, Claude Code, Codex, any agentsmd-compliant agent              | The only mechanism that is truly unconditional; needs a one-time install (`install-skill.sh`)                                                     |
| Agent Skill (`SKILL.md`)                   | Editor lists skill name+description at startup; loads full body when relevant                                                                                                              | Zed, Cursor, Claude Code, Codex, OpenCode, any agentskills.io-compliant editor | On-demand — carries the _extended_ guide (tool-by-tool detail)                                                                                    |

Same contract, three delivery channels. The always-on files carry the **condensed** contract (the same 7 rules as `src/instructions.ts` — always-on content must stay short, ~2,000 tokens max per Cursor's rule-of-thumb); the skill carries the full guide. If the client supports `instructions`, the model knows the contract before the first message. If it doesn't (Cursor), the always-on file covers it. The skill's `description` makes the agent load the extended guide when memory is relevant.

## Repo layout

```
skills/sepia/
├── SKILL.md              # ← the skill (frontmatter + body, < 500 lines)
├── always-on/            # ← always-on instruction files (condensed contract)
│   ├── vscode.instructions.md   # VS Code Copilot: applyTo '**/*' → every chat request
│   ├── cursor.mdc               # Cursor: alwaysApply: true → every session
│   ├── claude.md                # Claude Code: appended to ~/.claude/CLAUDE.md
│   └── agents.md                # AGENTS.md section (Codex, Cursor, Copilot, …)
└── references/
    └── tools.md          # per-tool reference: schemas, examples, edge cases
```

Source of truth for the contract: `src/instructions.ts` (`MEMORY_CONTRACT`). The always-on files mirror it — keep them in sync (each file carries a comment pointing at the source).

## SKILL.md (draft — copy verbatim into `skills/sepia/SKILL.md`)

```markdown
---
name: sepia
description: >-
  Use when the user's AI assistant should recall or persist long-term knowledge
  about the user, their projects, preferences, decisions, people, conventions,
  or technical stack — across sessions and across tools. Triggers: starting
  meaningful work ("remember that", "what do we know about", "recall", "save
  this for later", "do you remember"), learning durable facts, or when context
  from past sessions would change the answer. Do NOT use for ephemeral chat
  content or code snippets.
---

# Sepia (remote knowledge-graph memory server)

You are connected to the user's personal memory server over MCP
(https://sepia.fly.dev/mcp). It stores a knowledge graph in namespaces
(default `personal`): **entities** (nodes: people, projects, concepts, tools),
**relations** (directed edges), **memories** (facts/observations with
importance scores).

## When to recall (READ)

1. **Before meaningful work**, call `search` with the user's current task and
   topic keywords (e.g. `search` query="rate limiting" namespace="personal").
2. If results are sparse, also `traverse_graph` from the most relevant entity
   to pull its neighborhood.
3. Weave recalled facts into your answer naturally. Cite what came from memory
   when it matters ("From your memory: ...").
4. If a search returns nothing, say so — never fabricate memories.

## When to write (WRITE)

Persist something when it is **durable and reusable**:

- Preferences ("prefers tabs over spaces", "wants PRs under 400 lines")
- Decisions and their rationale ("chose Neon over Supabase because...")
- Project facts ("mcp-showcase deploys via Vercel")
- People and roles, tools and stacks, conventions and constraints

Do **not** store: ephemeral chat content, code snippets, credentials,
secrets, or anything transient.

## How to write

1. **Search first, update second** — avoid duplicates. If a matching
   entity/memory exists, `manage_entity` action=update or `manage_memory`
   action=update it.
2. **Entities before memories**: ensure the entity exists (`manage_entity`
   action=find, else action=create with a short `summary`).
3. **Link memories to entities** via `manage_memory` action=create's
   `entity_ids` field (1-3 entities max; prefer the most specific).
4. **Connect the graph** with `manage_relation` (e.g. `project` →`uses`→
   `tool`, `user` →`prefers`→ `thing`). One relation per directed pair.
5. **Importance scoring** (0-1):
   - 0.9+: identity, core preferences, non-negotiables
   - 0.6-0.8: active project facts, decisions, conventions
   - 0.3-0.5: normal observations, people
   - <= 0.2: transient details (will decay first)
6. **Namespaces**: default `personal`. Only create a new namespace if the user
   asks for separation (e.g. `work` vs `personal`).

## Examples

- User says "we went with Bun for the server because cold start matters"
  → `manage_entity` find/create `Bun` (type=tool, summary="JS runtime");
  `manage_memory` create content="chose Bun over Node for cold start" type=decision
  importance=0.7 entity_ids=[bun-entity-id]
- User asks "what do we know about the memory server plan?"
  → `search` query="memory server" → read top memories/entities → answer
  with recalled facts, then `traverse_graph` if the user wants the full picture.

## Edge cases

- **Duplicate write**: always search before create; if unsure, update the
  existing item and mention the merge in your reply.
- **Conflicting facts**: create the new memory with importance equal to the old
  one, note the conflict in your reply, and let `consolidate` handle decay.
- **Sensitive data**: refuse to store credentials/secrets; tell the user the
  memory server is not a vault.
- **Wrong namespace**: if the user is clearly working in `work` context but no
  such namespace exists, ask before creating it.

## Reference

For full tool schemas and action enums, see [references/tools.md](./references/tools.md).
```

### `references/tools.md` (draft)

Records the exact Valibot schema per tool — one entry per tool with input
shape, output shape, and 2-3 example calls. Source of truth is
`packages/shared/src/schemas.ts` (`@sepia/shared`) at build time; the
`scripts/gen-skill-ref.ts` codegen regenerates this file from those schemas
(initial hand-write is fine, wire up the generator before M2 ships). Example
entry:

```markdown
## manage_memory

Actions: create | get | update | delete | query

- `create`: content (string, required), type (fact|observation|preference|instruction,
  default fact), importance (0-1, default 0.5), namespace (default personal),
  entity_ids (string[], optional), source (string, optional, auto-set to client name)
- `query`: filters by type / namespace / importance_min, ordered by
  importance desc then updated_at desc, limit default 20
```

## Install matrix

| Editor          | Skill path                                                          | Always-on path                                                          |
| --------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Zed             | `~/.agents/skills/sepia/`                                           | — (no always-on instruction system; AGENTS.md covers it)                |
| Cursor          | `.cursor/skills/sepia/` (repo) or `~/.cursor/skills/` (global)      | `~/.cursor/rules/sepia.mdc` (`alwaysApply: true`)                       |
| Claude Code     | `.claude/skills/sepia/` (project) or `~/.claude/skills/` (personal) | `~/.claude/CLAUDE.md` (appended section)                                |
| Codex           | `.codex/skills/sepia/` or `~/.codex/skills/`                        | `AGENTS.md` (repo)                                                      |
| OpenCode        | `.opencode/skills/sepia/` (verify path in current docs)             | `AGENTS.md` (repo)                                                      |
| VS Code Copilot | `~/.agents/skills/sepia/` (via `chat.useClaudeSkills`)              | `~/.config/Code/User/prompts/sepia.instructions.md` (`applyTo: '**/*'`) |

### One-shot installer (`scripts/install-skill.sh`)

Installs both channels: the skill into every editor skill dir, and the
always-on files into the editor instruction systems (VS Code prompts folder,
Cursor user rules, `~/.claude/CLAUDE.md` via marker-based idempotent append,
and the current repo's `AGENTS.md` if present).

## Publishing (follow-up)

- [skills.sh](https://skills.sh) — the open skill registry (Zed's `find-skills` installs from it). Skills are discovered from GitHub repos (`npx skills add Michael-Obele/sepia` finds `skills/sepia/`) or from a direct `SKILL.md` URL (`npx skills add https://sepia.fly.dev/skill`).
- Anthropic's `anthropics/skills` repo accepts community contributions
- The skill + server together make a strong "MCP server with a skill" package — the pattern Creed and others use (server sends the contract; skill makes it explicit)

## HTTP endpoints (served by the server, no repo clone needed)

The server serves the skill, always-on files, and installer over HTTP (public, no auth — static docs):

| Endpoint                         | Serves                                     | Used by                                            |
| -------------------------------- | ------------------------------------------ | -------------------------------------------------- |
| `GET /skill`                     | `skills/sepia/SKILL.md` (text/markdown)    | `npx skills add https://sepia.fly.dev/skill`       |
| `GET /skill/references/tools.md` | `skills/sepia/references/tools.md`         | remote installer                                   |
| `GET /instructions/vscode`       | `always-on/vscode.instructions.md`         | remote installer → VS Code prompts folder          |
| `GET /instructions/cursor`       | `always-on/cursor.mdc`                     | remote installer → Cursor user rules               |
| `GET /instructions/claude`       | `always-on/claude.md`                      | remote installer → `~/.claude/CLAUDE.md`           |
| `GET /instructions/agents`       | `always-on/agents.md`                      | remote installer → repo `AGENTS.md`                |
| `GET /install`                   | `scripts/remote-install.sh` (shell script) | `curl -fsSL https://sepia.fly.dev/install \| bash` |

The remote installer (`scripts/remote-install.sh`) fetches `SKILL.md` + `references/tools.md` + the always-on files from the server and installs into every editor dir it finds (`~/.agents/skills`, `.cursor/skills`, `.claude/skills`, `.codex/skills`, `.opencode/skills`, VS Code prompts, Cursor rules, `~/.claude/CLAUDE.md`, repo `AGENTS.md`). Idempotent — re-running overwrites in place / skips existing sections.

## Acceptance criteria

- [ ] Fresh Claude Code session: with only the skill + MCP configured, the agent recalls a stored fact without any reminder prompt
- [ ] Fresh Zed session: same result via the skill catalog
- [ ] Fresh Cursor session: the always-on rule is in context (check `@Rules` / rule list) and the agent recalls a stored fact unprompted
- [ ] Fresh VS Code Copilot session: `sepia.instructions.md` shows in "Used references" and the agent recalls a stored fact unprompted
- [ ] `install-skill.sh` is idempotent (re-running doesn't duplicate; CLAUDE.md append is marker-guarded)
- [ ] `references/tools.md` matches `packages/shared/src/schemas.ts` (via `bun run gen:skill-ref`, checked in CI)
- [ ] `curl -fsSL https://sepia.fly.dev/install | bash` installs the skill + always-on files into a fresh editor dir
- [ ] `npx skills add Michael-Obele/sepia --list` discovers the `sepia` skill

[Back to Plan](./README.md) · [Dashboard spec](./dashboard.md)
