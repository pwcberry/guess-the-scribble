import type { Score, Stroke } from "@gts/shared";

export interface PersistedResult {
  sessionId: string;
  nickname: string;
  guessed: boolean;
  guessedAt: number | null;
  points: number;
}

/** Snapshot of a finished turn, enough to persist it durably. */
export interface TurnEndedData {
  gameId: string;
  turnId: string;
  /** Global turn index (1-based). */
  turnOrdinal: number;
  /** Round (full rotation) this turn belonged to (1-based). */
  roundOrdinal: number;
  drawerNickname: string;
  word: string;
  drawing: Stroke[];
  results: PersistedResult[];
}

export interface PlayerSnapshot {
  sessionId: string;
  nickname: string;
  score: number;
}

/**
 * Domain events emitted by the game engine at lifecycle points. The engine stays
 * synchronous and I/O-free; a listener (wired in Phase 1e) performs the durable
 * writes so persistence never blocks the game loop.
 */
export type GameEvent
  = | { type: "gameStarted"; gameId: string; roomId: string; startedAt: number; roundCount: number }
    | { type: "turnEnded"; data: TurnEndedData }
    | { type: "gameEnded"; gameId: string; endedAt: number; scores: Score[]; players: PlayerSnapshot[] };

export type GameEventSink = (event: GameEvent) => void;
