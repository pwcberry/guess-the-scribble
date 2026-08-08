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

- [x] **1g-1** Remove SQLite deps from `server/package.json`
  - Remove `better-sqlite3` from `dependencies`; remove `@types/better-sqlite3` from `devDependencies`.
- [x] **1g-2** Add PostgreSQL deps to `server/package.json`
  - Add `pg` to `dependencies`; add `@types/pg` to `devDependencies`.
  - Kysely already ships `PostgresDialect` — no extra plugin needed.
- [x] **1g-3** Update `server/src/db/connection.ts`
  - Replace `BetterSQLite3Dialect` import with `PostgresDialect` from `kysely`.
  - Replace `DB_FILE` env-var with `DATABASE_URL` (standard PostgreSQL connection string).
  - Initialise a `pg.Pool` from `DATABASE_URL` and pass it to `PostgresDialect`.
  - Remove the synchronous `:memory:` shortcut; tests will use a real PostgreSQL test database.
- [x] **1g-4** Update `server/src/db/schema.ts`
  - Change SQLite auto-increment columns to PostgreSQL equivalents
    (`INTEGER PRIMARY KEY AUTOINCREMENT` → `GENERATED ALWAYS AS IDENTITY`).
  - Adjust Kysely `Database` interface types accordingly (e.g. `Generated<number>` for identity cols).
- [x] **1g-5** Update `server/src/db/migrations.ts`
  - Replace `INTEGER PRIMARY KEY AUTOINCREMENT` → `INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY`.
  - Remove `PRAGMA foreign_keys = ON` — PostgreSQL enforces FKs by default.
  - Remove `PRAGMA journal_mode = WAL` — not applicable to PostgreSQL.
  - Replace `INSERT OR IGNORE` / `INSERT OR REPLACE` with `INSERT … ON CONFLICT DO NOTHING` /
    `INSERT … ON CONFLICT … DO UPDATE`.
- [x] **1g-6** Update `server/src/db/migrate.ts`
  - Replace the SQLite-specific migration runner with a PostgreSQL-compatible one.
  - `--reset`: drop tables in reverse-dependency order (or `DROP SCHEMA public CASCADE; CREATE SCHEMA public`) before re-running.
- [x] **1g-7** Update `server/src/db/seed.ts`
  - Verify word-list insertion uses `INSERT … ON CONFLICT DO NOTHING`.
- [x] **1g-8** Update `server/src/db/setup.ts`
  - Wire up the PostgreSQL connection; remove any `:memory:` database logic.
- [x] **1g-9** Update `server/src/index.ts`
  - Remove `DB_FILE` read; read `DATABASE_URL` for the database connection.
- [x] **1g-10** Update the test harness (`server/test/helpers.ts` + vitest config)
  - Remove the in-memory SQLite shortcut.
  - Provide `DATABASE_URL` pointing at a local PostgreSQL **test** database via `.env.test`
    (and CI environment variables).
  - Add `beforeEach`/`afterEach` hooks that truncate tables (or wrap each test in a
    rolled-back transaction) to keep test isolation.
  - Add setup instructions to `README.md` for provisioning the test database.
- [x] **1g-11** Update `CLAUDE.md`
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
- [ ] **3b** Heroku deployment: bundle client + server + shared into one deployable Node app
      (see Phase 3b breakdown below); no Docker image ships in v1.
- [ ] **3c** Verify 7 success criteria; update `CLAUDE.md`

### Phase 3b — Heroku single-dyno deployment

The client, server, and shared protocol ship as one Node application on Heroku. All
production artifacts are assembled into a single top-level **`deploy/`** folder at the
repo root (`deploy/server`, `deploy/client`, `deploy/shared`, `deploy/package.json`,
`deploy/node_modules`) — this is the deployable unit. The compiled server
(`node deploy/server/index.js`) serves the API, the `/ws` WebSocket, and the built client
from `deploy/client` via `@fastify/static`. Server code stays plain Node ESM (no bundler);
the client is a Vite production bundle. Every artifact must also run locally with
`npm ci && npm run build && DATABASE_URL=… npm start` — no Heroku-specific glue.

Each task ends with `npm run lint` + `npm test` + `npm run typecheck` clean.

