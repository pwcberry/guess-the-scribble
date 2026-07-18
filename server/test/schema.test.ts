import { describe, expect, it } from "vitest";
import { parseClientMessage } from "../src/ws/schema.js";

describe("parseClientMessage", () => {
  it("accepts a valid join", () => {
    const msg = parseClientMessage(JSON.stringify({ type: "join", roomCode: "K7P2QX", nickname: "ada" }));
    expect(msg).toMatchObject({ type: "join", nickname: "ada" });
  });

  it("accepts a valid draw", () => {
    const msg = parseClientMessage(JSON.stringify({
      type: "draw",
      stroke: { points: [[0, 0], [1, 1]], color: "#000", width: 2 },
    }));
    expect(msg?.type).toBe("draw");
  });

  it("rejects malformed JSON", () => {
    expect(parseClientMessage("not json")).toBeNull();
  });

  it("rejects unknown message types", () => {
    expect(parseClientMessage(JSON.stringify({ type: "hack" }))).toBeNull();
  });

  it("rejects a join missing its nickname", () => {
    expect(parseClientMessage(JSON.stringify({ type: "join", roomCode: "K7P2QX" }))).toBeNull();
  });

  it("rejects an over-long guess", () => {
    expect(parseClientMessage(JSON.stringify({ type: "guess", text: "x".repeat(500) }))).toBeNull();
  });

  it("rejects a draw with a malformed stroke", () => {
    expect(parseClientMessage(JSON.stringify({ type: "draw", stroke: { points: "nope" } }))).toBeNull();
  });
});
