export const INITIAL_SCHEMA = `
CREATE TABLE IF NOT EXISTS memories (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL CHECK(length(trim(content)) > 0),
  summary TEXT,
  memory_type TEXT NOT NULL DEFAULT 'general'
    CHECK(memory_type IN (
      'general', 'fact', 'preference', 'experience',
      'project', 'person', 'goal', 'event'
    )),
  importance INTEGER NOT NULL DEFAULT 3
    CHECK(importance BETWEEN 1 AND 5),
  source TEXT NOT NULL DEFAULT 'manual'
    CHECK(source IN ('manual', 'conversation', 'import', 'system')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK(status IN ('active', 'archived', 'deleted')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_accessed_at TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_memories_status
ON memories(status);

CREATE INDEX IF NOT EXISTS idx_memories_type
ON memories(memory_type);

CREATE INDEX IF NOT EXISTS idx_memories_updated
ON memories(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_memories_importance
ON memories(importance DESC);

CREATE TABLE IF NOT EXISTS entities (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL COLLATE NOCASE UNIQUE,
  entity_type TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS relations (
  id TEXT PRIMARY KEY,
  source_entity_id TEXT NOT NULL,
  target_entity_id TEXT NOT NULL,
  relation_type TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY(source_entity_id) REFERENCES entities(id) ON DELETE CASCADE,
  FOREIGN KEY(target_entity_id) REFERENCES entities(id) ON DELETE CASCADE,
  UNIQUE(source_entity_id, target_entity_id, relation_type),
  CHECK(source_entity_id <> target_entity_id)
);

CREATE TABLE IF NOT EXISTS memory_tags (
  memory_id TEXT NOT NULL,
  tag TEXT NOT NULL COLLATE NOCASE,
  created_at TEXT NOT NULL,
  PRIMARY KEY(memory_id, tag),
  FOREIGN KEY(memory_id) REFERENCES memories(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS memory_entities (
  memory_id TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  relation_type TEXT NOT NULL DEFAULT 'mentions',
  created_at TEXT NOT NULL,
  PRIMARY KEY(memory_id, entity_id, relation_type),
  FOREIGN KEY(memory_id) REFERENCES memories(id) ON DELETE CASCADE,
  FOREIGN KEY(entity_id) REFERENCES entities(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK(status IN ('active', 'archived'))
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  role TEXT NOT NULL
    CHECK(role IN ('user', 'assistant', 'system', 'tool')),
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation
ON messages(conversation_id, created_at);

CREATE INDEX IF NOT EXISTS idx_relations_source
ON relations(source_entity_id);

CREATE INDEX IF NOT EXISTS idx_memory_entities_entity
ON memory_entities(entity_id);
`;