- [x] **3b-1** Server: robust static-assets wiring
  - `server/src/index.ts`: resolve `CLIENT_DIST` (default) relative to the compiled
    server location so the same path works from Heroku's slug root
    (`deploy/server` → `../client`) and from a local `npm start`. Log an explicit warning
    (not a crash) if the directory is missing.
  - `server/src/app.ts`: keep the existing `@fastify/static` + SPA-fallback registration.
    Confirm the fallback still excludes `/api` and `/ws`, and add a cache header for
    hashed Vite assets (`Cache-Control: public, max-age=31536000, immutable` for
    `/assets/*`, no-cache for `index.html`).
  - Files: `server/src/index.ts`, `server/src/app.ts`.
  - Verify: `npm run build && npm start` locally serves the SPA at `/` and `/ws` still works.
  - Done: `CLIENT_DIST` default now `new URL("../client", import.meta.url)` (`deploy/client`
    when booted from `deploy/server/index.js`), with a `console.warn` when missing.
    `app.ts` adds an `onSend` hook that stamps immutable cache on `/assets/*` and
    `no-cache` on everything else (excluding `/api`/`/ws`). Verified: lint + typecheck +
    96/96 tests clean; `npm run build` produces `deploy/`.

- [x] **3b-2** Client: derive the WebSocket URL from `window.location`
  - `client/src/net/ws-client.ts`: build the WS URL at runtime — `wss:` under HTTPS else
    `ws:`, host from `window.location.host`, path `/ws`. Support an optional
    `import.meta.env.VITE_WS_URL` override for non-default local setups.
  - Ensure the Vite dev server proxies `/ws` to `ws://localhost:3000` (or the client uses
    the override in dev). Update `client/vite.config.ts` if a proxy is chosen.
  - Files: `client/src/net/ws-client.ts`, `client/vite.config.ts`, `client/test/ws-client.test.ts`.
  - Verify: existing WS-client tests updated; manual dev + prod smoke.
  - Done: `resolveUrl()` now honours `import.meta.env.VITE_WS_URL` before falling back to
    the same-origin `${wsProto}//${host}/ws` derivation. `vite.config.ts` already proxies
    `/ws` + `/api` to the Fastify server, so dev needs no override. Existing ws-client
    tests still pass (they inject `url` directly).

- [x] **3b-3** Database connection: Heroku Postgres TLS
  - `server/src/db/connection.ts`: enable `ssl: { rejectUnauthorized: false }` on the
    `pg.Pool` when `DATABASE_URL`'s host is not `localhost`/`127.0.0.1`, or when
    `DATABASE_SSL=true`. Keep the default off for local Postgres.
  - Confirm `runMigrations` + `seedWords` still run on boot from `server/src/index.ts`
    (a Heroku `release` phase remains optional for now).
  - Files: `server/src/db/connection.ts`.
  - Verify: server tests still pass against local Postgres; document the SSL toggle in `README.md`.
  - Done: `shouldUseSsl(url)` gates `ssl: { rejectUnauthorized: false }` — auto-enabled for
    non-`localhost`/`127.0.0.1`/`::1` hosts, overridable via `DATABASE_SSL=true|false`.
    Tests still target local Postgres → no SSL. README lists `DATABASE_SSL` in the Heroku
    config-vars table.

- [x] **3b-4** TypeScript compiler configuration
  - `server/tsconfig.json`: confirm `outDir: "dist"`, `rootDir: "src"`,
    `module`/`moduleResolution: "nodenext"`, `sourceMap: true`, `declaration: false`, and
    that `"include"` is scoped to `src/**/*.ts` (so `test/` never lands in the compiled
    output).
  - `shared/tsconfig.json`: keep emitting `dist` + `.d.ts`; ensure `"include"` excludes tests.
  - `client/tsconfig.json`: unchanged (bundler-mode, `noEmit`); Vite handles transpile.
  - Root `tsconfig.json`: project references unchanged — `npm run typecheck` still covers
    all three workspaces.
  - Verify: `npm run build` produces the per-workspace `dist` folders with no stray test
    output; `npm run typecheck` clean. (The `deploy/` assembly step in 3b-5 consumes these.)
  - Done: added `"sourceMap": true` + explicit `"declaration": false` to
    `server/tsconfig.json`. `"include": ["src"]` was already correct across all three
    workspaces; client stays bundler-mode `noEmit`. `npm run typecheck` clean.

