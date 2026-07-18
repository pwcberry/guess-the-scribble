import type { GameEventSink } from "./events.js";
import { makeId, makeInviteCode } from "./ids.js";
import { Room } from "./room.js";
import { type Scheduler, systemScheduler } from "./scheduler.js";
import { normalizeSettings, type RoomSettings } from "./settings.js";
import type { WordPool } from "./words.js";

export interface RegistryDeps {
  words: WordPool;
  scheduler?: Scheduler;
  events?: GameEventSink;
}

/**
 * In-memory index of active rooms, keyed by invite code. Holds the engine
 * dependencies (word pool, clock, persistence sink) and injects them into each
 * Room it creates.
 */
export class RoomRegistry {
  private readonly deps: RegistryDeps;
  private readonly byCode = new Map<string, Room>();

  constructor(deps: RegistryDeps) {
    this.deps = deps;
  }

  create(settings?: Partial<RoomSettings>): Room {
    const room = new Room({
      id: makeId(),
      inviteCode: this.uniqueCode(),
      settings: normalizeSettings(settings),
      words: this.deps.words,
      scheduler: this.deps.scheduler ?? systemScheduler,
      events: this.deps.events,
    });
    this.byCode.set(room.inviteCode, room);
    return room;
  }

  get(inviteCode: string): Room | undefined {
    return this.byCode.get(inviteCode.toUpperCase());
  }

  delete(inviteCode: string): void {
    this.byCode.delete(inviteCode.toUpperCase());
  }

  get size(): number {
    return this.byCode.size;
  }

  private uniqueCode(): string {
    let code = makeInviteCode();
    while (this.byCode.has(code)) {
      code = makeInviteCode();
    }
    return code;
  }
}
