import type { RoomSettings } from "@gts/shared";

export type { RoomSettings };

export const DEFAULT_SETTINGS: RoomSettings = {
  rounds: 3,
  drawTimeSec: 80,
  maxPlayers: 8,
};

const LIMITS = {
  rounds: { min: 1, max: 10 },
  drawTimeSec: { min: 30, max: 180 },
  maxPlayers: { min: 2, max: 12 },
} as const;

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === "number" ? Math.floor(value) : NaN;
  if (Number.isNaN(n)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, n));
}

/**
 * Normalise partial/untrusted settings into a valid RoomSettings, clamping each
 * field to its allowed range and filling gaps with defaults.
 */
export function normalizeSettings(input: Partial<RoomSettings> | undefined): RoomSettings {
  return {
    rounds: clampInt(input?.rounds, DEFAULT_SETTINGS.rounds, LIMITS.rounds.min, LIMITS.rounds.max),
    drawTimeSec: clampInt(input?.drawTimeSec, DEFAULT_SETTINGS.drawTimeSec, LIMITS.drawTimeSec.min, LIMITS.drawTimeSec.max),
    maxPlayers: clampInt(input?.maxPlayers, DEFAULT_SETTINGS.maxPlayers, LIMITS.maxPlayers.min, LIMITS.maxPlayers.max),
  };
}
