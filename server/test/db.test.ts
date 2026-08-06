import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createDb, type Db } from "../src/db/connection.js";
import { runMigrations } from "../src/db/setup.js";
import { seedWords } from "../src/db/seed.js";
import { truncateAll } from "./helpers.js";

describe("database", () => {
  let db: Db;

  beforeAll(async () => {
    db = createDb();
    await runMigrations(db);
  });

  afterAll(async () => {
    await db.destroy();
  });

  beforeEach(async () => {
    await truncateAll(db);
  });

  it("creates the schema and seeds words", async () => {
    const seeded = await seedWords(db);
    expect(seeded).toBeGreaterThan(0);

    const { count } = await db
      .selectFrom("words")
      .select(db.fn.countAll<number>().as("count"))
      .executeTakeFirstOrThrow();
    expect(Number(count)).toBe(seeded);
  });

  it("does not re-seed when words already exist", async () => {
    await seedWords(db);
    expect(await seedWords(db)).toBe(0);
  });

  it("persists a room row", async () => {
    await db
      .insertInto("rooms")
      .values({ id: "r1", invite_code: "ABC123", settings: "{}", status: "lobby", created_at: Date.now() })
      .execute();

    const room = await db
      .selectFrom("rooms")
      .selectAll()
      .where("invite_code", "=", "ABC123")
      .executeTakeFirstOrThrow();
    expect(room.id).toBe("r1");
  });
});
