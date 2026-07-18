import type { ServerMessage } from "@gts/shared";

/**
 * A player's outbound channel, abstracted away from the transport. The WebSocket
 * layer provides a real implementation; tests provide a fake that records
 * messages. This keeps the game engine free of any `ws`/Fastify dependency.
 */
export interface Connection {
  send: (message: ServerMessage) => void;
  close: () => void;
}
