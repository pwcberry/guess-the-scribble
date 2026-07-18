/**
 * Wire protocol shared by the Guess the Scribble client and server.
 *
 * Single source of truth for everything exchanged over the WebSocket. The
 * server is authoritative: guessers never receive the secret word, only its
 * pattern (blanks). Both `@gts/client` and `@gts/server` import from here.
 */

/** WebSocket endpoint path the client connects to. */
export const WS_PATH = "/ws";

/** A single drawn stroke segment. Points are normalised to 0..1 (resolution-independent). */
export interface Stroke {
  points: [number, number][];
  color: string;
  width: number;
}

export interface RoomSettings {
  /** Number of rounds in a game. */
  rounds: number;
  /** Seconds a drawer has to draw before the round auto-ends. */
  drawTimeSec: number;
  /** Maximum players allowed in the room. */
  maxPlayers: number;
}

export type RoomStatus = "lobby" | "playing" | "ended";
export type RoundPhase = "choosing" | "drawing" | "intermission";

/** Public per-player state safe to send to everyone. */
export interface PlayerView {
  sessionId: string;
  nickname: string;
  score: number;
  connected: boolean;
  isHost: boolean;
  isDrawer: boolean;
  hasGuessed: boolean;
}

/** Public round state — note: never includes the secret word, only its pattern. */
export interface RoundPublic {
  ordinal: number;
  totalRounds: number;
  drawerSessionId: string;
  drawerNickname: string;
  /** Masked word, e.g. "_ _ _" for "cat"; real spaces are shown. */
  wordPattern: string;
  wordLength: number;
  phase: RoundPhase;
  /** Epoch ms when the drawing phase ends; null outside the drawing phase. */
  endsAt: number | null;
}

export interface RoomView {
  code: string;
  status: RoomStatus;
  settings: RoomSettings;
  players: PlayerView[];
  round: RoundPublic | null;
}

export interface Score {
  sessionId: string;
  nickname: string;
  score: number;
}

export interface RoundResult {
  sessionId: string;
  nickname: string;
  guessed: boolean;
  /** Points earned this round. */
  points: number;
}

export type ChatKind = "chat" | "correct" | "close" | "system";

export type ErrorCode
  = | "room_not_found"
    | "nickname_taken"
    | "room_full"
    | "invalid_message"
    | "not_allowed"
    | "bad_request";

/** Messages sent from a client to the server. */
export type ClientMessage
  = | { type: "join"; roomCode: string; nickname: string; sessionId?: string }
    | { type: "startGame" }
    | { type: "chooseWord"; word: string }
    | { type: "draw"; stroke: Stroke }
    | { type: "clearCanvas" }
    | { type: "undo" }
    | { type: "guess"; text: string }
    | { type: "leave" };

/** Messages sent from the server to clients. */
export type ServerMessage
  = | { type: "joined"; sessionId: string; room: RoomView }
    | { type: "roomState"; room: RoomView }
    | { type: "playerJoined"; player: PlayerView }
    | { type: "playerLeft"; sessionId: string }
    | { type: "roundStart"; round: RoundPublic }
    | { type: "wordChoices"; words: string[] }
    | { type: "drawBroadcast"; stroke: Stroke }
    | { type: "clearCanvas" }
    | { type: "guessResult"; correct: boolean }
    | { type: "chat"; nickname: string; text: string; kind: ChatKind }
    | { type: "correctGuess"; sessionId: string; nickname: string }
    | { type: "roundEnd"; word: string; results: RoundResult[]; scores: Score[] }
    | { type: "gameEnd"; scores: Score[] }
    | { type: "error"; code: ErrorCode; message: string };

/** Union of everything exchanged, either direction. */
export type GameMessage = ClientMessage | ServerMessage;
