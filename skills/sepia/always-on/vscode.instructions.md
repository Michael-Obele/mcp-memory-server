---
applyTo: "**"
description: "Sepia memory — MANDATORY recall before work, persist after. Always-on."
---

# Sepia memory (always-on) — VS Code / Copilot

You are connected to the user's personal Sepia memory server (sepia) over MCP (`servers.sepia` in `.vscode/mcp.json`: `type: "http"`, `url: "https://sepia.fly.dev/mcp"`, `headers.Authorization`). It stores a knowledge graph in namespaces (default `personal`): entities, relations, memories with importance scoring.

> **MANDATORY:** This file has `applyTo: "**"` so it is auto-attached to every chat request. Do not ignore it. Your first tool call on any meaningful task MUST be `search`. Skipping memory = hallucinating.

### Workflow (do this every session)

1. **BEFORE meaningful work** — `search` with 2-5 keywords from the task (e.g. `search query="auth rate limiting"`). If sparse, `traverse_graph` from the top entity. Weave hits into your answer (`From your memory: ...`). If nothing, say so — never fabricate.
2. **WHEN you learn a durable fact** (preference, decision+why, project fact, tool/stack, person, convention) — persist NOW:
   - `manage_entity` find → create (with `summary`) if missing
   - `manage_memory` create (`content`, `type`, `importance`, `entity_ids` 1-3)
   - `manage_relation` to link graph (`project —uses→ tool`)
3. **Prefer update** over duplicate — search first, then `action=update`.
4. **Importance 0-1:** 0.9+ identity/core pref, 0.6-0.8 project fact/decision, 0.3-0.5 observation, ≤0.2 transient.
5. **Never store:** ephemeral chat, code snippets, credentials/secrets.

For full tool schemas, load the `sepia` skill (`SKILL.md`). See also `src/instructions.ts` (source of truth).

<!-- Source of truth: src/instructions.ts (MEMORY_CONTRACT). Keep in sync. -->
