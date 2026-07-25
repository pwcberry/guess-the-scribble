import type { RoundPublic } from "@gts/shared";
import { describe, expect, it } from "vitest";
import { initialState, type GameState } from "../src/state/store.ts";
import {
  canDraw,
  clamp01,
  currentDrawerId,
  drawerNickname,
  isDrawingPhase,
  isLocalDrawer,
  normalizePoint,
  roundKey,
} from "../src/components/canvas-helpers.ts";

function round(over: Partial<RoundPublic> = {}): RoundPublic {
  return {
    ordinal: 1,
    totalRounds: 3,
    drawerSessionId: "drawer",
    drawerNickname: "Ada",
    wordPattern: "_ _ _",
    wordLength: 3,
    phase: "drawing",
    endsAt: null,
    ...over,
  };
}

function stateWith(sessionId: string | null, r: RoundPublic | null): GameState {
  const room = r === null
    ? null
    : {
        code: "ABC123",
        status: "playing" as const,
        settings: { rounds: 3, drawTimeSec: 80, maxPlayers: 8 },
        players: [],
        round: r,
      };
  return { ...initialState, room, sessionId };
}

describe("clamp01", () => {
  it("clamps to the unit interval", () => {
    expect(clamp01(-0.5)).toBe(0);
    expect(clamp01(0.5)).toBe(0.5);
    expect(clamp01(1.5)).toBe(1);
  });
});

describe("normalizePoint", () => {
  const rect = { left: 100, top: 50, width: 200, height: 100 };

  it("maps client coordinates into 0..1 relative to the rect", () => {
    expect(normalizePoint(150, 75, rect)).toEqual([0.25, 0.25]);
    expect(normalizePoint(300, 150, rect)).toEqual([1, 1]);
  });

  it("clamps points outside the rect to the edges", () => {
    expect(normalizePoint(0, 0, rect)).toEqual([0, 0]);
    expect(normalizePoint(500, 500, rect)).toEqual([1, 1]);
  });

  it("maps to the origin for a zero-sized rect", () => {
    expect(normalizePoint(10, 10, { left: 0, top: 0, width: 0, height: 0 })).toEqual([0, 0]);
  });
});

describe("round/drawer derivations", () => {
  it("reports the drawer and whether it is the local client", () => {
    const asDrawer = stateWith("drawer", round());
    expect(currentDrawerId(asDrawer)).toBe("drawer");
    expect(isLocalDrawer(asDrawer)).toBe(true);
    expect(isLocalDrawer(stateWith("guesser", round()))).toBe(false);
    expect(drawerNickname(asDrawer)).toBe("Ada");
  });

  it("has no drawer when there is no round", () => {
    const idle = stateWith("me", null);
    expect(currentDrawerId(idle)).toBeNull();
    expect(isLocalDrawer(idle)).toBe(false);
    expect(drawerNickname(idle)).toBeNull();
    expect(roundKey(idle)).toBeNull();
  });

  it("only allows drawing for the drawer during the drawing phase", () => {
    expect(canDraw(stateWith("drawer", round({ phase: "drawing" })))).toBe(true);
    expect(canDraw(stateWith("drawer", round({ phase: "choosing" })))).toBe(false);
    expect(isDrawingPhase(stateWith("drawer", round({ phase: "intermission" })))).toBe(false);
    expect(canDraw(stateWith("guesser", round({ phase: "drawing" })))).toBe(false);
  });

  it("keys the canvas by round ordinal", () => {
    expect(roundKey(stateWith("me", round({ ordinal: 4 })))).toBe(4);
  });
});
