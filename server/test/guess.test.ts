import type { Score } from "@gts/shared";
import { beforeEach, describe, expect, it } from "vitest";
import { RoomRegistry } from "../src/game/registry.js";
import type { Room } from "../src/game/room.js";
import { WordPool } from "../src/game/words.js";
import { FakeScheduler, joinRoom } from "./helpers.js";

const WORDS = ["cat", "dog", "sun", "moon", "tree"];

function scoreOf(scores: Score[], sessionId: string): number {
  return scores.find(s => s.sessionId === sessionId)?.score ?? 0;
}

describe("Guessing and scoring", () => {
  let clock: FakeScheduler;
  let room: Room;

  beforeEach(() => {
    clock = new FakeScheduler();
    const registry = new RoomRegistry({ words: new WordPool(WORDS), scheduler: clock });
    room = registry.create({ rounds: 1, drawTimeSec: 60, maxPlayers: 8 });
  });

  it("awards the guesser and drawer and ends the round when all have guessed", () => {
    const ada = joinRoom(room, "ada");
    const bob = joinRoom(room, "bob");
    room.startGame(ada.sessionId);
    const word = ada.conn.last("wordChoices")!.words[0]!;
    room.chooseWord(ada.sessionId, word);

    room.handleMessage(bob.sessionId, { type: "guess", text: word.toUpperCase() });

    expect(bob.conn.ofType("guessResult")[0]!.correct).toBe(true);
    expect(ada.conn.ofType("correctGuess")).toHaveLength(1);

    const end = bob.conn.last("turnEnd")!;
    expect(scoreOf(end.scores, bob.sessionId)).toBe(100); // guessed at full time
    expect(scoreOf(end.scores, ada.sessionId)).toBe(50); // all (1/1) guessers got it
  });

  it("ignores an incorrect guess but broadcasts it as chat", () => {
    const ada = joinRoom(room, "ada");
    const bob = joinRoom(room, "bob");
    room.startGame(ada.sessionId);
    const word = ada.conn.last("wordChoices")!.words[0]!;
    const wrong = WORDS.find(w => w !== word)!;
    room.chooseWord(ada.sessionId, word);

    room.handleMessage(bob.sessionId, { type: "guess", text: wrong });

    expect(bob.conn.ofType("guessResult")).toHaveLength(0);
    expect(ada.conn.ofType("chat").length).toBeGreaterThan(0);
    expect(room.getPlayer(bob.sessionId)!.score).toBe(0);
  });

  it("never sends the secret word to a guesser during drawing", () => {
    const ada = joinRoom(room, "ada");
    const bob = joinRoom(room, "bob");
    room.startGame(ada.sessionId);
    const word = ada.conn.last("wordChoices")!.words[0]!;
    room.chooseWord(ada.sessionId, word);
    room.handleMessage(ada.sessionId, {
      type: "draw",
      stroke: { points: [[0, 0], [1, 1]], color: "#000", width: 2 },
    });

    expect(JSON.stringify(bob.conn.messages)).not.toContain(word);
  });

  it("scores partial guesses when the timer ends the round", () => {
    const ada = joinRoom(room, "ada");
    const bob = joinRoom(room, "bob");
    const cy = joinRoom(room, "cy");
    room.startGame(ada.sessionId);
    const word = ada.conn.last("wordChoices")!.words[0]!;
    room.chooseWord(ada.sessionId, word);

    room.handleMessage(bob.sessionId, { type: "guess", text: word }); // cy stays silent
    clock.advance(60_000); // timer ends the round

    const end = ada.conn.last("turnEnd")!;
    expect(scoreOf(end.scores, bob.sessionId)).toBe(100);
    expect(scoreOf(end.scores, ada.sessionId)).toBe(25); // drawerPoints(1 of 2)
    expect(scoreOf(end.scores, cy.sessionId)).toBe(0);
  });
});
