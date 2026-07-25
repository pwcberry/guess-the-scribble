import type { PlayerView, RoomView, ServerMessage } from "@gts/shared";
import { describe, expect, it } from "vitest";
import { initialState, reduce, type GameState } from "../src/state/store.ts";

function player(sessionId: string, over: Partial<PlayerView> = {}): PlayerView {
  return {
    sessionId,
    nickname: sessionId,
    score: 0,
    connected: true,
    isHost: false,
    isDrawer: false,
    hasGuessed: false,
    ...over,
  };
}

function room(over: Partial<RoomView> = {}): RoomView {
  return {
    code: "ABC123",
    status: "lobby",
    settings: { rounds: 3, drawTimeSec: 60, maxPlayers: 8 },
    players: [player("a", { isHost: true }), player("b")],
    round: null,
    ...over,
  };
}

/** Fold a sequence of messages starting from a given state. */
function run(start: GameState, ...messages: ServerMessage[]): GameState {
  return messages.reduce(reduce, start);
}

describe("store reducer", () => {
  it("records sessionId and room on joined and clears any prior error", () => {
    const errored = reduce(initialState, { type: "error", code: "room_full", message: "full" });
    const next = reduce(errored, { type: "joined", sessionId: "a", room: room() });
    expect(next.sessionId).toBe("a");
    expect(next.room?.code).toBe("ABC123");
    expect(next.error).toBeNull();
  });

  it("adds a joining player without duplicating on reconnect", () => {
    const joined = reduce(initialState, { type: "joined", sessionId: "a", room: room() });
    const withC = reduce(joined, { type: "playerJoined", player: player("c") });
    expect(withC.room?.players.map(p => p.sessionId)).toEqual(["a", "b", "c"]);

    // A repeat playerJoined (e.g. reconnect) replaces rather than duplicates.
    const again = reduce(withC, { type: "playerJoined", player: player("c", { connected: true }) });
    expect(again.room?.players.filter(p => p.sessionId === "c")).toHaveLength(1);
  });

  it("removes a player on playerLeft", () => {
    const joined = reduce(initialState, { type: "joined", sessionId: "a", room: room() });
    const left = reduce(joined, { type: "playerLeft", sessionId: "b" });
    expect(left.room?.players.map(p => p.sessionId)).toEqual(["a"]);
  });

  it("sets the round and flips the room to playing on roundStart", () => {
    const joined = reduce(initialState, { type: "joined", sessionId: "a", room: room() });
    const started = reduce(joined, {
      type: "roundStart",
      round: {
        ordinal: 1,
        rotationOrdinal: 1,
        totalRounds: 3,
        drawerSessionId: "a",
        drawerNickname: "a",
        wordPattern: "_ _ _",
        wordLength: 3,
        phase: "drawing",
        endsAt: 1000,
      },
    });
    expect(started.room?.status).toBe("playing");
    expect(started.room?.round?.ordinal).toBe(1);
  });

  it("keeps word choices only until the next round clears them", () => {
    const withChoices = reduce(initialState, { type: "wordChoices", words: ["cat", "dog", "sun"] });
    expect(withChoices.wordChoices).toEqual(["cat", "dog", "sun"]);
    const joined = reduce(withChoices, { type: "joined", sessionId: "a", room: room() });
    const started = reduce(joined, {
      type: "roundStart",
      round: {
        ordinal: 2,
        rotationOrdinal: 1,
        totalRounds: 3,
        drawerSessionId: "b",
        drawerNickname: "b",
        wordPattern: "_ _ _",
        wordLength: 3,
        phase: "drawing",
        endsAt: 2000,
      },
    });
    expect(started.wordChoices).toEqual([]);
  });

  it("keeps the drawer's word across the drawing roundStart but clears it on a new round", () => {
    const drawing = (ordinal: number, phase: "choosing" | "drawing"): ServerMessage => ({
      type: "roundStart",
      round: {
        ordinal,
        rotationOrdinal: 1,
        totalRounds: 3,
        drawerSessionId: "a",
        drawerNickname: "a",
        wordPattern: "_ _ _",
        wordLength: 3,
        phase,
        endsAt: phase === "drawing" ? 1000 : null,
      },
    });
    const joined = reduce(initialState, { type: "joined", sessionId: "a", room: room() });
    // The drawer has chosen "cat" (store sets myWord); the drawing-phase roundStart must keep it.
    const drawingNow = reduce({ ...joined, myWord: "cat" }, drawing(1, "drawing"));
    expect(drawingNow.myWord).toBe("cat");
    // Round ends, then the next round opens in "choosing" — the word is cleared both times.
    const ended = reduce(drawingNow, {
      type: "roundEnd",
      word: "cat",
      results: [],
      scores: [],
    });
    expect(ended.myWord).toBeNull();
    expect(reduce({ ...drawingNow }, drawing(2, "choosing")).myWord).toBeNull();
  });

  it("appends chat with monotonic ids", () => {
    const next = run(
      initialState,
      { type: "chat", nickname: "a", text: "hi", kind: "chat" },
      { type: "chat", nickname: "b", text: "hey", kind: "chat" },
    );
    expect(next.chat.map(c => c.id)).toEqual([1, 2]);
    expect(next.chat.map(c => c.text)).toEqual(["hi", "hey"]);
  });

  it("marks the guesser and logs a correct-guess line", () => {
    const joined = reduce(initialState, { type: "joined", sessionId: "a", room: room() });
    const next = reduce(joined, { type: "correctGuess", sessionId: "b", nickname: "b" });
    expect(next.room?.players.find(p => p.sessionId === "b")?.hasGuessed).toBe(true);
    expect(next.chat.at(-1)).toMatchObject({ kind: "correct", nickname: "b" });
  });

  it("applies final scores and reveals the word on roundEnd", () => {
    const joined = reduce(initialState, { type: "joined", sessionId: "a", room: room() });
    const next = reduce(joined, {
      type: "roundEnd",
      word: "cat",
      results: [{ sessionId: "b", nickname: "b", guessed: true, points: 50 }],
      scores: [{ sessionId: "b", nickname: "b", score: 50 }],
    });
    expect(next.lastRound).toEqual({
      word: "cat",
      results: [{ sessionId: "b", nickname: "b", guessed: true, points: 50 }],
    });
    expect(next.room?.players.find(p => p.sessionId === "b")?.score).toBe(50);
    expect(next.chat.at(-1)).toMatchObject({ kind: "system", text: `The word was "cat".` });
  });

  it("ends the game and stores final scores on gameEnd", () => {
    const joined = reduce(initialState, { type: "joined", sessionId: "a", room: room() });
    const next = reduce(joined, { type: "gameEnd", scores: [{ sessionId: "a", nickname: "a", score: 100 }] });
    expect(next.room?.status).toBe("ended");
    expect(next.finalScores).toEqual([{ sessionId: "a", nickname: "a", score: 100 }]);
  });

  it("passes canvas messages through without touching state", () => {
    const joined = reduce(initialState, { type: "joined", sessionId: "a", room: room() });
    const afterClear = reduce(joined, { type: "clearCanvas" });
    expect(afterClear).toBe(joined);
    const afterDraw = reduce(joined, {
      type: "drawBroadcast",
      stroke: { points: [[0, 0], [1, 1]], color: "#000", width: 2 },
    });
    expect(afterDraw).toBe(joined);
  });
});
