import type { FastifyInstance } from "fastify";
import type { WebSocket } from "ws";
import { WS_PATH, type ServerMessage } from "@gts/shared";
import type { Connection } from "../game/connection.js";
import type { RoomRegistry } from "../game/registry.js";
import type { Room } from "../game/room.js";
import { parseClientMessage } from "./schema.js";

/** Adapts a raw ws socket to the engine's transport-agnostic Connection. */
class WsConnection implements Connection {
  private readonly socket: WebSocket;

  constructor(socket: WebSocket) {
    this.socket = socket;
  }

  send(message: ServerMessage): void {
    if (this.socket.readyState === this.socket.OPEN) {
      this.socket.send(JSON.stringify(message));
    }
  }

  close(): void {
    this.socket.close();
  }
}

/**
 * WebSocket game endpoint. Each socket first sends a `join`; on success it is
 * bound to a room + session and all further messages are dispatched to the room
 * engine. The engine owns all game state and outbound messages.
 */
export async function registerGameSocket(
  app: FastifyInstance,
  deps: { registry: RoomRegistry },
): Promise<void> {
  app.get(WS_PATH, { websocket: true }, (socket: WebSocket) => {
    const conn = new WsConnection(socket);
    let room: Room | null = null;
    let sessionId: string | null = null;

    socket.on("message", (data: Buffer) => {
      const msg = parseClientMessage(data.toString());
      if (!msg) {
        conn.send({ type: "error", code: "invalid_message", message: "Malformed message." });
        return;
      }

      if (!room || !sessionId) {
        if (msg.type !== "join") {
          conn.send({ type: "error", code: "not_allowed", message: "Join a room first." });
          return;
        }
        const target = deps.registry.get(msg.roomCode);
        if (!target) {
          conn.send({ type: "error", code: "room_not_found", message: "Room not found." });
          return;
        }
        const result = target.join({ nickname: msg.nickname, conn, sessionId: msg.sessionId });
        if (!result.ok) {
          conn.send({ type: "error", code: result.code, message: result.message });
          return;
        }
        room = target;
        sessionId = result.player.sessionId;
        return;
      }

      room.handleMessage(sessionId, msg);

      if (msg.type === "leave") {
        if (room.isEmpty()) {
          deps.registry.delete(room.inviteCode);
        }
        room = null;
        sessionId = null;
      }
    });

    socket.on("close", () => {
      if (room && sessionId) {
        room.markDisconnected(sessionId);
      }
    });
  });
}
