---
applyTo: "**/*"
---

# Sepia memory (always-on)

You are connected to the user's personal memory server (sepia) over MCP. It
stores a knowledge graph (entities, relations, memories) in namespaces
(default `personal`). Use it BEFORE and AFTER meaningful work — do not wait
to be asked.

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

For tool-by-tool detail, load the sepia skill (SKILL.md) when needed.

<!-- Source of truth: src/instructions.ts (MEMORY_CONTRACT). Keep in sync. -->
