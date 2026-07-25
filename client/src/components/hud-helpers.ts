import { clamp01 } from "./canvas-helpers.ts";

/** Milliseconds left on the drawing timer; 0 once past `endsAt` or outside drawing. */
export function remainingMs(endsAt: number | null, now: number): number {
  if (endsAt === null) {
    return 0;
  }
  return Math.max(0, endsAt - now);
}

/** Whole seconds left, rounded up so the clock only hits 0 at the deadline. */
export function remainingSeconds(endsAt: number | null, now: number): number {
  return Math.ceil(remainingMs(endsAt, now) / 1000);
}

/**
 * Fraction of the drawing window still remaining, 0..1, for a progress bar.
 * `totalMs` is the round's full duration (`drawTimeSec * 1000`).
 */
export function timerFraction(endsAt: number | null, now: number, totalMs: number): number {
  if (totalMs <= 0) {
    return 0;
  }
  return clamp01(remainingMs(endsAt, now) / totalMs);
}
