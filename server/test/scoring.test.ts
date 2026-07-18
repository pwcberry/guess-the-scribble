import { describe, expect, it } from "vitest";
import { drawerPoints, guesserPoints } from "../src/game/scoring.js";

describe("scoring", () => {
  it("guesserPoints decays from 100 to 50 as time runs out", () => {
    expect(guesserPoints(60_000, 60_000)).toBe(100);
    expect(guesserPoints(30_000, 60_000)).toBe(75);
    expect(guesserPoints(0, 60_000)).toBe(50);
  });

  it("guesserPoints clamps and guards divide-by-zero", () => {
    expect(guesserPoints(999, 0)).toBe(50);
    expect(guesserPoints(120_000, 60_000)).toBe(100);
    expect(guesserPoints(-5, 60_000)).toBe(50);
  });

  it("drawerPoints scales with the fraction who guessed", () => {
    expect(drawerPoints(2, 2)).toBe(50);
    expect(drawerPoints(1, 2)).toBe(25);
    expect(drawerPoints(0, 2)).toBe(0);
    expect(drawerPoints(1, 0)).toBe(0);
  });
});
