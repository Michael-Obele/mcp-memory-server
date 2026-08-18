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
