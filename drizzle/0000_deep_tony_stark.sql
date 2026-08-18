-- Baseline schema for Sepia (namespaces · entities · relations · memories ·
-- memory_entity_links · oauth_clients). Generated from the live schema via
-- `drizzle-kit pull`, then cleaned up: the pull artifact wraps everything in a
-- comment block (which breaks `drizzle-kit migrate`), so this is the
-- uncommented, complete baseline. Fresh DBs get the full schema from here;
-- the existing live DB is baselined against this migration (see README).
CREATE TABLE "namespaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '',
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "namespaces_name_key" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "entities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"namespace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"summary" text DEFAULT '',
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"importance" real DEFAULT 0.5,
	"access_count" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "relations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"namespace_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"target_id" uuid NOT NULL,
	"relation_type" text NOT NULL,
	"weight" real DEFAULT 0.5,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "relations_source_id_target_id_relation_type_key" UNIQUE("source_id","target_id","relation_type")
);
--> statement-breakpoint
CREATE TABLE "memories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"namespace_id" uuid NOT NULL,
	"content" text NOT NULL,
	"type" text DEFAULT 'fact',
	"importance" real DEFAULT 0.5,
	"source" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"archived" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "oauth_clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" text NOT NULL,
	"client_secret" text,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "oauth_clients_client_id_key" UNIQUE("client_id")
);
--> statement-breakpoint
CREATE TABLE "memory_entity_links" (
	"memory_id" uuid NOT NULL,
	"entity_id" uuid NOT NULL,
	CONSTRAINT "memory_entity_links_pkey" PRIMARY KEY("memory_id","entity_id")
);
--> statement-breakpoint
ALTER TABLE "entities" ADD CONSTRAINT "entities_namespace_id_fkey" FOREIGN KEY ("namespace_id") REFERENCES "public"."namespaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relations" ADD CONSTRAINT "relations_namespace_id_fkey" FOREIGN KEY ("namespace_id") REFERENCES "public"."namespaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relations" ADD CONSTRAINT "relations_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relations" ADD CONSTRAINT "relations_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memories" ADD CONSTRAINT "memories_namespace_id_fkey" FOREIGN KEY ("namespace_id") REFERENCES "public"."namespaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memory_entity_links" ADD CONSTRAINT "memory_entity_links_memory_id_fkey" FOREIGN KEY ("memory_id") REFERENCES "public"."memories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memory_entity_links" ADD CONSTRAINT "memory_entity_links_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_entities_name" ON "entities" USING btree ("name" text_ops);--> statement-breakpoint
CREATE INDEX "idx_entities_namespace" ON "entities" USING btree ("namespace_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_entities_type" ON "entities" USING btree ("type" text_ops);--> statement-breakpoint
CREATE INDEX "idx_relations_source" ON "relations" USING btree ("source_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_relations_target" ON "relations" USING btree ("target_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_memories_importance" ON "memories" USING btree ("importance" float4_ops);--> statement-breakpoint
CREATE INDEX "idx_memories_namespace" ON "memories" USING btree ("namespace_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_memories_type" ON "memories" USING btree ("type" text_ops);--> statement-breakpoint
CREATE INDEX "idx_links_entity" ON "memory_entity_links" USING btree ("entity_id" uuid_ops);--> statement-breakpoint
-- Seed the default namespace (matches the original sql/schema.sql behavior).
INSERT INTO "namespaces" ("name", "description") VALUES ('personal', 'Default namespace') ON CONFLICT ("name") DO NOTHING;
