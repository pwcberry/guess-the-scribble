/**
 * Scoring model (tunable). Guessers earn a base amount plus a time bonus that
 * decays to zero as the round runs out — guessing early is worth more. The
 * drawer earns in proportion to how many players guessed their drawing.
 */

export const GUESS_BASE = 50;
export const GUESS_TIME_BONUS = 50;
export const DRAWER_MAX = 50;

function clampFraction(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/** Points for a correct guess given time left, out of GUESS_BASE + GUESS_TIME_BONUS. */
export function guesserPoints(remainingMs: number, totalMs: number): number {
  if (totalMs <= 0) {
    return GUESS_BASE;
  }
  return Math.round(GUESS_BASE + GUESS_TIME_BONUS * clampFraction(remainingMs / totalMs));
}

/** Points for the drawer given how many of the guessers got it. */
export function drawerPoints(guessCount: number, totalGuessers: number): number {
  if (totalGuessers <= 0) {
    return 0;
  }
  return Math.round(DRAWER_MAX * clampFraction(guessCount / totalGuessers));
}
