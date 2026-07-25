import type { PlayerView, RoundPhase, RoundPublic } from "@gts/shared";
import { describe, expect, it } from "vitest";
import { initialState, type GameState } from "../src/state/store.ts";
import { chatInputState } from "../src/components/chat-helpers.ts";

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

function round(phase: RoundPhase, drawerSessionId: string): RoundPublic {
  return {
    ordinal: 1,
    totalRounds: 3,
    drawerSessionId,
    drawerNickname: drawerSessionId,
    wordPattern: "_ _ _",
    wordLength: 3,
    phase,
    endsAt: null,
  };
}

function stateWith(sessionId: string, players: PlayerView[], r: RoundPublic | null): GameState {
  return {
    ...initialState,
    sessionId,
    room: {
      code: "ABC123",
      status: r ? "playing" : "lobby",
      settings: { rounds: 3, drawTimeSec: 80, maxPlayers: 8 },
      players,
      round: r,
    },
  };
}

describe("chatInputState", () => {
  it("lets a guesser type a guess during the drawing phase", () => {
    const state = stateWith("guesser", [player("guesser"), player("drawer")], round("drawing", "drawer"));
    const input = chatInputState(state);
    expect(input.enabled).toBe(true);
    expect(input.placeholder).toMatch(/guess/i);
    expect(input.note).toBeNull();
  });

  it("disables the input for the drawer while drawing", () => {
    const state = stateWith("drawer", [player("drawer"), player("guesser")], round("drawing", "drawer"));
    const input = chatInputState(state);
    expect(input.enabled).toBe(false);
    expect(input.note).toMatch(/drawer/i);
  });

  it("disables the input for a player who already guessed correctly", () => {
    const state = stateWith(
      "guesser",
      [player("guesser", { hasGuessed: true }), player("drawer")],
      round("drawing", "drawer"),
    );
    const input = chatInputState(state);
    expect(input.enabled).toBe(false);
    expect(input.note).toMatch(/guessed/i);
  });

  it("treats messages as chat outside the drawing phase", () => {
    const choosing = stateWith("drawer", [player("drawer"), player("guesser")], round("choosing", "drawer"));
    const input = chatInputState(choosing);
    expect(input.enabled).toBe(true);
    expect(input.placeholder).toMatch(/chat/i);
  });

  it("allows chat when there is no active round", () => {
    const state = stateWith("me", [player("me")], null);
    const input = chatInputState(state);
    expect(input.enabled).toBe(true);
    expect(input.placeholder).toMatch(/chat/i);
  });
});
