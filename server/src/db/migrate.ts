import { connectionUrl, createDb } from "./connection.js";
import { resetDb, runMigrations } from "./setup.js";
import { seedWords } from "./seed.js";

/**
 * CLI migration runner.
 * `npm run db:migrate` brings the database to the latest schema and seeds
 * words. `npm run db:reset` rolls back all migrations first for a clean slate.
 * Reads DATABASE_URL from the environment (see .env.example).
 */

const doReset = process.argv.includes("--reset");
const url = connectionUrl();
const db = createDb(url);

try {
  if (doReset) {
    await resetDb(db);
    console.log("database reset");
  }
  const results = await runMigrations(db);
  for (const r of results) {
    console.log(`migrated ${r.migrationName} (${r.status})`);
  }
  const seeded = await seedWords(db);
  console.log(seeded > 0 ? `seeded ${seeded} words` : "words already seeded");
  console.log(`database ready at ${url}`);
}
finally {
  await db.destroy();
}
