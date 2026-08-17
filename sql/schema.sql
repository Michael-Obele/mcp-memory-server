-- Memory MCP Server — database schema (Neon Postgres)
-- Apply with: psql "$DATABASE_URL" -f sql/schema.sql

-- Namespaces: isolated memory containers
CREATE TABLE IF NOT EXISTS namespaces (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,
  description TEXT DEFAULT '',
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- Entities: nodes in the knowledge graph
CREATE TABLE IF NOT EXISTS entities (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  namespace_id  UUID NOT NULL REFERENCES namespaces(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  type          TEXT NOT NULL,          -- 'person', 'concept', 'project', 'tool', etc.
  summary       TEXT DEFAULT '',
  metadata      JSONB DEFAULT '{}',
  importance    REAL DEFAULT 0.5,       -- 0.0 to 1.0
  access_count  INT DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_entities_namespace ON entities(namespace_id);
CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(type);
CREATE INDEX IF NOT EXISTS idx_entities_name ON entities(name);

-- Relations: weighted directed edges
CREATE TABLE IF NOT EXISTS relations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  namespace_id  UUID NOT NULL REFERENCES namespaces(id) ON DELETE CASCADE,
  source_id     UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  target_id     UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  relation_type TEXT NOT NULL,          -- 'knows', 'uses', 'depends_on', 'part_of', etc.
  weight        REAL DEFAULT 0.5,       -- 0.0 to 1.0
  created_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(source_id, target_id, relation_type)
);

CREATE INDEX IF NOT EXISTS idx_relations_source ON relations(source_id);
CREATE INDEX IF NOT EXISTS idx_relations_target ON relations(target_id);

-- Memories: knowledge fragments (observations, facts, preferences)
CREATE TABLE IF NOT EXISTS memories (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  namespace_id  UUID NOT NULL REFERENCES namespaces(id) ON DELETE CASCADE,
  content       TEXT NOT NULL,
  type          TEXT DEFAULT 'fact',    -- 'fact', 'observation', 'preference', 'instruction'
  importance    REAL DEFAULT 0.5,       -- 0.0 to 1.0, higher = decays slower
  source        TEXT,                   -- where this came from (client name)
  metadata      JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),
  archived      BOOLEAN DEFAULT FALSE   -- marked for deletion by consolidation
);

CREATE INDEX IF NOT EXISTS idx_memories_namespace ON memories(namespace_id);
CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(type);
CREATE INDEX IF NOT EXISTS idx_memories_importance ON memories(importance);

-- Many-to-many link between memories and entities
CREATE TABLE IF NOT EXISTS memory_entity_links (
  memory_id UUID NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  PRIMARY KEY (memory_id, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_links_entity ON memory_entity_links(entity_id);

-- OAuth clients (Phase 2, @tmcp/auth)
CREATE TABLE IF NOT EXISTS oauth_clients (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     TEXT NOT NULL UNIQUE,
  client_secret TEXT,                   -- NULL for public (PKCE) clients
  name          TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Seed the default namespace
INSERT INTO namespaces (name, description)
VALUES ('personal', 'Default namespace')
ON CONFLICT (name) DO NOTHING;
