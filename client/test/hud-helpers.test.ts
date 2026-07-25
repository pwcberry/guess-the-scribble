import { describe, expect, it } from "vitest";
import { remainingMs, remainingSeconds, timerFraction } from "../src/components/hud-helpers.ts";

describe("remainingMs", () => {
  it("is the gap to the deadline, floored at zero", () => {
    expect(remainingMs(1000, 400)).toBe(600);
    expect(remainingMs(1000, 1000)).toBe(0);
    expect(remainingMs(1000, 1500)).toBe(0);
  });

  it("is zero when there is no active deadline", () => {
    expect(remainingMs(null, 500)).toBe(0);
  });
});

describe("remainingSeconds", () => {
  it("rounds up so the clock only reads 0 at the deadline", () => {
    expect(remainingSeconds(5000, 0)).toBe(5);
    expect(remainingSeconds(5000, 100)).toBe(5);
    expect(remainingSeconds(5000, 4001)).toBe(1);
    expect(remainingSeconds(5000, 5000)).toBe(0);
  });
});

describe("timerFraction", () => {
  it("is the remaining share of the window, clamped to 0..1", () => {
    expect(timerFraction(10_000, 0, 10_000)).toBe(1);
    expect(timerFraction(10_000, 5000, 10_000)).toBe(0.5);
    expect(timerFraction(10_000, 10_000, 10_000)).toBe(0);
  });

  it("is zero for a non-positive total", () => {
    expect(timerFraction(10_000, 0, 0)).toBe(0);
  });
});
