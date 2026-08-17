import * as v from "valibot";
import {
  DEFAULT_IMPORTANCE,
  DEFAULT_NAMESPACE,
  IMPORTANCE_MAX,
  IMPORTANCE_MIN,
  MAX_ENTITY_LINKS,
  MEMORY_TYPES,
  QUERY_LIMIT_MAX,
  SEARCH_LIMIT_MAX,
  TRAVERSE_DEPTH_MAX,
} from "./types.ts";

/**
 * Valibot schemas for the memory knowledge graph. These are the single source
 * of truth: the MCP tools validate against them, the REST API (dashboard)
 * will validate against them, and `scripts/gen-skill-ref.ts` regenerates the
 * skill reference from them.
 */

export const importanceSchema = v.pipe(
  v.number(),
  v.minValue(IMPORTANCE_MIN),
  v.maxValue(IMPORTANCE_MAX),
);

export const uuidSchema = v.pipe(v.string(), v.uuid());

/** Metadata is a free-form object. */
export const metadataSchema = v.record(v.string(), v.unknown());

/** Namespace input (create/rename). */
export const NamespaceInput = v.object({
  name: v.pipe(v.string(), v.minLength(1), v.maxLength(64)),
  description: v.optional(v.string(), ""),
});

/** Entity input for create. */
export const EntityInput = v.object({
  name: v.pipe(v.string(), v.minLength(1), v.maxLength(200)),
  type: v.pipe(v.string(), v.minLength(1), v.maxLength(64)),
  summary: v.optional(v.string(), ""),
  importance: v.optional(importanceSchema, DEFAULT_IMPORTANCE),
  metadata: v.optional(metadataSchema, {}),
});

/** Entity input for update — any subset of fields. */
export const EntityUpdateInput = v.object({
  name: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(200))),
  type: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(64))),
  summary: v.optional(v.string()),
  importance: v.optional(importanceSchema),
  metadata: v.optional(metadataSchema),
});

/** Relation input for create. */
export const RelationInput = v.object({
  source_id: uuidSchema,
  target_id: uuidSchema,
  relation_type: v.pipe(v.string(), v.minLength(1), v.maxLength(64)),
  weight: v.optional(importanceSchema, DEFAULT_IMPORTANCE),
});

/** Memory input for create. */
export const MemoryInput = v.object({
  content: v.pipe(v.string(), v.minLength(1), v.maxLength(4000)),
  type: v.optional(v.picklist(MEMORY_TYPES), "fact"),
  importance: v.optional(importanceSchema, DEFAULT_IMPORTANCE),
  namespace: v.optional(v.string(), DEFAULT_NAMESPACE),
  entity_ids: v.optional(
    v.pipe(v.array(uuidSchema), v.maxLength(MAX_ENTITY_LINKS)),
    [],
  ),
  metadata: v.optional(metadataSchema, {}),
});

/** Memory update — content/type/importance/metadata; entity_ids REPLACES the link set. */
export const MemoryUpdateInput = v.object({
  content: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(4000))),
  type: v.optional(v.picklist(MEMORY_TYPES)),
  importance: v.optional(importanceSchema),
  metadata: v.optional(metadataSchema),
  entity_ids: v.optional(
    v.pipe(v.array(uuidSchema), v.maxLength(MAX_ENTITY_LINKS)),
  ),
});

/** Unified search input. */
export const SearchInput = v.object({
  q: v.pipe(v.string(), v.minLength(1), v.maxLength(200)),
  namespace: v.optional(v.string()),
  type: v.optional(v.picklist(MEMORY_TYPES)),
  limit: v.optional(
    v.pipe(v.number(), v.minValue(1), v.maxValue(SEARCH_LIMIT_MAX)),
    10,
  ),
});

/** Graph traversal input. */
export const TraverseInput = v.object({
  start_id: uuidSchema,
  depth: v.optional(
    v.pipe(v.number(), v.minValue(1), v.maxValue(TRAVERSE_DEPTH_MAX)),
    1,
  ),
});

/** Consolidation sweep input. */
export const ConsolidateInput = v.object({});

/**
 * ── Tool-level schemas (the `action` enum pattern) ─────────────────────────
 * Each `manage_*` tool covers several actions through an action union,
 * keeping the LLM-facing tool surface to 7 while covering every capability.
 */

export const NamespaceToolInput = v.object({
  action: v.union([
    v.literal("create"),
    v.literal("list"),
    v.literal("get"),
    v.literal("delete"),
  ]),
  name: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(64))),
  id: v.optional(uuidSchema),
  description: v.optional(v.string(), ""),
});

export const EntityToolInput = v.object({
  action: v.union([
    v.literal("create"),
    v.literal("get"),
    v.literal("update"),
    v.literal("delete"),
    v.literal("find"),
  ]),
  namespace: v.optional(v.string(), DEFAULT_NAMESPACE),
  id: v.optional(uuidSchema),
  entity: v.optional(EntityInput),
  update: v.optional(EntityUpdateInput),
  /** find: name to match (exact or substring) */
  query: v.optional(v.string()),
  /** find: optional type filter */
  type: v.optional(v.string()),
});

export const RelationToolInput = v.object({
  action: v.union([
    v.literal("create"),
    v.literal("delete"),
    v.literal("list"),
  ]),
  relation: v.optional(RelationInput),
  id: v.optional(uuidSchema),
  /** list: filter by entity (in + out) or by namespace */
  entity_id: v.optional(uuidSchema),
  namespace: v.optional(v.string()),
});

export const MemoryToolInput = v.object({
  action: v.union([
    v.literal("create"),
    v.literal("get"),
    v.literal("update"),
    v.literal("delete"),
    v.literal("query"),
  ]),
  id: v.optional(uuidSchema),
  memory: v.optional(MemoryInput),
  update: v.optional(MemoryUpdateInput),
  /** query filters */
  type: v.optional(v.picklist(MEMORY_TYPES)),
  namespace: v.optional(v.string(), DEFAULT_NAMESPACE),
  importance_min: v.optional(importanceSchema),
  archived: v.optional(v.boolean(), false),
  limit: v.optional(
    v.pipe(v.number(), v.minValue(1), v.maxValue(QUERY_LIMIT_MAX)),
    20,
  ),
});

export const SearchToolInput = SearchInput;

export const TraverseToolInput = TraverseInput;

export const ConsolidateToolInput = v.object({});

/** All tool names, exported for tests and the smoke script. */
export const TOOL_NAMES = [
  "manage_namespace",
  "manage_entity",
  "manage_relation",
  "manage_memory",
  "search",
  "traverse_graph",
  "consolidate",
] as const;
