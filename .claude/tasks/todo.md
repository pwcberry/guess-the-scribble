# Todo: Guess the Scribble

Derived from `.claude/tasks/plan.md`. Each task ends with `npx eslint .` + `npx vitest run`
clean before it's considered done.

## Phase 0 — Foundation & migration (sequential) ✅ COMPLETE
- [x] **0a** npm workspaces + `client/`/`server/`/`shared/` dirs; root `tsconfig.json` refs + `package.json` scripts
- [x] **0b** `shared/` protocol package seeded from `GameMessage` (`shared/src/protocol.ts`)
- [x] **0c** Client moved into `client/`; Lit demo builds via Vite (`client/dist`)
- [x] **0d** Server rewritten on Fastify (`@fastify/websocket` + `@fastify/static`); relay preserved, split into `server/src/ws/relay.ts`
- [x] **0e** Root vitest config with `.js→.ts` extensionAlias + real tests (`shared/test`, `server/test`)
- [x] **0f** SQLite foundation: `better-sqlite3` + `kysely`, WAL/FK pragmas, inline migrations, schema, word seed, `db:migrate`/`db:reset` CLI
  - Verified: full build, `db:migrate` (→ `data/gts.db`), `eslint .` clean, `vitest run` 5/5 green, server runtime smoke test (static + SPA fallback + WS relay).

## Phase 1 — Server game engine
- [x] **1a** Room model + `POST /api/rooms` + `nanoid` invite codes
  - Done: `game/{ids,settings,room,registry}.ts`, `db/rooms.ts`, `routes/rooms.ts`; extracted testable `buildApp()` (`app.ts`) + slim `index.ts`. Verified: 8/8 tests, eslint clean.
- [x] **1b** Player/session model + WS join + reconnection via `sessionId`
  - Done: full protocol shape in `shared`; `game/{connection,player}.ts`, expanded `Room`; `ws/handlers.ts` replaces the relay. Verified: 17/17 tests, eslint clean, build green.
- [x] **1c** Round lifecycle: drawer rotation, 3 word choices, timers
  - Done: `scheduler.ts` (injectable clock), `words.ts` (WordPool), `round.ts`, `wordmask.ts`, `events.ts`; Room round state machine (start→choose→draw→reveal→next→end), drawer-only draw/clear/undo, auto-pick, drawer-absence handling. Verified: 24 tests (adds deterministic round tests via FakeScheduler).
- [x] **1d** Server-side guess matching + time-decay scoring
  - Done: `scoring.ts` (guesser time-decay + drawer proportional), `wordmask.ts` correctness + close (Levenshtein); Room guess handling — correct→score+correctGuess+early end, wrong→chat(+private "close"), drawer scored at round end. Verified: 34 tests.
- [x] **1e** Persist games/rounds/results + drawings (replayable stroke JSON)
  - Done: `db/games.ts` (insertGame/saveRound/endGame + player upsert), `db/persistence.ts` (event sink chaining ordered async writes, `flush()` for tests/shutdown); wired into `buildApp`. Verified: 35 tests (full-game persistence: game/round/results/drawing JSON/players).
- [x] **1f** Freeze full WS protocol with `zod` validation; secret word never to non-drawers
  - Done: `ws/schema.ts` zod discriminated-union validation at the trust boundary (bounds on points/nickname/guess); handler rejects malformed/invalid; protocol marked FROZEN. Verified: 46 tests (adds schema unit tests + real-socket WS integration: join, pre-join reject, malformed reject, unknown-room reject).

## Phase 2 — Client UI
- [x] **2a** WS client + reconnection + state store
  - Done: `client/src/net/ws-client.ts` (typed `GameClient`: lifecycle, auto-reconnect w/ backoff, `sessionId` replay on rejoin), `client/src/state/store.ts` (pure `reduce` + reactive `GameStore` folding server messages into `GameState`). Canvas stroke messages pass through the reducer for the 2c component. Verified: 62 tests (adds 16 client tests: reducer + fake-socket reconnection), eslint clean, typecheck green.
