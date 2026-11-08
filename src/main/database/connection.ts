import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { runMigrations } from "./migrations";

let database: DatabaseSync | null = null;
let databasePath: string | null = null;

export function initializeDatabase(
  dataDirectory: string
): DatabaseSync {
  if (database) {
    return database;
  }

  mkdirSync(dataDirectory, {
    recursive: true
  });

  const filePath = join(dataDirectory, "shiyi.db");
  const connection = new DatabaseSync(filePath);

  try {
    connection.exec("PRAGMA foreign_keys = ON;");
    connection.exec("PRAGMA journal_mode = WAL;");
    connection.exec("PRAGMA busy_timeout = 5000;");

    runMigrations(connection);

    database = connection;
    databasePath = filePath;

    console.info("[Shiyi] SQLite initialized:", filePath);

    return connection;
  } catch (error) {
    connection.close();
    throw error;
  }
}

export function getDatabase(): DatabaseSync {
  if (!database) {
    throw new Error("Database has not been initialized.");
  }

  return database;
}

export function getDatabasePath(): string {
  if (!databasePath) {
    throw new Error("Database has not been initialized.");
  }

  return databasePath;
}

export function closeDatabase(): void {
  if (database) {
    database.close();
    database = null;
    databasePath = null;

    console.info("[Shiyi] SQLite database closed.");
  }
}
