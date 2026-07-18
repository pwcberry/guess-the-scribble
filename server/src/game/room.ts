import type { RoomSettings } from "./settings.js";

export type RoomStatus = "lobby" | "playing" | "ended";

/**
 * Authoritative in-memory state for a single room. Phase 1a holds identity and
 * settings; players, the current round, and the game loop are layered on in
 * later Phase 1 tasks.
 */
export class Room {
  readonly id: string;
  readonly inviteCode: string;
  readonly settings: RoomSettings;
  readonly createdAt: number;
  status: RoomStatus = "lobby";

  constructor(params: {
    id: string;
    inviteCode: string;
    settings: RoomSettings;
    createdAt?: number;
  }) {
    this.id = params.id;
    this.inviteCode = params.inviteCode;
    this.settings = params.settings;
    this.createdAt = params.createdAt ?? Date.now();
  }
}
