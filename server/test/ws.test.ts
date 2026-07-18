import type { AddressInfo } from "node:net";
import type { FastifyInstance } from "fastify";
import { WebSocket } from "ws";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { createDb, type Db } from "../src/db/connection.js";
import { seedWords } from "../src/db/seed.js";
import { runMigrations } from "../src/db/setup.js";

function nextMessage(ws: WebSocket): Promise<{ type: string; [k: string]: unknown }> {
  return new Promise((resolve) => {
    ws.once("message", (data: Buffer) => resolve(JSON.parse(data.toString())));
  });
}

function open(ws: WebSocket): Promise<void> {
  return new Promise(resolve => ws.once("open", () => resolve()));
}

describe("WebSocket endpoint", () => {
  let db: Db;
  let app: FastifyInstance;
  let port: number;

  beforeEach(async () => {
    db = createDb(":memory:");
    await runMigrations(db);
    await seedWords(db);
    app = await buildApp({ db, clientDist: null, logger: false });
    await app.listen({ port: 0, host: "127.0.0.1" });
    port = (app.server.address() as AddressInfo).port;
  });

  afterEach(async () => {
    await app.close();
    await db.destroy();
  });

  async function createRoom(): Promise<string> {
    const res = await app.inject({ method: "POST", url: "/api/rooms", payload: {} });
    return res.json().inviteCode as string;
  }

  it("joins a room and returns joined state", async () => {
    const code = await createRoom();
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    await open(ws);
    ws.send(JSON.stringify({ type: "join", roomCode: code, nickname: "ada" }));

    const msg = await nextMessage(ws);
    expect(msg.type).toBe("joined");
    ws.close();
  });

  it("rejects a message sent before joining", async () => {
    await createRoom();
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    await open(ws);
    ws.send(JSON.stringify({ type: "guess", text: "hi" }));

    const msg = await nextMessage(ws);
    expect(msg).toMatchObject({ type: "error", code: "not_allowed" });
    ws.close();
  });

  it("rejects a malformed frame", async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    await open(ws);
    ws.send("not json");

    const msg = await nextMessage(ws);
    expect(msg).toMatchObject({ type: "error", code: "invalid_message" });
    ws.close();
  });

  it("rejects joining an unknown room", async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    await open(ws);
    ws.send(JSON.stringify({ type: "join", roomCode: "ZZZZZZ", nickname: "ada" }));

    const msg = await nextMessage(ws);
    expect(msg).toMatchObject({ type: "error", code: "room_not_found" });
    ws.close();
  });
});
