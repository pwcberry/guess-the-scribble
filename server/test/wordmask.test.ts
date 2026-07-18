import { describe, expect, it } from "vitest";
import { isCloseGuess, isCorrectGuess, letterCount, maskWord } from "../src/game/wordmask.js";

describe("wordmask", () => {
  it("masks letters but keeps spacing", () => {
    expect(maskWord("cat")).toBe("_ _ _");
    expect(maskWord("ice cream")).toBe("_ _ _   _ _ _ _ _");
    expect(letterCount("ice cream")).toBe(8);
  });

  it("matches guesses case- and space-insensitively", () => {
    expect(isCorrectGuess("  CAT ", "cat")).toBe(true);
    expect(isCorrectGuess("ice  cream", "Ice Cream")).toBe(true);
    expect(isCorrectGuess("dog", "cat")).toBe(false);
  });

  it("detects a near-miss (one edit away)", () => {
    expect(isCloseGuess("cot", "cat")).toBe(true);
    expect(isCloseGuess("cats", "cat")).toBe(true);
    expect(isCloseGuess("cat", "cat")).toBe(false);
    expect(isCloseGuess("banana", "cat")).toBe(false);
  });
});
