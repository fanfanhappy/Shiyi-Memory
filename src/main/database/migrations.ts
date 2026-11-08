import type { DatabaseSync } from "node:sqlite";
import { INITIAL_SCHEMA } from "./schema";

export const CURRENT_SCHEMA_VERSION = 1;

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

  if (currentVersion < 1) {
    db.exec("BEGIN IMMEDIATE");

    try {
      db.exec(INITIAL_SCHEMA);

      db.prepare(`
        INSERT INTO schema_migrations (version, applied_at)
        VALUES (?, ?)
      `).run(1, new Date().toISOString());

      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }
}
