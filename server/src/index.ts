import process from "node:process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildApp } from "./app.js";
import { createDb } from "./db/connection.js";
import { seedWords } from "./db/seed.js";
import { runMigrations } from "./db/setup.js";

/**
 * guess-the-scribble server bootstrap.
 *
 * Opens a PostgreSQL connection pool (DATABASE_URL), brings the schema up to
 * date (migrate + seed on boot so a fresh checkout is playable with no extra
 * steps), builds the Fastify app, and starts listening. Rooms/turns/scoring
 * live in the game engine (server/game).
 */

const PORT = Number(process.env.PORT ?? 3000);

// The production layout assembles everything into a top-level `deploy/` folder:
//   deploy/server/index.js  ← this file, after `tsc` + copy
//   deploy/client/          ← Vite bundle
// So the default client bundle is a sibling of the compiled server. `CLIENT_DIST`
// overrides it (e.g. for tests or a non-standard layout). In dev the client is
// served by Vite, so this directory need not exist.
const clientDist
  = process.env.CLIENT_DIST
    ?? fileURLToPath(new URL("../client", import.meta.url));

if (!existsSync(clientDist)) {
  // Warn but do not crash: WS-only integration setups (or tests) may boot the
  // server without a built client on disk.
  console.warn(`[gts] client bundle not found at ${clientDist}; SPA will not be served`);
}

const db = createDb();
await runMigrations(db);
await seedWords(db);

const app = await buildApp({ db, clientDist, logger: true });
await app.listen({ port: PORT, host: "0.0.0.0" });
