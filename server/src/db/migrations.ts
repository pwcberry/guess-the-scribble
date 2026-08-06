import type { Kysely } from "kysely";
import type { Migration, MigrationProvider } from "kysely/migration";

/**
 * Migrations are defined inline (not read from disk) so the exact same set
 * runs under tsx in development, compiled JS in production, and vitest in
 * tests — with no dependency on file layout or dynamic import paths.
 */

const initial: Migration = {
  async up(db: Kysely<unknown>): Promise<void> {
    await db.schema
      .createTable("rooms")
      .addColumn("id", "text", c => c.primaryKey())
      .addColumn("invite_code", "text", c => c.notNull().unique())
      .addColumn("settings", "text", c => c.notNull())
      .addColumn("status", "text", c => c.notNull())
      .addColumn("created_at", "bigint", c => c.notNull())
      .execute();

    await db.schema
      .createTable("games")
      .addColumn("id", "text", c => c.primaryKey())
      .addColumn("room_id", "text", c => c.notNull().references("rooms.id").onDelete("cascade"))
      .addColumn("started_at", "bigint", c => c.notNull())
      .addColumn("ended_at", "bigint")
      .addColumn("round_count", "integer", c => c.notNull())
      .execute();

    await db.schema
      .createTable("turns")
      .addColumn("id", "text", c => c.primaryKey())
      .addColumn("game_id", "text", c => c.notNull().references("games.id").onDelete("cascade"))
      .addColumn("round_ordinal", "integer", c => c.notNull())
      .addColumn("drawer_nickname", "text", c => c.notNull())
      .addColumn("word", "text", c => c.notNull())
      .addColumn("drawing", "text")
      .addColumn("ordinal", "integer", c => c.notNull())
      .execute();

    await db.schema
      .createTable("turn_results")
      .addColumn("id", "integer", c => c.primaryKey().generatedAlwaysAsIdentity())
      .addColumn("turn_id", "text", c => c.notNull().references("turns.id").onDelete("cascade"))
      .addColumn("nickname", "text", c => c.notNull())
      .addColumn("guessed_at", "bigint")
      .addColumn("points", "integer", c => c.notNull())
      .execute();

    await db.schema
      .createTable("players")
      .addColumn("id", "integer", c => c.primaryKey().generatedAlwaysAsIdentity())
      .addColumn("game_id", "text", c => c.notNull().references("games.id").onDelete("cascade"))
      .addColumn("session_id", "text", c => c.notNull())
      .addColumn("nickname", "text", c => c.notNull())
      .addColumn("total_score", "integer", c => c.notNull().defaultTo(0))
      .execute();

    await db.schema
      .createIndex("players_game_session")
      .on("players")
      .columns(["game_id", "session_id"])
      .unique()
      .execute();

    await db.schema
      .createTable("words")
      .addColumn("id", "integer", c => c.primaryKey().generatedAlwaysAsIdentity())
      .addColumn("word", "text", c => c.notNull().unique())
      .addColumn("category", "text", c => c.notNull())
      .addColumn("difficulty", "text", c => c.notNull())
      .execute();
  },

  async down(db: Kysely<unknown>): Promise<void> {
    for (const table of ["words", "players", "turn_results", "turns", "games", "rooms"]) {
      await db.schema.dropTable(table).ifExists().execute();
    }
  },
};

export const migrations: Record<string, Migration> = {
  "0001_initial": initial,
};

export class InlineMigrationProvider implements MigrationProvider {
  getMigrations(): Promise<Record<string, Migration>> {
    return Promise.resolve(migrations);
  }
}
