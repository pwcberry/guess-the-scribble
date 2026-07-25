import { beforeEach, describe, expect, it } from "vitest";
import { RoomRegistry } from "../src/game/registry.js";
import type { Room } from "../src/game/room.js";
import { WordPool } from "../src/game/words.js";
import { FakeScheduler, joinRoom } from "./helpers.js";

describe("Round lifecycle", () => {
  let clock: FakeScheduler;
  let room: Room;

  beforeEach(() => {
    clock = new FakeScheduler();
    const registry = new RoomRegistry({
      words: new WordPool(["cat", "dog", "sun", "moon", "tree"]),
      scheduler: clock,
    });
    room = registry.create({ rounds: 2, drawTimeSec: 60, maxPlayers: 8 });
  });

  it("only the host can start, and only with 2+ players", () => {
    const ada = joinRoom(room, "ada");
    room.startGame(ada.sessionId);
    expect(ada.conn.last("error")?.code).toBe("bad_request");

    const bob = joinRoom(room, "bob");
    room.startGame(bob.sessionId); // not host
    expect(bob.conn.last("error")?.code).toBe("not_allowed");
  });

  it("starts a turn: drawer gets word choices, guessers do not", () => {
    const ada = joinRoom(room, "ada");
    const bob = joinRoom(room, "bob");
    room.startGame(ada.sessionId);

    const start = ada.conn.last("turnStart")!;
    expect(start.turn.phase).toBe("choosing");
    expect(start.turn.drawerSessionId).toBe(ada.sessionId);

    // Drawer (ada) is offered choices; guesser (bob) never receives the word.
    expect(ada.conn.ofType("wordChoices")).toHaveLength(1);
    expect(bob.conn.ofType("wordChoices")).toHaveLength(0);
  });

  it("moves to drawing on word choice and reveals only the pattern", () => {
    const ada = joinRoom(room, "ada");
    const bob = joinRoom(room, "bob");
    room.startGame(ada.sessionId);

    const word = ada.conn.last("wordChoices")!.words[0]!;
    room.chooseWord(ada.sessionId, word);

    const drawing = bob.conn.last("turnStart")!.turn;
    expect(drawing.phase).toBe("drawing");
    expect(drawing.wordLength).toBe(word.replace(/\s/g, "").length);
    expect(drawing.endsAt).toBe(60_000);
    // The pattern is masked; the raw word never appears in any guesser message.
    const guesserText = JSON.stringify(bob.conn.messages);
    expect(guesserText).not.toContain(word);
  });

  it("broadcasts drawer strokes to guessers but not the drawer", () => {
    const ada = joinRoom(room, "ada");
    const bob = joinRoom(room, "bob");
    room.startGame(ada.sessionId);
    room.chooseWord(ada.sessionId, ada.conn.last("wordChoices")!.words[0]!);

    room.handleMessage(ada.sessionId, {
      type: "draw",
      stroke: { points: [[0, 0], [0.5, 0.5]], color: "#111", width: 3 },
    });
    expect(ada.conn.ofType("drawBroadcast")).toHaveLength(0);
    expect(bob.conn.ofType("drawBroadcast")).toHaveLength(1);
  });

  it("auto-picks a word if the drawer dithers", () => {
    const ada = joinRoom(room, "ada");
    joinRoom(room, "bob");
    room.startGame(ada.sessionId);
    expect(room.turn?.phase).toBe("choosing");

    clock.advance(15_000);
    expect(room.turn?.phase).toBe("drawing");
    expect(room.turn?.word).not.toBeNull();
  });

  it("ends the turn on the timer, revealing the word, then rotates the drawer", () => {
    const ada = joinRoom(room, "ada");
    const bob = joinRoom(room, "bob");
    room.startGame(ada.sessionId);
    const word = ada.conn.last("wordChoices")!.words[0]!;
    room.chooseWord(ada.sessionId, word);

    clock.advance(60_000); // drawing time expires -> turn ends
    expect(bob.conn.last("turnEnd")!.word).toBe(word);

    clock.advance(5_000); // intermission -> turn 2 begins, drawer rotates to bob
    expect(room.turn?.turnOrdinal).toBe(2);
    expect(room.turn?.drawerSessionId).toBe(bob.sessionId);
  });

  it("plays rounds as full rotations: 2 rounds x 2 players = 4 turns, each draws twice", () => {
    const players = [joinRoom(room, "ada"), joinRoom(room, "bob")];
    const byId = new Map(players.map(p => [p.sessionId, p.conn]));
    room.startGame(players[0]!.sessionId);

    const drawers: string[] = [];
    // Play turns until the game ends; record each turn's drawer.
    while (room.status === "playing") {
      const drawerId = room.turn!.drawerSessionId;
      drawers.push(drawerId);
      room.chooseWord(drawerId, byId.get(drawerId)!.last("wordChoices")!.words[0]!);
      clock.advance(60_000); // drawing time -> turn ends
      clock.advance(5_000); // intermission -> next turn / game end
    }

    // settings.rounds (2) full rotations of 2 players = 4 turns; each drew twice.
    expect(drawers).toHaveLength(4);
    expect(drawers.filter(d => d === players[0]!.sessionId)).toHaveLength(2);
    expect(drawers.filter(d => d === players[1]!.sessionId)).toHaveLength(2);
    expect(room.status).toBe("ended");
    expect(players[0]!.conn.ofType("gameEnd")).toHaveLength(1);
  });

  it("runs rounds x players turns for a larger table", () => {
    const big = new RoomRegistry({
      words: new WordPool(["cat", "dog", "sun", "moon", "tree"]),
      scheduler: clock,
    }).create({ rounds: 3, drawTimeSec: 60, maxPlayers: 8 });
    const players = ["ada", "bob", "cy", "di"].map(n => joinRoom(big, n));
    const byId = new Map(players.map(p => [p.sessionId, p.conn]));
    big.startGame(players[0]!.sessionId);

    let turns = 0;
    while (big.status === "playing") {
      const drawerId = big.turn!.drawerSessionId;
      turns += 1;
      big.chooseWord(drawerId, byId.get(drawerId)!.last("wordChoices")!.words[0]!);
      clock.advance(60_000);
      clock.advance(5_000);
    }

    expect(turns).toBe(3 * 4); // rounds x players
  });

  it("ends early when players drop below 2 mid-game", () => {
    const ada = joinRoom(room, "ada");
    const bob = joinRoom(room, "bob");
    room.startGame(ada.sessionId);

    // Finish ada's turn; bob leaves during the intermission before his turn.
    room.chooseWord(ada.sessionId, ada.conn.last("wordChoices")!.words[0]!);
    clock.advance(60_000);
    room.leave(bob.sessionId);
    clock.advance(5_000); // intermission fires beginTurn with only 1 player

    expect(room.status).toBe("ended");
    expect(ada.conn.ofType("gameEnd")).toHaveLength(1);
  });
});
