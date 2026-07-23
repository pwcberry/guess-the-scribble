import type { ClientMessage, ServerMessage } from "@gts/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GameClient, type Socket, type SessionStorage } from "../src/net/ws-client.ts";

/** In-memory socket the test drives by hand — no real network. */
class FakeSocket implements Socket {
  sent: string[] = [];
  closed = false;
  private handlers: Record<string, ((event: { data: unknown }) => void)[]> = {};

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.closed = true;
    this.emit("close");
  }

  addEventListener(type: string, listener: (event: { data: unknown }) => void): void {
    (this.handlers[type] ??= []).push(listener);
  }

  emit(type: string, event: { data: unknown } = { data: undefined }): void {
    for (const listener of this.handlers[type] ?? []) listener(event);
  }

  receive(message: ServerMessage): void {
    this.emit("message", { data: JSON.stringify(message) });
  }

  get sentMessages(): ClientMessage[] {
    return this.sent.map(raw => JSON.parse(raw) as ClientMessage);
  }
}

function fakeStorage(initial: string | null = null): SessionStorage {
  let value = initial;
  return {
    get: () => value,
    set: (sessionId) => { value = sessionId; },
  };
}

/** Builds a client whose sockets we can control, returning both. */
function setup(storage: SessionStorage = fakeStorage()) {
  const sockets: FakeSocket[] = [];
  const client = new GameClient({
    url: "ws://test/ws",
    storage,
    backoffMs: [1000, 2000],
    connect: () => {
      const socket = new FakeSocket();
      sockets.push(socket);
      return socket;
    },
  });
  return { client, sockets };
}

describe("GameClient", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("sends join with no sessionId on a first connection", () => {
    const { client, sockets } = setup();
    client.joinRoom({ roomCode: "ABC123", nickname: "Ada" });
    expect(client.connectionStatus).toBe("connecting");

    sockets[0].emit("open");
    expect(client.connectionStatus).toBe("open");
    expect(sockets[0].sentMessages).toEqual([
      { type: "join", roomCode: "ABC123", nickname: "Ada", sessionId: undefined },
    ]);
  });

  it("persists the sessionId from joined and replays it after a reconnect", () => {
    const storage = fakeStorage();
    const { client, sockets } = setup(storage);
    client.joinRoom({ roomCode: "ABC123", nickname: "Ada" });
    sockets[0].emit("open");
    sockets[0].receive({ type: "joined", sessionId: "sess-1", room: null as never });
    expect(storage.get()).toBe("sess-1");

    // Drop the connection; the client should schedule a reconnect.
    sockets[0].emit("close");
    expect(client.connectionStatus).toBe("reconnecting");
    expect(sockets).toHaveLength(1);

    vi.advanceTimersByTime(1000);
    expect(sockets).toHaveLength(2);
    sockets[1].emit("open");
    expect(sockets[1].sentMessages).toEqual([
      { type: "join", roomCode: "ABC123", nickname: "Ada", sessionId: "sess-1" },
    ]);
  });

  it("dispatches inbound messages to subscribers", () => {
    const { client, sockets } = setup();
    const received: ServerMessage[] = [];
    client.onMessage(m => received.push(m));
    client.joinRoom({ roomCode: "ABC123", nickname: "Ada" });
    sockets[0].emit("open");

    const chat: ServerMessage = { type: "chat", nickname: "b", text: "hi", kind: "chat" };
    sockets[0].receive(chat);
    expect(received).toEqual([chat]);
  });

  it("does not reconnect after an intentional disconnect", () => {
    const { client, sockets } = setup();
    client.joinRoom({ roomCode: "ABC123", nickname: "Ada" });
    sockets[0].emit("open");

    client.disconnect();
    expect(sockets[0].closed).toBe(true);
    expect(client.connectionStatus).toBe("closed");

    vi.advanceTimersByTime(10000);
    expect(sockets).toHaveLength(1);
  });

  it("drops outbound messages while not open", () => {
    const { client, sockets } = setup();
    client.joinRoom({ roomCode: "ABC123", nickname: "Ada" });
    // Socket not open yet: guess is silently dropped.
    client.guess("cat");
    expect(sockets[0].sent).toHaveLength(0);

    sockets[0].emit("open");
    client.guess("cat");
    expect(sockets[0].sentMessages.at(-1)).toEqual({ type: "guess", text: "cat" });
  });

  it("backs off with the last delay repeating across attempts", () => {
    const { client, sockets } = setup();
    client.joinRoom({ roomCode: "ABC123", nickname: "Ada" });
    sockets[0].emit("open");

    sockets[0].emit("close");
    vi.advanceTimersByTime(1000); // first backoff
    expect(sockets).toHaveLength(2);

    sockets[1].emit("close");
    vi.advanceTimersByTime(2000); // second backoff
    expect(sockets).toHaveLength(3);

    sockets[2].emit("close");
    vi.advanceTimersByTime(2000); // last delay repeats
    expect(sockets).toHaveLength(4);
  });
});
