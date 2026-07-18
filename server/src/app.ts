import { existsSync } from "node:fs";
import fastifyStatic from "@fastify/static";
import websocket from "@fastify/websocket";
import Fastify, { type FastifyInstance } from "fastify";
import type { Db } from "./db/connection.js";
import { createGameEventSink } from "./db/persistence.js";
import { RoomRegistry } from "./game/registry.js";
import { WordPool } from "./game/words.js";
import { registerRoomRoutes } from "./routes/rooms.js";
import { registerGameSocket } from "./ws/handlers.js";

export interface AppDeps {
  db: Db;
  /** Directory of the built client to serve; null/absent to skip (dev/tests). */
  clientDist?: string | null;
  logger?: boolean;
}

/**
 * Build the Fastify application with all routes and the WebSocket layer wired
 * up. Kept dependency-injected (db, client dir) so integration tests can run it
 * against an in-memory database with no static assets.
 */
export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const app = Fastify({ logger: deps.logger ?? false });

  const wordRows = await deps.db.selectFrom("words").select("word").execute();
  const events = createGameEventSink(deps.db, (event, err) =>
    app.log.error({ err, event: event.type }, "persistence failed"));
  const registry = new RoomRegistry({
    words: new WordPool(wordRows.map(r => r.word)),
    events,
  });

  await app.register(websocket);
  await registerGameSocket(app, { registry });
  await registerRoomRoutes(app, { registry, db: deps.db });

  const { clientDist } = deps;
  if (clientDist && existsSync(clientDist)) {
    await app.register(fastifyStatic, { root: clientDist, wildcard: false });

    // SPA fallback: unknown non-API, non-WS GET routes get the client shell.
    app.setNotFoundHandler((request, reply) => {
      const url = request.raw.url ?? "/";
      if (request.method === "GET" && !url.startsWith("/api") && !url.startsWith("/ws")) {
        return reply.sendFile("index.html");
      }
      return reply.code(404).type("text/plain").send("Not found");
    });
  }

  return app;
}
