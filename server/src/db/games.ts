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

export interface SavedRound {
  gameId: string;
  roundId: string;
  ordinal: number;
  drawerNickname: string;
  word: string;
  drawing: Stroke[];
  results: PersistedResult[];
}

export async function saveRound(db: Db, round: SavedRound): Promise<void> {
  await db
    .insertInto("rounds")
    .values({
      id: round.roundId,
      game_id: round.gameId,
      drawer_nickname: round.drawerNickname,
      word: round.word,
      drawing: JSON.stringify(round.drawing),
      ordinal: round.ordinal,
    })
    .execute();

  if (round.results.length > 0) {
    await db
      .insertInto("round_results")
      .values(round.results.map(r => ({
        round_id: round.roundId,
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
