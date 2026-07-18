import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer, type WebSocket } from "ws";

/**
 * guess-the-scribble server (scaffold).
 *
 * Serves the Vite-built client from `dist/` and hosts a WebSocket endpoint at
 * `/ws` that relays draw/chat events between players in a room. Real game rules
 * (turns, word selection, scoring) are not implemented yet — this is the
 * transport skeleton to build on.
 */

const PORT = Number(process.env.PORT ?? 3000);

// dist/server/server.js → repo root is two levels up; client build is dist/.
const serverDir = fileURLToPath(new URL(".", import.meta.url));
const clientDir = join(serverDir, "..");

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".json": "application/json; charset=utf-8",
  ".ico": "image/x-icon",
};

async function serveStatic(urlPath: string): Promise<{ body: Buffer; type: string } | null> {
  // Prevent path traversal, then map "/" to index.html.
  const safePath = normalize(urlPath).replace(/^(\.\.[/\\])+/, "");
  let filePath = join(clientDir, safePath === "/" ? "index.html" : safePath);

  try {
    if ((await stat(filePath)).isDirectory()) {
      filePath = join(filePath, "index.html");
    }
  }
  catch {
    return null;
  }

  try {
    const body = await readFile(filePath);
    return { body, type: MIME_TYPES[extname(filePath)] ?? "application/octet-stream" };
  }
  catch {
    return null;
  }
}

const httpServer = createServer(async (req, res) => {
  const urlPath = decodeURIComponent((req.url ?? "/").split("?")[0]);
  const asset = await serveStatic(urlPath);

  if (asset) {
    res.writeHead(200, { "Content-Type": asset.type });
    res.end(asset.body);
    return;
  }

  // SPA fallback: unknown non-file routes get the client shell.
  if (!extname(urlPath)) {
    const shell = await serveStatic("/");
    if (shell) {
      res.writeHead(200, { "Content-Type": shell.type });
      res.end(shell.body);
      return;
    }
  }

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not found");
});

// --- WebSocket game relay -------------------------------------------------

/** Messages exchanged between client and server. Shared shape for now. */
type GameMessage
  = | { type: "draw"; stroke: unknown }
    | { type: "clear" }
    | { type: "chat"; name: string; text: string };

const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

function broadcast(from: WebSocket, message: GameMessage) {
  const payload = JSON.stringify(message);
  for (const client of wss.clients) {
    if (client !== from && client.readyState === client.OPEN) {
      client.send(payload);
    }
  }
}

wss.on("connection", (socket) => {
  socket.on("message", (raw) => {
    let message: GameMessage;
    try {
      message = JSON.parse(raw.toString()) as GameMessage;
    }
    catch {
      return; // ignore malformed frames
    }
    broadcast(socket, message);
  });
});

httpServer.listen(PORT, () => {
  console.log(`guess-the-scribble server listening on http://localhost:${PORT} (ws: /ws)`);
});
