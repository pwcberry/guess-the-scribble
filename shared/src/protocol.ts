/**
 * Wire protocol shared by the Guess the Scribble client and server.
 *
 * This is the single source of truth for messages exchanged over the WebSocket
 * connection. Both `@gts/client` and `@gts/server` import from here so the two
 * ends can never drift. Phase 0 seeds it with the original relay messages; the
 * full room/round/scoring protocol is layered on in Phase 1 (task 1f).
 */

/** WebSocket endpoint path the client connects to. */
export const WS_PATH = "/ws";

/** A single drawn stroke segment. Kept opaque until the canvas lands (task 2c). */
export interface Stroke {
  /** Normalised path points [x, y] in 0..1 space, resolution-independent. */
  points: [number, number][];
  color: string;
  width: number;
}

/** Messages sent from a client to the server. */
export type ClientMessage
  = | { type: "draw"; stroke: Stroke }
    | { type: "clear" }
    | { type: "chat"; name: string; text: string };

/** Messages broadcast from the server to clients. */
export type ServerMessage
  = | { type: "draw"; stroke: Stroke }
    | { type: "clear" }
    | { type: "chat"; name: string; text: string };

/** Union of everything currently exchanged, either direction. */
export type GameMessage = ClientMessage | ServerMessage;
