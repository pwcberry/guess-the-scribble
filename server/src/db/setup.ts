import { Migrator, type MigrationResult } from "kysely/migration";
import type { Db } from "./connection.js";
import { InlineMigrationProvider } from "./migrations.js";

/** Bring a database up to the latest migration. Throws on failure. */
export async function runMigrations(db: Db): Promise<readonly MigrationResult[]> {
  const migrator = new Migrator({ db, provider: new InlineMigrationProvider() });
  const { error, results } = await migrator.migrateToLatest();
  if (error) {
    throw error instanceof Error ? error : new Error(String(error));
  }
  return results ?? [];
}

/**
 * Roll back all migrations in reverse order. Use this for `db:reset` before
 * re-running `runMigrations` to get a clean slate.
 */
export async function resetDb(db: Db): Promise<void> {
  const migrator = new Migrator({ db, provider: new InlineMigrationProvider() });
  let hasMore = true;
  while (hasMore) {
    const { error, results } = await migrator.migrateDown();
    if (error) {
      throw error instanceof Error ? error : new Error(String(error));
    }
    hasMore = (results?.length ?? 0) > 0;
  }
}
