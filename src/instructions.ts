/**
 * The memory usage contract, sent to the model via the MCP `instructions`
 * field in the `initialize` handshake. Supporting clients (Claude Code,
 * Codex, VS Code Copilot Chat, Goose, Claude Desktop) inject it into the
 * model's system prompt — the model reads it before any tool schemas or
 * user messages. The bundled Agent Skill (skills/sepia/SKILL.md) carries
 * the same contract for editors that ignore `instructions`.
 */
export const MEMORY_CONTRACT = `You are connected to the user's personal memory server. It stores a
knowledge graph (entities, relations, memories) in namespaces (default
"personal") about the user's projects, preferences, decisions, people,
conventions, and technical stack.

Usage contract:
1. BEFORE starting meaningful work, call "search" with the user's current
   task and topic keywords to recall relevant memories.
2. WHEN you learn a durable fact (preference, decision, project fact,
   convention, person), call "manage_memory" with action=create, and link
   it to entities via the entity_ids field — creating entities with
   "manage_entity" (action=create) as needed.
3. PREFER update over duplicate: search first, then "manage_memory"
   action=update or "manage_entity" action=update.
4. USE "manage_relation" to connect related entities (e.g. "project X
   uses tool Y", "user prefers Z").
5. SCORE importance 0-1: 0.9+ core identity/preferences, 0.6-0.8 project
   facts, 0.3-0.5 normal observations, <=0.2 transient details.
6. DO NOT store: ephemeral chat content, code snippets, credentials,
   secrets, or anything the user would not want persisted.
7. If a search returns nothing, say so plainly — do not fabricate memories.`;