- [x] **2b** Lobby/join (nickname + invite link)
  - Done: `net/api.ts` (`createRoom` → `POST /api/rooms`); `components/gts-app.ts` (root shell owning the `GameStore`, screen router join→lobby→game→end, `?room=` URL sync); `gts-join.ts` (nickname + create-with-settings / join-via-link); `gts-lobby.ts` (code, copyable invite link, roster, host Start); `lobby-helpers.ts` (pure URL/start-eligibility helpers). `GameClient.joinRoom` reuses the open socket on retry (nickname-taken). Replaced the Vite/Lit demo (`my-element` + assets removed), mounts `<gts-app>`. Verified: 72 tests (adds 20: lobby-helpers + open-socket rejoin), eslint clean, typecheck green, client build green, `POST /api/rooms` smoke test.
- [x] **2c** Drawing canvas (capture → send; render broadcasts)
  - Done: `components/canvas-helpers.ts` (pure, node-tested: point normalise/clamp, drawer/phase derivations, palette + sizes, width reference scale); `components/gts-canvas.ts` (Lit canvas — pointer capture with one gesture = one `Stroke`, dpr/resize-aware full-redraw, colour palette + brush sizes + undo/clear, drawer word-choice overlay, read-only watcher caption for guessers). Taps `client.onMessage` directly for `drawBroadcast`/`clearCanvas` (they bypass the reducer); resets on round-ordinal change. Wired into `gts-app` "playing" screen. Verified: 80 tests (adds 8 canvas-helpers), eslint clean, client typecheck + Vite build green.
- [x] **2d** Chat/guess component
  - Done: `components/chat-helpers.ts` (pure, node-tested `chatInputState` mirroring the server's routing — disables the box for the drawer and for players who've already guessed during the drawing phase; guess vs. chat placeholder otherwise); `components/gts-chat.ts` (Lit panel — scrollable `role="log"` live region styling chat/correct/close/system entries, auto-scroll, empty state, submit form dispatching `gts-guess`). Wired into `gts-app` (`gts-guess` → `client.guess`, responsive canvas+chat `.game` layout: stacked on mobile, side-by-side ≥860px). A single `guess` message carries both guesses and chat; the server decides. Verified: 85 tests (adds 5 chat-helpers), eslint clean, client typecheck + Vite build green.
- [x] **2e** Round HUD (blanks + timer) + scoreboard + game-end
  - Done: `hud-helpers.ts` + `scoreboard-helpers.ts` (pure, node-tested: timer remaining/fraction, `rankByScore` with ties); `gts-hud.ts` (round X/Y, drawer, word for the drawer / blanks for guessers, live countdown bar, and the round-end reveal keyed off `lastRound` — the server never broadcasts phase=intermission, so the client's `round.phase` still reads "drawing" then); `gts-scoreboard.ts` (ranked players + icon-and-label status badges); `gts-game-over.ts` (final standings + winner + "Play again"). Store gained `myWord` (the drawer's chosen word — the protocol never echoes it back): set via `GameStore.chooseWord`, kept through the drawing-phase `roundStart`, cleared on a new round / round-end / game-end; `gts-canvas` now routes word choice through a `gts-choose-word` event. Wired HUD+canvas / scoreboard+chat into a responsive `gts-app` playing layout; game-over replaces the ended placeholder. Verified: 94 tests (adds store `myWord`, hud + scoreboard helpers), eslint clean, client typecheck + Vite build green.
  - Also (per request): added `curly: ["error", "all"]` to `eslint.config.js` and reformatted the resulting single-line control bodies repo-wide.

## Phase R — `round`→`turn` rename + real `round` grouping (2026-07-25)
See `plan.md` → "Change Request (2026-07-25)". **Decision: Option B — two PRs.** Each commit
ends with `npm run lint` + `npm test` + `npm run typecheck` clean.

