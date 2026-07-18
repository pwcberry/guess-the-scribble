import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDb, type Db } from "../src/db/connection.js";
import { createGameEventSink } from "../src/db/persistence.js";
import { insertRoom } from "../src/db/rooms.js";
import { seedWords } from "../src/db/seed.js";
import { runMigrations } from "../src/db/setup.js";
import { RoomRegistry } from "../src/game/registry.js";
import { WordPool } from "../src/game/words.js";
import { FakeScheduler, joinRoom } from "./helpers.js";

describe("persistence", () => {
  let db: Db;

  beforeEach(async () => {
    db = createDb(":memory:");
    await runMigrations(db);
    await seedWords(db);
  });

  afterEach(async () => {
    await db.destroy();
  });

  it("persists a full game: game, round, results, drawing, and players", async () => {
    const clock = new FakeScheduler();
    let persistError: unknown;
    const sink = createGameEventSink(db, (_event, err) => {
      persistError = err;
    });
    const registry = new RoomRegistry({
      words: new WordPool(["cat", "dog", "sun", "moon"]),
      scheduler: clock,
      events: sink,
    });
    const room = registry.create({ rounds: 1, drawTimeSec: 60, maxPlayers: 8 });
    await insertRoom(db, room); // the room is persisted at creation (POST /api/rooms)

    const ada = joinRoom(room, "ada");
    const bob = joinRoom(room, "bob");
    room.startGame(ada.sessionId);
    const word = ada.conn.last("wordChoices")!.words[0]!;
    room.chooseWord(ada.sessionId, word);
    room.handleMessage(ada.sessionId, {
      type: "draw",
      stroke: { points: [[0, 0], [1, 1]], color: "#000", width: 2 },
    });
    room.handleMessage(bob.sessionId, { type: "guess", text: word }); // all guessed -> round ends
    clock.advance(5_000); // intermission -> game ends (rounds = 1)

    await sink.flush();
    expect(persistError).toBeUndefined();

    const game = await db.selectFrom("games").selectAll().executeTakeFirstOrThrow();
    expect(game.round_count).toBe(1);
    expect(game.ended_at).not.toBeNull();

    const rounds = await db.selectFrom("rounds").selectAll().execute();
    expect(rounds).toHaveLength(1);
    expect(rounds[0]!.word).toBe(word);
    expect(JSON.parse(rounds[0]!.drawing!)).toHaveLength(1); // one recorded stroke

    const results = await db.selectFrom("round_results").selectAll().execute();
    expect(results).toHaveLength(2); // drawer + guesser

    const players = await db.selectFrom("players").selectAll().execute();
    const bobRow = players.find(p => p.session_id === bob.sessionId)!;
    expect(bobRow.nickname).toBe("bob");
    expect(bobRow.total_score).toBe(100);
    expect(players.find(p => p.session_id === ada.sessionId)!.total_score).toBe(50);
  });
});
