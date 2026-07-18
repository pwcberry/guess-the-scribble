import { describe, expect, it } from "vitest";
import { WS_PATH, type ClientMessage, type ServerMessage } from "@gts/shared";

describe("protocol", () => {
  it("exposes the websocket path", () => {
    expect(WS_PATH).toBe("/ws");
  });

  it("models a join message", () => {
    const msg: ClientMessage = { type: "join", roomCode: "K7P2QX", nickname: "ada" };
    expect(msg.type).toBe("join");
  });

  it("models a chat broadcast", () => {
    const msg: ServerMessage = { type: "chat", nickname: "ada", text: "cat?", kind: "chat" };
    expect(msg.kind).toBe("chat");
  });
});
