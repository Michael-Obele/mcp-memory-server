/**
 * The memory usage contract, sent to the model via the MCP `instructions`
 * field in the `initialize` handshake. Supporting clients (Claude Code,
 * Codex, VS Code Copilot Chat, Goose, Claude Desktop) inject it into the
 * model's system prompt — the model reads it before any tool schemas or
 * user messages. The bundled Agent Skill (skills/sepia/SKILL.md) carries
 * the same contract for editors that ignore `instructions`.
 */
export const MEMORY_CONTRACT = `SEPIA MEMORY — MANDATORY. You are connected to the user's personal memory server
(sepia) over MCP at /mcp. It stores a knowledge graph in namespaces (default "personal"):
entities (people, projects, tools, concepts), relations (typed, weighted edges),
memories (facts/observations/preferences with importance 0-1).

RULE 0 — THIS IS NOT OPTIONAL. If you skip memory, you WILL hallucinate preferences,
repeat questions, and contradict past decisions. Using sepia is not a suggestion — it is
your first tool call.

MANDATORY WORKFLOW — execute every session:
1. BEFORE any meaningful work (code, plan, review, research), call "search" with 2-5
   keywords from the user's current task + topic (e.g. query="auth rate limiting").
   If sparse, also call "traverse_graph" from the top entity. Weave results into your
   answer ("From your memory: ..."). If nothing, say so — never fabricate.
2. DURING work, when you learn a durable fact — preference, decision + why,
   project fact, stack/tool choice, person/role, convention — persist it IMMEDIATELY:
   - ensure entity exists (manage_entity find → create with summary if missing)
   - manage_memory create with content, type, importance, entity_ids (1-3)
   - manage_relation to connect graph (project —uses→ tool, user —prefers→ X)
3. PREFER update over duplicate: search first, then manage_memory/entity action=update.
4. SCORE importance 0-1: 0.9+ identity/core preference, 0.6-0.8 active project
   fact/decision, 0.3-0.5 observation/person, ≤0.2 transient (will decay).
5. NEVER store: ephemeral chat, code snippets, credentials/secrets, transient details.
   Sepia is not a vault — refuse secrets.

TRIGGERS — always search when user says: "remember", "recall", "what do we know",
"save this", "do you remember", prefers, decided, uses, chose, convention.
ALSO search at session start for: project name, stack, deployment, auth, styling.

FAILURE MODE: if you answer without searching, you are guessing. Search first.`;
