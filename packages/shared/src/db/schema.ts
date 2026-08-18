import {
  pgTable,
  unique,
  uuid,
  text,
  timestamp,
  index,
  foreignKey,
  jsonb,
  real,
  integer,
  boolean,
  primaryKey,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * Sepia knowledge-graph schema — single source of truth for the DB shape.
 * Shared by the MCP server (Fly) and the dashboard (Netlify) so both talk to
 * the same Neon Postgres with the same table definitions — no drift.
 * Introspected from the live DB (constraint/index names match exactly), then
 * extended with: CHECK constraints (importance/weight ∈ [0,1], type whitelist),
 * UNIQUE(namespace_id, name) on entities, pg_trgm GIN indexes for ILIKE search,
 * and a partial index for the queryMemories hot path.
 */

export const namespaces = pgTable(
  "namespaces",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    name: text().notNull(),
    description: text().default(""),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string",
    }).defaultNow(),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
      mode: "string",
    }).defaultNow(),
  },
  (table) => [unique("namespaces_name_key").on(table.name)],
);

export const entities = pgTable(
  "entities",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    namespaceId: uuid("namespace_id").notNull(),
    name: text().notNull(),
    type: text().notNull(),
    summary: text().default(""),
    metadata: jsonb().default({}),
    importance: real().default(0.5),
    accessCount: integer("access_count").default(0),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string",
    }).defaultNow(),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
      mode: "string",
    }).defaultNow(),
  },
  (table) => [
    index("idx_entities_name").using(
      "btree",
      table.name.asc().nullsLast().op("text_ops"),
    ),
    index("idx_entities_namespace").using(
      "btree",
      table.namespaceId.asc().nullsLast().op("uuid_ops"),
    ),
    index("idx_entities_type").using(
      "btree",
      table.type.asc().nullsLast().op("text_ops"),
    ),
    // New: no two entities with the same name in the same namespace.
    unique("entities_namespace_id_name_key").on(table.namespaceId, table.name),
    // New: importance must stay in [0, 1].
    check(
      "entities_importance_check",
      sql`${table.importance} >= 0 AND ${table.importance} <= 1`,
    ),
    // New: trigram indexes for ILIKE '%x%' name/summary search.
    index("idx_entities_name_trgm").using("gin", table.name.op("gin_trgm_ops")),
    index("idx_entities_summary_trgm").using(
      "gin",
      table.summary.op("gin_trgm_ops"),
    ),
    foreignKey({
      columns: [table.namespaceId],
      foreignColumns: [namespaces.id],
      name: "entities_namespace_id_fkey",
    }).onDelete("cascade"),
  ],
);

export const relations = pgTable(
  "relations",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    namespaceId: uuid("namespace_id").notNull(),
    sourceId: uuid("source_id").notNull(),
    targetId: uuid("target_id").notNull(),
    relationType: text("relation_type").notNull(),
    weight: real().default(0.5),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string",
    }).defaultNow(),
  },
  (table) => [
    index("idx_relations_source").using(
      "btree",
      table.sourceId.asc().nullsLast().op("uuid_ops"),
    ),
    index("idx_relations_target").using(
      "btree",
      table.targetId.asc().nullsLast().op("uuid_ops"),
    ),
    // New: weight must stay in [0, 1].
    check(
      "relations_weight_check",
      sql`${table.weight} >= 0 AND ${table.weight} <= 1`,
    ),
    foreignKey({
      columns: [table.namespaceId],
      foreignColumns: [namespaces.id],
      name: "relations_namespace_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.sourceId],
      foreignColumns: [entities.id],
      name: "relations_source_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.targetId],
      foreignColumns: [entities.id],
      name: "relations_target_id_fkey",
    }).onDelete("cascade"),
    unique("relations_source_id_target_id_relation_type_key").on(
      table.sourceId,
      table.targetId,
      table.relationType,
    ),
  ],
);

export const memories = pgTable(
  "memories",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    namespaceId: uuid("namespace_id").notNull(),
    content: text().notNull(),
    type: text().default("fact"),
    importance: real().default(0.5),
    source: text(),
    metadata: jsonb().default({}),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string",
    }).defaultNow(),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
      mode: "string",
    }).defaultNow(),
    archived: boolean().default(false),
  },
  (table) => [
    index("idx_memories_importance").using(
      "btree",
      table.importance.asc().nullsLast().op("float4_ops"),
    ),
    index("idx_memories_namespace").using(
      "btree",
      table.namespaceId.asc().nullsLast().op("uuid_ops"),
    ),
    index("idx_memories_type").using(
      "btree",
      table.type.asc().nullsLast().op("text_ops"),
    ),
    // New: importance must stay in [0, 1].
    check(
      "memories_importance_check",
      sql`${table.importance} >= 0 AND ${table.importance} <= 1`,
    ),
    // New: type must be one of the four known memory types.
    check(
      "memories_type_check",
      sql`${table.type} IN ('fact', 'observation', 'preference', 'instruction')`,
    ),
    // New: trigram index for the ILIKE '%x%' content search.
    index("idx_memories_content_trgm").using(
      "gin",
      table.content.op("gin_trgm_ops"),
    ),
    // New: partial index for the queryMemories hot path (importance DESC, updated_at DESC).
    index("idx_memories_active")
      .on(
        table.namespaceId.asc().nullsLast().op("uuid_ops"),
        table.importance.desc().nullsLast().op("float4_ops"),
        table.updatedAt.desc().nullsLast().op("timestamptz_ops"),
      )
      .where(sql`NOT ${table.archived}`),
    foreignKey({
      columns: [table.namespaceId],
      foreignColumns: [namespaces.id],
      name: "memories_namespace_id_fkey",
    }).onDelete("cascade"),
  ],
);

export const oauthClients = pgTable(
  "oauth_clients",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    clientId: text("client_id").notNull(),
    clientSecret: text("client_secret"),
    name: text().notNull(),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string",
    }).defaultNow(),
  },
  (table) => [unique("oauth_clients_client_id_key").on(table.clientId)],
);

export const memoryEntityLinks = pgTable(
  "memory_entity_links",
  {
    memoryId: uuid("memory_id").notNull(),
    entityId: uuid("entity_id").notNull(),
  },
  (table) => [
    index("idx_links_entity").using(
      "btree",
      table.entityId.asc().nullsLast().op("uuid_ops"),
    ),
    foreignKey({
      columns: [table.memoryId],
      foreignColumns: [memories.id],
      name: "memory_entity_links_memory_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.entityId],
      foreignColumns: [entities.id],
      name: "memory_entity_links_entity_id_fkey",
    }).onDelete("cascade"),
    primaryKey({
      columns: [table.memoryId, table.entityId],
      name: "memory_entity_links_pkey",
    }),
  ],
);
