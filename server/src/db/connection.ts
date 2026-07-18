import { fileURLToPath } from "node:url";
import SQLite from "better-sqlite3";
import { Kysely, SqliteDialect } from "kysely";
import type { Database as DB } from "./schema.js";

export type Db = Kysely<DB>;

/**
 * Resolve the SQLite file path. `DB_FILE` (set verbatim, e.g. an absolute path
 * in Docker or ":memory:" in tests) wins; otherwise default to `<repo>/data/
 * gts.db` resolved from this module's location so the path is stable no matter
 * which working directory the process was launched from.
 */
export function dbFile(): string {
  if (process.env.DB_FILE) {
    return process.env.DB_FILE;
  }
  return fileURLToPath(new URL("../../../data/gts.db", import.meta.url));
}

/**
 * Open a SQLite database and wrap it in a typed Kysely instance. WAL mode lets
 * readers proceed during writes; foreign keys are enforced (off by default in
 * SQLite).
 */
export function createDb(file: string = dbFile()): Db {
  const sqlite = new SQLite(file);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  return new Kysely<DB>({ dialect: new SqliteDialect({ database: sqlite }) });
}
