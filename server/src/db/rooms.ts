import type { Room } from "../game/room.js";
import type { Db } from "./connection.js";

/** Persist a newly created room. Settings are stored as JSON text. */
export async function insertRoom(db: Db, room: Room): Promise<void> {
  await db
    .insertInto("rooms")
    .values({
      id: room.id,
      invite_code: room.inviteCode,
      settings: JSON.stringify(room.settings),
      status: room.status,
      created_at: room.createdAt,
    })
    .execute();
}