### PR-R1 — round-grouping feature, keeping today's `round` names (green throughout)
- [x] **R1a** Engine: `settings.rounds` = rotations; `rounds × players` turns; game ends after
      the last rotation; below-2-players early end
  - Acceptance: N players + `rounds: R` ⇒ exactly `R × N` turns, everyone draws R times,
    `gameEnd` after the last turn; per-rotation drawer order from present players; early end < 2.
  - Verify: new engine tests (exact turn count, per-player draw count, early-end); `vitest run`.
  - Files: `server/src/game/{room,round,settings}.ts` (+ `events.ts` if round_ordinal persisted).
  - Done: rotation queue + `rotationOrdinal` in `room.ts` (`nextDrawer` replaces `pickDrawer`;
    below-2 guard in `beginRound`). Updated `round.test.ts` (+3 tests) and `persistence.test.ts`
    (rounds:1 = 2-turn rotation). Verified: lint clean, typecheck green, 96/96 tests.
- [x] **R1b** Add `RoundPublic.rotationOrdinal`; HUD shows `rotationOrdinal` / `totalRounds`
  - Acceptance: wire adds the one field; `gts-hud` reads it; store/canvas unchanged (`ordinal`
    stays the turn reset key). zod unchanged (no inbound change).
  - Verify: `npm run typecheck` + `vitest run` clean; manual 2-player 2-round smoke ("Round 1/2"→"2/2").
  - Files: `shared/src/protocol.ts`, `server/src/game/room.ts`, `client/src/components/gts-hud.ts`
    (+ `hud-helpers.ts` / its test).
  - Done: added `RoundPublic.rotationOrdinal`; `publicRound()` fills it; HUD reads it; 5 client
    round fixtures updated. Verified: lint/typecheck clean, 96/96 tests. (Manual browser smoke pending.)
- [~] **R1c** Persist `round_ordinal` + `turn_count` — **folded into PR-R2.**
  Persistence is already semantically correct under the new model (`games.round_count` =
  `settings.rounds` = rotations; turn rows carry the global `ordinal`). The nice-to-have
  `round_ordinal`/`turn_count` columns land in R2 where the DB is renamed `rounds`→`turns`,
  avoiding a throwaway migration.

### PR-R2 — mechanical `round`→`turn` rename (agreed cap exception)
Landed as one atomic change (shared type/message renames break the client until updated, so
each commit must stay green — no intermediate split possible). Also folds R1c (persist
`round_ordinal`; `turn_count` skipped as derivable from turn rows).
- [x] **R2a** Rename in `shared` + `server` (protocol types/messages, engine, db)
  - Done: `TurnPhase`/`TurnPublic`/`TurnResult`, `RoomView.turn`, `turnStart`/`turnEnd`,
    `turnOrdinal` + `roundOrdinal`; `round.ts`→`turn.ts` (`Round`→`Turn`); `turnEnded` event
    carries both ordinals; DB `turns`/`turn_results`/`turn_id` + `round_ordinal` column; zod
    unchanged (no inbound round/turn fields). Verified: server typecheck + tests, `db:reset`.
- [x] **R2b** Rename in `client` + docs; re-freeze protocol
  - Done: store (`TurnOutcome`/`lastTurn`), components + helpers (`turnKey`, `turn`), all
    client tests; `CLAUDE.md` + `protocol.ts` header updated with the turn/round vocabulary
    and re-freeze note; `grep` sweep shows only `round`=rotation (plus `Math.round`/CSS).
  - Verified: lint + typecheck + 96 tests + build all clean. (Manual browser smoke pending.)

## Phase 1g — DB Refactor: SQLite → PostgreSQL

Replace `better-sqlite3` (SQLite) with `pg` (PostgreSQL) throughout the server DB layer.
No game-logic, WS protocol, or client changes are in scope.
Each step ends with `npm run lint` + `npm test` + `npm run typecheck` clean.

- [ ] **1g-1** Remove SQLite deps from `server/package.json`
  - Remove `better-sqlite3` from `dependencies`; remove `@types/better-sqlite3` from `devDependencies`.
