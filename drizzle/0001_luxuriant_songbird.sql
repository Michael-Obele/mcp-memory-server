-- Prerequisite for the trigram (GIN) search indexes below.
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE INDEX "idx_entities_name_trgm" ON "entities" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_entities_summary_trgm" ON "entities" USING gin ("summary" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_memories_content_trgm" ON "memories" USING gin ("content" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_memories_active" ON "memories" USING btree ("namespace_id" uuid_ops,"importance" float4_ops,"updated_at" timestamptz_ops) WHERE NOT "memories"."archived";--> statement-breakpoint
ALTER TABLE "entities" ADD CONSTRAINT "entities_namespace_id_name_key" UNIQUE("namespace_id","name");--> statement-breakpoint
ALTER TABLE "entities" ADD CONSTRAINT "entities_importance_check" CHECK ("entities"."importance" >= 0 AND "entities"."importance" <= 1);--> statement-breakpoint
ALTER TABLE "relations" ADD CONSTRAINT "relations_weight_check" CHECK ("relations"."weight" >= 0 AND "relations"."weight" <= 1);--> statement-breakpoint
ALTER TABLE "memories" ADD CONSTRAINT "memories_importance_check" CHECK ("memories"."importance" >= 0 AND "memories"."importance" <= 1);--> statement-breakpoint
ALTER TABLE "memories" ADD CONSTRAINT "memories_type_check" CHECK ("memories"."type" IN ('fact', 'observation', 'preference', 'instruction'));