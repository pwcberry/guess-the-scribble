/**
 * A pool of drawable words. Loaded once from the database at startup (see
 * db/games.ts word loading) and used to offer the drawer a few choices per
 * turn.
 */
export class WordPool {
  private readonly words: string[];

  constructor(words: string[]) {
    this.words = [...new Set(words.map(w => w.trim()).filter(w => w.length > 0))];
  }

  get size(): number {
    return this.words.length;
  }

  /** Pick up to `n` distinct random words. */
  pickChoices(n: number): string[] {
    const pool = [...this.words];
    const chosen: string[] = [];
    for (let i = 0; i < n && pool.length > 0; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      chosen.push(pool.splice(idx, 1)[0]!);
    }
    return chosen;
  }
}
