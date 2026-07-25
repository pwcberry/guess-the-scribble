import { describe, expect, it } from "vitest";
import { rankByScore } from "../src/components/scoreboard-helpers.ts";

describe("rankByScore", () => {
  it("sorts by score descending and numbers the standings", () => {
    const ranked = rankByScore([
      { name: "a", score: 30 },
      { name: "b", score: 90 },
      { name: "c", score: 60 },
    ]);
    expect(ranked.map(r => [r.name, r.rank])).toEqual([
      ["b", 1],
      ["c", 2],
      ["a", 3],
    ]);
  });

  it("gives tied scores the same rank and skips the next (1,1,3)", () => {
    const ranked = rankByScore([
      { name: "a", score: 100 },
      { name: "b", score: 90 },
      { name: "c", score: 100 },
    ]);
    expect(ranked.map(r => [r.name, r.rank])).toEqual([
      ["a", 1],
      ["c", 1],
      ["b", 3],
    ]);
  });

  it("does not mutate the input", () => {
    const input = [{ score: 1 }, { score: 2 }];
    rankByScore(input);
    expect(input.map(i => i.score)).toEqual([1, 2]);
  });
});
