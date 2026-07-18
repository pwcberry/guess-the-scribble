import type { FastifyInstance } from "fastify";
import type { Db } from "../db/connection.js";
import { insertRoom } from "../db/rooms.js";
import type { RoomRegistry } from "../game/registry.js";
import type { RoomSettings } from "../game/settings.js";

interface RoomRoutesDeps {
  registry: RoomRegistry;
  db: Db;
}

interface CreateRoomBody {
  settings?: Partial<RoomSettings>;
}

/**
 * HTTP routes for room lifecycle. `POST /api/rooms` creates a room (settings are
 * clamped to valid ranges), records it in the database, and returns the
 * shareable invite code. Players then join over the WebSocket connection.
 */
export async function registerRoomRoutes(app: FastifyInstance, deps: RoomRoutesDeps): Promise<void> {
  app.post("/api/rooms", async (request, reply) => {
    const body = (request.body ?? {}) as CreateRoomBody;
    const room = deps.registry.create(body.settings);
    await insertRoom(deps.db, room);

    return reply.code(201).send({
      id: room.id,
      inviteCode: room.inviteCode,
      settings: room.settings,
      status: room.status,
    });
  });
}
