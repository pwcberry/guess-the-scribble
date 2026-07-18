/** Number of letters (non-space characters) in a word. */
export function letterCount(word: string): number {
  return [...word].filter(ch => ch !== " ").length;
}

/**
 * Masked pattern shown to guessers: each letter becomes "_", spaces are kept as
 * a wider gap. e.g. "ice cream" -> "_ _ _   _ _ _ _ _". Reveals length/shape but
 * never the letters.
 */
export function maskWord(word: string): string {
  return [...word].map(ch => (ch === " " ? " " : "_")).join(" ");
}

/** Normalise a word/guess for comparison: trim, lowercase, collapse spaces. */
export function normalizeGuess(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

/** True when a guess exactly matches the target word (case/space-insensitive). */
export function isCorrectGuess(guess: string, word: string): boolean {
  return normalizeGuess(guess) === normalizeGuess(word);
}
