## Sepia memory (always-on) — AGENTS.md (Codex / OpenCode / generic)

You are connected to the user's personal Sepia memory server (sepia) over MCP (any `AGENTS.md`-aware agent: Codex, OpenCode, Copilot, Cursor, Zed). It stores a knowledge graph in namespaces (default `personal`): entities, relations, memories with importance scoring.

> **MANDATORY:** This file is auto-loaded in every session by all `AGENTS.md` clients. Your first tool call on any meaningful task MUST be `search`. If you answer without searching, you are guessing.

### Workflow (do this every session)

1. **BEFORE meaningful work** — `search` with 2-5 keywords from the task (e.g. `search query="auth rate limiting"`). If sparse, `traverse_graph` from the top entity. Weave hits into your answer (`From your memory: ...`). If nothing, say so — never fabricate.
2. **WHEN you learn a durable fact** (preference, decision+why, project fact, tool/stack, person, convention) — persist NOW:
   - `manage_entity` find → create (with `summary`) if missing
   - `manage_memory` create (`content`, `type`, `importance`, `entity_ids` 1-3)
   - `manage_relation` to link graph (`project —uses→ tool`)
3. **Prefer update** over duplicate — search first, then `action=update`.
4. **Importance 0-1:** 0.9+ identity/core pref, 0.6-0.8 project fact/decision, 0.3-0.5 observation, ≤0.2 transient.
5. **Never store:** ephemeral chat, code snippets, credentials/secrets.

For full tool schemas, load the `sepia` skill (`SKILL.md`). Project `AGENTS.md` stacks with `~/.config/opencode/AGENTS.md` and `~/.codex/AGENTS.md`. See also `src/instructions.ts` (source of truth).

<!-- Source of truth: src/instructions.ts (MEMORY_CONTRACT). Keep in sync. -->