- [ ] **1g-2** Add PostgreSQL deps to `server/package.json`
  - Add `pg` to `dependencies`; add `@types/pg` to `devDependencies`.
  - Kysely already ships `PostgresDialect` — no extra plugin needed.
- [ ] **1g-3** Update `server/src/db/connection.ts`
  - Replace `BetterSQLite3Dialect` import with `PostgresDialect` from `kysely`.
  - Replace `DB_FILE` env-var with `DATABASE_URL` (standard PostgreSQL connection string).
  - Initialise a `pg.Pool` from `DATABASE_URL` and pass it to `PostgresDialect`.
  - Remove the synchronous `:memory:` shortcut; tests will use a real PostgreSQL test database.
- [ ] **1g-4** Update `server/src/db/schema.ts`
  - Change SQLite auto-increment columns to PostgreSQL equivalents
    (`INTEGER PRIMARY KEY AUTOINCREMENT` → `GENERATED ALWAYS AS IDENTITY`).
  - Adjust Kysely `Database` interface types accordingly (e.g. `Generated<number>` for identity cols).
- [ ] **1g-5** Update `server/src/db/migrations.ts`
  - Replace `INTEGER PRIMARY KEY AUTOINCREMENT` → `INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY`.
  - Remove `PRAGMA foreign_keys = ON` — PostgreSQL enforces FKs by default.
  - Remove `PRAGMA journal_mode = WAL` — not applicable to PostgreSQL.
  - Replace `INSERT OR IGNORE` / `INSERT OR REPLACE` with `INSERT … ON CONFLICT DO NOTHING` /
    `INSERT … ON CONFLICT … DO UPDATE`.
- [ ] **1g-6** Update `server/src/db/migrate.ts`
  - Replace the SQLite-specific migration runner with a PostgreSQL-compatible one.
  - `--reset`: drop tables in reverse-dependency order (or `DROP SCHEMA public CASCADE; CREATE SCHEMA public`) before re-running.
- [ ] **1g-7** Update `server/src/db/seed.ts`
  - Verify word-list insertion uses `INSERT … ON CONFLICT DO NOTHING`.
- [ ] **1g-8** Update `server/src/db/setup.ts`
  - Wire up the PostgreSQL connection; remove any `:memory:` database logic.
- [ ] **1g-9** Update `server/src/index.ts`
  - Remove `DB_FILE` read; read `DATABASE_URL` for the database connection.
- [ ] **1g-10** Update the test harness (`server/test/helpers.ts` + vitest config)
  - Remove the in-memory SQLite shortcut.
  - Provide `DATABASE_URL` pointing at a local PostgreSQL **test** database via `.env.test`
    (and CI environment variables).
  - Add `beforeEach`/`afterEach` hooks that truncate tables (or wrap each test in a
    rolled-back transaction) to keep test isolation.
  - Add setup instructions to `README.md` for provisioning the test database.
- [ ] **1g-11** Update `CLAUDE.md`
  - Remove all mentions of `better-sqlite3`, `DB_FILE`, `:memory:`, WAL, and FK pragmas.
  - Describe `pg` + `PostgresDialect` + `DATABASE_URL` in the Persistence section.
  - Update `db:migrate` / `db:reset` command descriptions.

**Environment variable change:**

| Old | New |
|-----|-----|
| `DB_FILE` (path to `.db` file, `:memory:` for tests) | `DATABASE_URL` (PostgreSQL connection string) |

Default dev value: `postgresql://localhost:5432/gts`

**PR:** `refactor/sqlite-to-postgres` — touches ≤ 12 server files + `CLAUDE.md`, well within the 25-file cap.

---

## Phase 3 — Integration, e2e, deployment
- [ ] **3a** Playwright e2e (two contexts; assert no word leak)
- [ ] **3b** Multi-stage Dockerfile + Docker Compose (app container + PostgreSQL service)
- [ ] **3c** Verify 7 success criteria; update `CLAUDE.md`

<!--
claude --resume a9d1876b-7e73-4f49-912e-2b4fa01545a6
-->
