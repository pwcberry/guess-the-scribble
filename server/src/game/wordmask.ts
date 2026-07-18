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

/** Levenshtein edit distance between two strings. */
export function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array<number>(n + 1);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j]! + 1, curr[j - 1]! + 1, prev[j - 1]! + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n]!;
}

/** True when a guess is one edit away from the word (but not exactly right). */
export function isCloseGuess(guess: string, word: string): boolean {
  const g = normalizeGuess(guess);
  const w = normalizeGuess(word);
  if (g === w || Math.abs(g.length - w.length) > 1) {
    return false;
  }
  return editDistance(g, w) === 1;
}
