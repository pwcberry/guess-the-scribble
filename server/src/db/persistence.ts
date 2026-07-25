import type { GameEvent, GameEventSink } from "../game/events.js";
import type { Db } from "./connection.js";
import { endGame, insertGame, saveTurn } from "./games.js";

export type PersistingSink = GameEventSink & { flush: () => Promise<void> };

async function handle(db: Db, event: GameEvent): Promise<void> {
  switch (event.type) {
    case "gameStarted":
      await insertGame(db, {
        id: event.gameId,
        roomId: event.roomId,
        startedAt: event.startedAt,
        roundCount: event.roundCount,
      });
      break;
    case "turnEnded":
      await saveTurn(db, event.data);
      break;
    case "gameEnded":
      await endGame(db, { gameId: event.gameId, endedAt: event.endedAt, players: event.players });
      break;
  }
}

/**
 * Turn engine lifecycle events into durable writes. The engine emits events
 * synchronously in order; writes are chained on a single promise so they land in
 * that order (a turn can't be written before its game row) without blocking the
 * game loop. `flush()` awaits the outstanding writes — used by tests and shutdown.
 */
export function createGameEventSink(
  db: Db,
  onError: (event: GameEvent, err: unknown) => void = () => {},
): PersistingSink {
  let chain: Promise<void> = Promise.resolve();

  const sink = ((event: GameEvent): void => {
    chain = chain.then(() => handle(db, event)).catch(err => onError(event, err));
  }) as PersistingSink;

  sink.flush = () => chain;
  return sink;
}
