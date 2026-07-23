import type { PlayerView, RoomView } from "@gts/shared";
import { describe, expect, it } from "vitest";
import { initialState, type GameState } from "../src/state/store.ts";
import {
  canStartGame,
  connectedCount,
  inviteLink,
  isHost,
  parseRoomCode,
  selfPlayer,
} from "../src/components/lobby-helpers.ts";

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

function room(players: PlayerView[], over: Partial<RoomView> = {}): RoomView {
  return {
    code: "ABC123",
    status: "lobby",
    settings: { rounds: 3, drawTimeSec: 80, maxPlayers: 8 },
    players,
    round: null,
    ...over,
  };
}

function stateWith(room: RoomView | null, sessionId: string | null): GameState {
  return { ...initialState, room, sessionId };
}

describe("parseRoomCode", () => {
  it("extracts and upper-cases the room code", () => {
    expect(parseRoomCode("?room=abc123")).toBe("ABC123");
    expect(parseRoomCode("?foo=1&room=Xy9")).toBe("XY9");
  });

  it("returns null when absent or blank", () => {
    expect(parseRoomCode("")).toBeNull();
    expect(parseRoomCode("?room=")).toBeNull();
    expect(parseRoomCode("?other=1")).toBeNull();
  });
});

describe("inviteLink", () => {
  it("builds a shareable link with the code as a query param", () => {
    expect(inviteLink("https://gts.example", "ABC123")).toBe("https://gts.example/?room=ABC123");
  });
});

describe("player helpers", () => {
  it("counts only connected players", () => {
    expect(connectedCount([player("a"), player("b", { connected: false }), player("c")])).toBe(2);
  });

  it("finds the local player and their host flag", () => {
    const state = stateWith(room([player("a", { isHost: true }), player("b")]), "a");
    expect(selfPlayer(state)?.sessionId).toBe("a");
    expect(isHost(state)).toBe(true);
    expect(isHost(stateWith(room([player("a", { isHost: true }), player("b")]), "b"))).toBe(false);
  });

  it("returns null self when session or room is missing", () => {
    expect(selfPlayer(stateWith(null, "a"))).toBeNull();
    expect(selfPlayer(stateWith(room([player("a")]), null))).toBeNull();
  });
});

describe("canStartGame", () => {
  it("requires a lobby with at least two connected players", () => {
    expect(canStartGame(stateWith(room([player("a")]), "a"))).toBe(false);
    expect(canStartGame(stateWith(room([player("a"), player("b")]), "a"))).toBe(true);
  });

  it("is false once the room is playing", () => {
    const playing = room([player("a"), player("b")], { status: "playing" });
    expect(canStartGame(stateWith(playing, "a"))).toBe(false);
  });

  it("ignores disconnected players toward the minimum", () => {
    const state = stateWith(room([player("a"), player("b", { connected: false })]), "a");
    expect(canStartGame(state)).toBe(false);
  });
});
