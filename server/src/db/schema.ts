import type { Generated } from "kysely";

/**
 * Kysely table definitions for the SQLite database. The game is anonymous but
 * persistent: rooms, games, turns, results, per-game players, and the seeded
 * word list all live here. A round is a full rotation of turns; each turn row
 * records the round (rotation) it belonged to. JSON payloads (`settings`,
 * `drawing`) are stored as TEXT and (de)serialised at the query boundary.
 * Timestamps are epoch millis.
 */

export interface RoomsTable {
  id: string;
  invite_code: string;
  settings: string;
  status: string;
  created_at: number;
}

export interface GamesTable {
  id: string;
  room_id: string;
  started_at: number;
  ended_at: number | null;
  round_count: number;
}

export interface TurnsTable {
  id: string;
  game_id: string;
  /** Round (full rotation) this turn belonged to (1-based). */
  round_ordinal: number;
  drawer_nickname: string;
  word: string;
  /** Replayable stroke list, JSON-encoded. Null until the turn is drawn. */
  drawing: string | null;
  /** Global turn index (1-based). */
  ordinal: number;
}

export interface TurnResultsTable {
  id: Generated<number>;
  turn_id: string;
  nickname: string;
  guessed_at: number | null;
  points: number;
}

export interface PlayersTable {
  id: Generated<number>;
  game_id: string;
  session_id: string;
  nickname: string;
  total_score: number;
}

export interface WordsTable {
  id: Generated<number>;
  word: string;
  category: string;
  difficulty: string;
}

export interface Database {
  rooms: RoomsTable;
  games: GamesTable;
  turns: TurnsTable;
  turn_results: TurnResultsTable;
  players: PlayersTable;
  words: WordsTable;
}
