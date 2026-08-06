import { sql } from "kysely";
import type { ServerMessage } from "@gts/shared";
import type { Db } from "../src/db/connection.js";
import type { Connection } from "../src/game/connection.js";
import type { Room } from "../src/game/room.js";
import type { Cancel, Scheduler } from "../src/game/scheduler.js";

/**
 * Truncate all game tables and restart their identity sequences. Call this in
 * beforeEach for tests that use a shared PostgreSQL database so each test
 * starts with a clean slate without reconnecting.
 */
export async function truncateAll(db: Db): Promise<void> {
  await sql`TRUNCATE TABLE rooms, games, turns, turn_results, players, words RESTART IDENTITY CASCADE`.execute(db);
}

/** Records everything the server sends to one player. */
export class FakeConn implements Connection {
  messages: ServerMessage[] = [];
  closed = false;

  send(message: ServerMessage): void {
    this.messages.push(message);
  }

  close(): void {
    this.closed = true;
  }

  ofType<T extends ServerMessage["type"]>(type: T): Extract<ServerMessage, { type: T }>[] {
    return this.messages.filter((m): m is Extract<ServerMessage, { type: T }> => m.type === type);
  }

  last<T extends ServerMessage["type"]>(type: T): Extract<ServerMessage, { type: T }> | undefined {
    const all = this.ofType(type);
    return all[all.length - 1];
  }
}

interface Task {
  at: number;
  cb: () => void;
  live: boolean;
}

/** A manually-advanced clock + timer queue for deterministic engine tests. */
export class FakeScheduler implements Scheduler {
  private t = 0;
  private tasks: Task[] = [];

  now(): number {
    return this.t;
  }

  schedule(ms: number, cb: () => void): Cancel {
    const task: Task = { at: this.t + ms, cb, live: true };
    this.tasks.push(task);
    return () => {
      task.live = false;
    };
  }

  /** Advance time by `ms`, firing due timers in order (new ones included). */
  advance(ms: number): void {
    const target = this.t + ms;
    for (;;) {
      const due = this.tasks
        .filter(x => x.live && x.at <= target)
        .sort((a, b) => a.at - b.at)[0];
      if (!due) {
        break;
      }
      due.live = false;
      this.t = due.at;
      due.cb();
    }
    this.t = target;
  }
}

/** Join a room with a fresh connection; returns the connection + sessionId. */
export function joinRoom(room: Room, nickname: string): { conn: FakeConn; sessionId: string } {
  const conn = new FakeConn();
  const result = room.join({ nickname, conn });
  if (!result.ok) {
    throw new Error(`join failed: ${result.code}`);
  }
  return { conn, sessionId: result.player.sessionId };
}