- [x] **3b-5** Root `package.json`: Heroku build hooks, `deploy/` assembly, Node engine
  - Add `"heroku-postbuild": "npm run build"` so Heroku produces the slug artifacts after
    `npm ci`.
  - Extend `"build"` (or add a `"build:deploy"` step chained after it) to assemble the
    top-level **`deploy/`** folder: copy `server/dist` → `deploy/server`,
    `client/dist` → `deploy/client`, `shared/dist` → `deploy/shared`, and write a
    slimmed `deploy/package.json` (runtime deps only, `"type": "module"`,
    `"start": "node server/index.js"`, `"engines"`). Follow with `npm ci --omit=dev
    --prefix deploy` (or equivalent) so `deploy/node_modules` contains production deps only.
    A small Node script under `../../scripts/build-release.js` is the recommended implementation.
  - Change the root `"start"` to `"node deploy/server/index.js"` so Heroku and local
    parity both boot from the same tree. No `Procfile` required.
  - Add `"engines": { "node": ">=22" }` at the repo root (and mirror it in
    `deploy/package.json`) to pin the Heroku Node stack.
  - Add `deploy/` to `.gitignore`.
  - Ensure the build toolchain (`typescript`, `vite`, `@vitejs/plugin-*`, `@types/*` needed
    at build time) is reachable during `heroku-postbuild` — either move them into
    `dependencies` of the workspace that needs them, or set the Heroku config var
    `NPM_CONFIG_PRODUCTION=false` so dev deps are installed for the build. Pick one
    approach and document it.
  - Files: root `package.json`, `.gitignore`, `../../scripts/build-release.js`, workspace
    `package.json` files as needed.
  - Verify: `rm -rf node_modules */node_modules */dist deploy && npm ci
    && npm run heroku-postbuild && npm start` boots the app from `deploy/` and serves both
    the SPA and `/ws`.
  - Done: added `../../scripts/build-release.js` (copies `{server,client,shared}/dist` → `deploy/`,
    writes a slimmed `deploy/package.json` with `@gts/shared` as `file:./shared`, then runs
    `npm install --omit=dev` in `deploy/` so `deploy/node_modules` carries prod deps only).
    Root `package.json` gained `build:deploy`, chained into `build`, plus `heroku-postbuild`,
    `"engines": { "node": ">=24" }` (aligns with `server/package.json`'s existing pin), and
    `"start": "node deploy/server/index.js"`. `.gitignore` and eslint `globalIgnores` both
    exclude `deploy/`. Toolchain decision: Heroku runs `npm ci` (installs devDependencies)
    before the postbuild hook because `NODE_ENV` isn't set to production during install by
    default — the existing devDependencies layout is sufficient; documented as
    `NPM_CONFIG_PRODUCTION=false` in the README if needed.
  - Verified end-to-end: `npm run build` produces `deploy/{server,client,shared,node_modules,
    package.json}` with an installed prod tree (98 packages). Lint + typecheck +
    96/96 tests all clean.

- [x] **3b-6** Env-var documentation + local parity script
  - `README.md`: add a "Deploying to Heroku" section listing required config vars
    (`DATABASE_URL`, `PORT`, `NODE_ENV=production`, optional `DATABASE_SSL=true`,
    optional `CLIENT_DIST`) and the one-shot commands (`heroku create`,
    `heroku addons:create heroku-postgresql:essential-0`, `git push heroku main`).
  - Document the local-parity invocation:
    `npm ci && npm run build && DATABASE_URL=… npm start`.
  - Files: `README.md`, `CLAUDE.md` (update deployment note).
  - Done: README gained "Production build" + "Deploying to Heroku" sections (config-vars
    table, one-shot Heroku commands, local parity invocation). CLAUDE.md status bullet,
    `npm start` doc, and Config-caveats bullet all now reference the `deploy/` layout.

- [ ] **3b-7** Smoke check on Heroku
  - Deploy to a review app or scratch Heroku app; verify: SPA loads at `/`, `POST /api/rooms`
    returns an invite code, two browsers can join and play a full turn over `wss://…/ws`,
    the game persists to Heroku Postgres, and no secret word appears in WS traffic to
    non-drawers.
  - Files: none (operational task); attach the app URL + a short verification note to the PR.


<!--
claude --resume a9d1876b-7e73-4f49-912e-2b4fa01545a6
-->
