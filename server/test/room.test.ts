import type { ServerMessage } from "@gts/shared";
import { beforeEach, describe, expect, it } from "vitest";
import type { Connection } from "../src/game/connection.js";
import { RoomRegistry } from "../src/game/registry.js";
import type { Room } from "../src/game/room.js";

class FakeConn implements Connection {
  messages: ServerMessage[] = [];
  closed = false;
  send(message: ServerMessage): void {
    this.messages.push(message);
  }

  close(): void {
    this.closed = true;
  }

  last(): ServerMessage {
    return this.messages[this.messages.length - 1]!;
  }

  ofType<T extends ServerMessage["type"]>(type: T): Extract<ServerMessage, { type: T }>[] {
    return this.messages.filter((m): m is Extract<ServerMessage, { type: T }> => m.type === type);
  }
}

function join(room: Room, nickname: string, sessionId?: string) {
  const conn = new FakeConn();
  const result = room.join({ nickname, conn, sessionId });
  return { conn, result };
}

describe("Room membership", () => {
  let registry: RoomRegistry;
  let room: Room;

  beforeEach(() => {
    registry = new RoomRegistry();
    room = registry.create({ maxPlayers: 2 });
  });

  it("makes the first joiner the host and echoes joined", () => {
    const { conn, result } = join(room, "ada");
    expect(result.ok).toBe(true);

    const joined = conn.ofType("joined")[0]!;
    expect(joined.sessionId).toBe(room.hostSessionId);
    expect(joined.room.players).toHaveLength(1);
    expect(joined.room.players[0]!.isHost).toBe(true);
  });

  it("notifies existing players when someone joins", () => {
    const a = join(room, "ada");
    const b = join(room, "bob");
    expect(b.result.ok).toBe(true);
    expect(a.conn.ofType("playerJoined")).toHaveLength(1);
    expect(a.conn.ofType("playerJoined")[0]!.player.nickname).toBe("bob");
  });

  it("rejects a duplicate nickname", () => {
    join(room, "ada");
    const { result } = join(room, "ADA");
    expect(result).toMatchObject({ ok: false, code: "nickname_taken" });
  });

  it("rejects joining a full room", () => {
    join(room, "ada");
    join(room, "bob");
    const { result } = join(room, "cy");
    expect(result).toMatchObject({ ok: false, code: "room_full" });
  });

  it("rejects an empty nickname", () => {
    const { result } = join(room, "   ");
    expect(result).toMatchObject({ ok: false, code: "bad_request" });
  });

  it("reconnects a dropped player, preserving their score and seat", () => {
    const a = join(room, "ada");
    const sessionId = (a.result as { player: { sessionId: string } }).player.sessionId;
    room.getPlayer(sessionId)!.score = 5;

    room.markDisconnected(sessionId);
    expect(room.getPlayer(sessionId)!.connected).toBe(false);

    const conn2 = new FakeConn();
    const result = room.join({ nickname: "ada", conn: conn2, sessionId });
    expect(result).toMatchObject({ ok: true, reconnected: true });

    const joined = conn2.ofType("joined")[0]!;
    expect(joined.room.players.find(p => p.sessionId === sessionId)!.score).toBe(5);
    expect(room.getPlayer(sessionId)!.connected).toBe(true);
    expect(room.playerList).toHaveLength(1);
  });

  it("reassigns the host when the host leaves", () => {
    const a = join(room, "ada");
    join(room, "bob");
    const hostId = (a.result as { player: { sessionId: string } }).player.sessionId;

    room.leave(hostId);
    expect(room.hostSessionId).not.toBe(hostId);
    expect(room.playerList).toHaveLength(1);
  });

  it("broadcasts draw strokes to everyone but the sender", () => {
    const a = join(room, "ada");
    const b = join(room, "bob");
    const senderId = (a.result as { player: { sessionId: string } }).player.sessionId;

    room.handleMessage(senderId, { type: "draw", stroke: { points: [[0, 0], [1, 1]], color: "#000", width: 2 } });
    expect(a.conn.ofType("drawBroadcast")).toHaveLength(0);
    expect(b.conn.ofType("drawBroadcast")).toHaveLength(1);
  });
});
