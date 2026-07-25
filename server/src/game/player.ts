import type { PlayerView, ServerMessage } from "@gts/shared";
import type { Connection } from "./connection.js";

/**
 * A participant in a room. Identity is the anonymous `sessionId` (stored
 * client-side for reconnection); `conn` is null while the player is
 * disconnected but still holds their seat/score.
 */
export class Player {
  readonly sessionId: string;
  nickname: string;
  score = 0;
  connected = true;
  conn: Connection | null;

  /** Reset each turn: has this player guessed the word, and when. */
  hasGuessed = false;
  guessedAt: number | null = null;

  constructor(sessionId: string, nickname: string, conn: Connection | null) {
    this.sessionId = sessionId;
    this.nickname = nickname;
    this.conn = conn;
  }

  send(message: ServerMessage): void {
    this.conn?.send(message);
  }

  view(opts: { isHost: boolean; isDrawer: boolean }): PlayerView {
    return {
      sessionId: this.sessionId,
      nickname: this.nickname,
      score: this.score,
      connected: this.connected,
      isHost: opts.isHost,
      isDrawer: opts.isDrawer,
      hasGuessed: this.hasGuessed,
    };
  }
}
