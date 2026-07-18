import type { Generated } from "kysely";

/**
 * Kysely table definitions for the SQLite database. The game is anonymous but
 * persistent: rooms, games, rounds, results, per-game players, and the seeded
 * word list all live here. JSON payloads (`settings`, `drawing`) are stored as
 * TEXT and (de)serialised at the query boundary. Timestamps are epoch millis.
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

export interface RoundsTable {
  id: string;
  game_id: string;
  drawer_nickname: string;
  word: string;
  /** Replayable stroke list, JSON-encoded. Null until the round is drawn. */
  drawing: string | null;
  ordinal: number;
}

export interface RoundResultsTable {
  id: Generated<number>;
  round_id: string;
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
  rounds: RoundsTable;
  round_results: RoundResultsTable;
  players: PlayersTable;
  words: WordsTable;
}
