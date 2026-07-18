import { makeId, makeInviteCode } from "./ids.js";
import { Room } from "./room.js";
import { normalizeSettings, type RoomSettings } from "./settings.js";

/**
 * In-memory index of active rooms, keyed by invite code. This is the source of
 * truth for live game state; the database is the durable record.
 */
export class RoomRegistry {
  private readonly byCode = new Map<string, Room>();

  create(settings?: Partial<RoomSettings>): Room {
    const room = new Room({
      id: makeId(),
      inviteCode: this.uniqueCode(),
      settings: normalizeSettings(settings),
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
