import type { DatabaseSync } from "node:sqlite";
import {
  INITIAL_SCHEMA,
  MEMORY_HISTORY_SCHEMA
} from "./schema";

export const CURRENT_SCHEMA_VERSION = 2;

function applyMigration(
  db: DatabaseSync,
  version: number,
  schema: string
): void {
  db.exec("BEGIN IMMEDIATE");

  try {
    db.exec(schema);

    db.prepare(`
      INSERT INTO schema_migrations (version, applied_at)
      VALUES (?, ?)
    `).run(version, new Date().toISOString());

    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function runMigrations(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const row = db.prepare(`
    SELECT MAX(version) AS version
    FROM schema_migrations
  `).get() as { version: number | null };

  const currentVersion = row.version ?? 0;

  if (currentVersion > CURRENT_SCHEMA_VERSION) {
    throw new Error(
      `Database version ${currentVersion} is newer than supported version ${CURRENT_SCHEMA_VERSION}`
    );
  }

  // V1：基础数据库
  if (currentVersion < 1) {
    applyMigration(db, 1, INITIAL_SCHEMA);
  }

  // V2：记忆版本管理与审计
  if (currentVersion < 2) {
    applyMigration(db, 2, MEMORY_HISTORY_SCHEMA);
  }

  console.info(
    `[Shiyi] Database schema version: ${CURRENT_SCHEMA_VERSION}`
  );
}
