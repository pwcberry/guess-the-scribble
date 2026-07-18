import type { FastifyInstance } from "fastify";
import type { WebSocket } from "ws";
import { WS_PATH, type GameMessage } from "@gts/shared";

/**
 * Fastify plugin: the Phase 0 WebSocket relay.
 *
 * Every connected client shares one broadcast channel. A parsed message from
 * one socket is forwarded to all *other* open sockets. Malformed frames are
 * ignored. There is no room/game state yet — that arrives in Phase 1, when this
 * blind relay is replaced by the authoritative game engine.
 */
export async function registerRelay(app: FastifyInstance): Promise<void> {
  app.get(WS_PATH, { websocket: true }, (socket: WebSocket) => {
    socket.on("message", (raw: Buffer) => {
      let message: GameMessage;
      try {
        message = JSON.parse(raw.toString()) as GameMessage;
      }
      catch {
        return; // ignore malformed frames
      }

      const payload = JSON.stringify(message);
      for (const client of app.websocketServer.clients) {
        if (client !== socket && client.readyState === client.OPEN) {
          client.send(payload);
        }
      }
    });
  });
}
