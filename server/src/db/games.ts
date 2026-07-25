import type { Stroke } from "@gts/shared";
import type { PersistedResult, PlayerSnapshot } from "../game/events.js";
import type { Db } from "./connection.js";

export interface NewGame {
  id: string;
  roomId: string;
  startedAt: number;
  roundCount: number;
}

export async function insertGame(db: Db, game: NewGame): Promise<void> {
  await db
    .insertInto("games")
    .values({
      id: game.id,
      room_id: game.roomId,
      started_at: game.startedAt,
      ended_at: null,
      round_count: game.roundCount,
    })
    .execute();
}

export interface SavedTurn {
  gameId: string;
  turnId: string;
  turnOrdinal: number;
  roundOrdinal: number;
  drawerNickname: string;
  word: string;
  drawing: Stroke[];
  results: PersistedResult[];
}

export async function saveTurn(db: Db, turn: SavedTurn): Promise<void> {
  await db
    .insertInto("turns")
    .values({
      id: turn.turnId,
      game_id: turn.gameId,
      round_ordinal: turn.roundOrdinal,
      drawer_nickname: turn.drawerNickname,
      word: turn.word,
      drawing: JSON.stringify(turn.drawing),
      ordinal: turn.turnOrdinal,
    })
    .execute();

  if (turn.results.length > 0) {
    await db
      .insertInto("turn_results")
      .values(turn.results.map(r => ({
        turn_id: turn.turnId,
        nickname: r.nickname,
        guessed_at: r.guessedAt,
        points: r.points,
      })))
      .execute();
  }
}

export interface EndedGame {
  gameId: string;
  endedAt: number;
  players: PlayerSnapshot[];
}

export async function endGame(db: Db, game: EndedGame): Promise<void> {
  await db
    .updateTable("games")
    .set({ ended_at: game.endedAt })
    .where("id", "=", game.gameId)
    .execute();

  for (const p of game.players) {
    await db
      .insertInto("players")
      .values({
        game_id: game.gameId,
        session_id: p.sessionId,
        nickname: p.nickname,
        total_score: p.score,
      })
      .onConflict(oc => oc
        .columns(["game_id", "session_id"])
        .doUpdateSet({ nickname: p.nickname, total_score: p.score }))
      .execute();
  }
}
