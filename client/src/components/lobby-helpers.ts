import type { PlayerView } from "@gts/shared";
import type { GameState } from "../state/store.ts";

/** Minimum players needed before the host can start a game. */
export const MIN_PLAYERS = 2;

/** Read the invite code from a URL query string (`?room=ABC123`). */
export function parseRoomCode(search: string): string | null {
  const code = new URLSearchParams(search).get("room");
  const trimmed = code?.trim().toUpperCase();
  return trimmed ? trimmed : null;
}

/** Build the shareable invite link for a room code. */
export function inviteLink(origin: string, code: string): string {
  return `${origin}/?room=${encodeURIComponent(code)}`;
}

/** Count currently-connected players. */
export function connectedCount(players: PlayerView[]): number {
  return players.reduce((n, p) => n + (p.connected ? 1 : 0), 0);
}

/** The local player's view within the current room, if identifiable. */
export function selfPlayer(state: GameState): PlayerView | null {
  if (!state.room || !state.sessionId) {
    return null;
  }
  return state.room.players.find(p => p.sessionId === state.sessionId) ?? null;
}

/** Whether the local player is the room host. */
export function isHost(state: GameState): boolean {
  return selfPlayer(state)?.isHost ?? false;
}

/** Whether the game can be started from the current lobby state. */
export function canStartGame(state: GameState): boolean {
  const room = state.room;
  if (!room || room.status !== "lobby") {
    return false;
  }
  return connectedCount(room.players) >= MIN_PLAYERS;
}
