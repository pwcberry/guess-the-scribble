import type { TurnPublic } from "@gts/shared";
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
  turnKey,
} from "../src/components/canvas-helpers.ts";

function turn(over: Partial<TurnPublic> = {}): TurnPublic {
  return {
    turnOrdinal: 1,
    roundOrdinal: 1,
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

function stateWith(sessionId: string | null, r: TurnPublic | null): GameState {
  const room = r === null
    ? null
    : {
        code: "ABC123",
        status: "playing" as const,
        settings: { rounds: 3, drawTimeSec: 80, maxPlayers: 8 },
        players: [],
        turn: r,
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

describe("turn/drawer derivations", () => {
  it("reports the drawer and whether it is the local client", () => {
    const asDrawer = stateWith("drawer", turn());
    expect(currentDrawerId(asDrawer)).toBe("drawer");
    expect(isLocalDrawer(asDrawer)).toBe(true);
    expect(isLocalDrawer(stateWith("guesser", turn()))).toBe(false);
    expect(drawerNickname(asDrawer)).toBe("Ada");
  });

  it("has no drawer when there is no turn", () => {
    const idle = stateWith("me", null);
    expect(currentDrawerId(idle)).toBeNull();
    expect(isLocalDrawer(idle)).toBe(false);
    expect(drawerNickname(idle)).toBeNull();
    expect(turnKey(idle)).toBeNull();
  });

  it("only allows drawing for the drawer during the drawing phase", () => {
    expect(canDraw(stateWith("drawer", turn({ phase: "drawing" })))).toBe(true);
    expect(canDraw(stateWith("drawer", turn({ phase: "choosing" })))).toBe(false);
    expect(isDrawingPhase(stateWith("drawer", turn({ phase: "intermission" })))).toBe(false);
    expect(canDraw(stateWith("guesser", turn({ phase: "drawing" })))).toBe(false);
  });

  it("keys the canvas by turn ordinal", () => {
    expect(turnKey(stateWith("me", turn({ turnOrdinal: 4 })))).toBe(4);
  });
});
