import process from "node:process";
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

// In production `npm start` runs from the repo root and the built client lives
// at client/dist; override with CLIENT_DIST (e.g. in Docker). In development the
// client is served by Vite, so this directory need not exist.
const clientDist
  = process.env.CLIENT_DIST
    ?? fileURLToPath(new URL("../../client/dist", import.meta.url));

const db = createDb();
await runMigrations(db);
await seedWords(db);

const app = await buildApp({ db, clientDist, logger: true });
await app.listen({ port: PORT, host: "0.0.0.0" });
