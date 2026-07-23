import type { RoomSettings } from "@gts/shared";

/**
 * Default room settings shown on the create-room form. Mirrors the server's
 * defaults (server/src/game/settings.ts); the server re-clamps whatever is sent,
 * so these are only a starting point for the host to adjust.
 */
export const DEFAULT_SETTINGS: RoomSettings = {
  rounds: 3,
  drawTimeSec: 80,
  maxPlayers: 8,
};
