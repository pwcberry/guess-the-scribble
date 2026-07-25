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
    const conns = new Map([[ada.sessionId, ada.conn], [bob.sessionId, bob.conn]]);
    room.startGame(ada.sessionId);

    // rounds: 1 is one full rotation -> both players draw once (2 turns). Each turn
    // the drawer draws one stroke and the other player guesses immediately.
    const words: string[] = [];
    while (room.status === "playing") {
      const drawerId = room.turn!.drawerSessionId;
      const guesserId = drawerId === ada.sessionId ? bob.sessionId : ada.sessionId;
      const word = conns.get(drawerId)!.last("wordChoices")!.words[0]!;
      words.push(word);
      room.chooseWord(drawerId, word);
      room.handleMessage(drawerId, {
        type: "draw",
        stroke: { points: [[0, 0], [1, 1]], color: "#000", width: 2 },
      });
      room.handleMessage(guesserId, { type: "guess", text: word }); // all guessed -> turn ends
      clock.advance(5_000); // intermission -> next turn / game end
    }

    await sink.flush();
    expect(persistError).toBeUndefined();

    const game = await db.selectFrom("games").selectAll().executeTakeFirstOrThrow();
    expect(game.round_count).toBe(1); // 1 rotation configured
    expect(game.ended_at).not.toBeNull();

    const turns = await db.selectFrom("turns").selectAll().orderBy("ordinal").execute();
    expect(turns).toHaveLength(2); // 1 round (rotation) x 2 players
    expect(turns.map(t => t.word)).toEqual(words);
    expect(turns.every(t => t.round_ordinal === 1)).toBe(true); // both turns in round 1
    expect(JSON.parse(turns[0]!.drawing!)).toHaveLength(1); // one recorded stroke per turn

    const results = await db.selectFrom("turn_results").selectAll().execute();
    expect(results).toHaveLength(4); // drawer + guesser, per turn

    // Each player drew once (drawer points 50) and guessed once immediately (100) -> 150.
    const players = await db.selectFrom("players").selectAll().execute();
    const bobRow = players.find(p => p.session_id === bob.sessionId)!;
    expect(bobRow.nickname).toBe("bob");
    expect(bobRow.total_score).toBe(150);
    expect(players.find(p => p.session_id === ada.sessionId)!.total_score).toBe(150);
  });
});
