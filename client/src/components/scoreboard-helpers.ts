/** An item carrying a score, plus its assigned standing. */
export type Ranked<T> = T & { rank: number };

/**
 * Sort by score, highest first, and assign standard competition ranks: ties
 * share a rank and the next distinct score skips accordingly (100, 100, 90 →
 * ranks 1, 1, 3). Input is not mutated.
 */
export function rankByScore<T extends { score: number }>(items: readonly T[]): Ranked<T>[] {
  const sorted = [...items].sort((a, b) => b.score - a.score);
  let rank = 0;
  let prevScore: number | null = null;
  return sorted.map((item, index) => {
    if (prevScore === null || item.score !== prevScore) {
      rank = index + 1;
      prevScore = item.score;
    }
    return { ...item, rank };
  });
}
