import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { createDb, type Db } from "../src/db/connection.js";
import { runMigrations } from "../src/db/setup.js";

describe("POST /api/rooms", () => {
  let db: Db;
  let app: FastifyInstance;

  beforeEach(async () => {
    db = createDb(":memory:");
    await runMigrations(db);
    app = await buildApp({ db, clientDist: null, logger: false });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    await db.destroy();
  });

  it("creates a room with a 6-char invite code and persists it", async () => {
    const res = await app.inject({ method: "POST", url: "/api/rooms", payload: {} });
    expect(res.statusCode).toBe(201);

    const body = res.json();
    expect(body.inviteCode).toMatch(/^[A-Z0-9]{6}$/);
    expect(body.status).toBe("lobby");
    expect(body.settings).toEqual({ rounds: 3, drawTimeSec: 80, maxPlayers: 8 });

    const row = await db
      .selectFrom("rooms")
      .selectAll()
      .where("invite_code", "=", body.inviteCode)
      .executeTakeFirstOrThrow();
    expect(row.id).toBe(body.id);
    expect(JSON.parse(row.settings)).toEqual(body.settings);
  });

  it("clamps out-of-range settings", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/rooms",
      payload: { settings: { rounds: 999, drawTimeSec: 5, maxPlayers: 100 } },
    });

    const body = res.json();
    expect(body.settings).toEqual({ rounds: 10, drawTimeSec: 30, maxPlayers: 12 });
  });

  it("returns a unique code for each room", async () => {
    const codes = new Set<string>();
    for (let i = 0; i < 25; i++) {
      const res = await app.inject({ method: "POST", url: "/api/rooms", payload: {} });
      codes.add(res.json().inviteCode);
    }
    expect(codes.size).toBe(25);
  });
});
