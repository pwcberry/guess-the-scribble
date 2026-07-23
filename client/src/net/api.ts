import type { RoomSettings, RoomStatus } from "@gts/shared";

/** Shape returned by `POST /api/rooms` (see server/src/routes/rooms.ts). */
export interface CreateRoomResponse {
  id: string;
  inviteCode: string;
  settings: RoomSettings;
  status: RoomStatus;
}

/**
 * Create a room on the server. Settings are optional; the server clamps them to
 * valid ranges and fills any gaps with defaults. Returns the shareable invite
 * code the caller then joins over the WebSocket.
 */
export async function createRoom(settings?: Partial<RoomSettings>): Promise<CreateRoomResponse> {
  const response = await fetch("/api/rooms", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ settings }),
  });
  if (!response.ok) {
    throw new Error(`Could not create room (${response.status})`);
  }
  return response.json() as Promise<CreateRoomResponse>;
}
