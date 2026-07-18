import { mkdir, rm } from "node:fs/promises";
import { dirname } from "node:path";
import { createDb, dbFile } from "./connection.js";
import { runMigrations } from "./setup.js";
import { seedWords } from "./seed.js";

/**
 * CLI migration runner. `npm run db:migrate` brings the database to the latest
 * schema and seeds words; `npm run db:reset` deletes the file first (fresh DB).
 */

const reset = process.argv.includes("--reset");
const file = dbFile();

if (file !== ":memory:") {
  if (reset) {
    await rm(file, { force: true });
    await rm(`${file}-wal`, { force: true });
    await rm(`${file}-shm`, { force: true });
  }
  await mkdir(dirname(file), { recursive: true });
}

const db = createDb(file);
try {
  const results = await runMigrations(db);
  for (const r of results) {
    console.log(`migrated ${r.migrationName} (${r.status})`);
  }
  const seeded = await seedWords(db);
  console.log(seeded > 0 ? `seeded ${seeded} words` : "words already seeded");
  console.log(`database ready at ${file}`);
}
finally {
  await db.destroy();
}
