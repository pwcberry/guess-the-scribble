import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import websocket from "@fastify/websocket";
import fastifyStatic from "@fastify/static";
import { registerRelay } from "./ws/relay.js";

/**
 * guess-the-scribble server.
 *
 * Fastify app hosting the WebSocket game endpoint and (in production) serving
 * the built client. This is still the transport skeleton: the WebSocket layer
 * currently relays draw/clear/chat events between players. Rooms, turns, word
 * selection, scoring and persistence are layered on in Phase 1.
 */

const PORT = Number(process.env.PORT ?? 3000);

// In production `npm start` runs from the repo root and the built client lives
// at client/dist; override with CLIENT_DIST (e.g. in Docker). In development the
// client is served by Vite, so this directory need not exist.
const clientDist
  = process.env.CLIENT_DIST
    ?? fileURLToPath(new URL("../../client/dist", import.meta.url));

const app = Fastify({ logger: true });

await app.register(websocket);
await app.register(registerRelay);

if (existsSync(clientDist)) {
  await app.register(fastifyStatic, { root: clientDist, wildcard: false });

  // SPA fallback: unknown non-API, non-WS routes get the client shell.
  app.setNotFoundHandler((request, reply) => {
    const url = request.raw.url ?? "/";
    if (request.method === "GET" && !url.startsWith("/api") && !url.startsWith("/ws")) {
      return reply.sendFile("index.html");
    }
    return reply.code(404).type("text/plain").send("Not found");
  });
}

await app.listen({ port: PORT, host: "0.0.0.0" });
