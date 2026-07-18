import type { Db } from "./connection.js";
import { WORDS } from "../words/wordlist.js";

/**
 * Seed the built-in word list. Idempotent: does nothing if words already exist,
 * so it is safe to run on every migrate.
 */
export async function seedWords(db: Db): Promise<number> {
  const existing = await db
    .selectFrom("words")
    .select(db.fn.countAll<number>().as("count"))
    .executeTakeFirst();

  if (Number(existing?.count ?? 0) > 0) {
    return 0;
  }

  await db
    .insertInto("words")
    .values(WORDS.map(w => ({ word: w.word, category: w.category, difficulty: w.difficulty })))
    .execute();

  return WORDS.length;
}
