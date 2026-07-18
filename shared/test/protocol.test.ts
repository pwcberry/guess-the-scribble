import { describe, expect, it } from "vitest";
import { WS_PATH, type ClientMessage } from "@gts/shared";

describe("protocol", () => {
  it("exposes the websocket path", () => {
    expect(WS_PATH).toBe("/ws");
  });

  it("models a chat message", () => {
    const msg: ClientMessage = { type: "chat", name: "ada", text: "cat?" };
    expect(msg.type).toBe("chat");
  });
});
