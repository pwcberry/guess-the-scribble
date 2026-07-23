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
- [ ] **2b** Lobby/join (nickname + invite link)
- [ ] **2c** Drawing canvas (capture → send; render broadcasts)
- [ ] **2d** Chat/guess component
- [ ] **2e** Round HUD (blanks + timer) + scoreboard + game-end

## Phase 3 — Integration, e2e, deployment
- [ ] **3a** Playwright e2e (two contexts; assert no word leak)
- [ ] **3b** Multi-stage Dockerfile + docker-compose + SQLite volume
- [ ] **3c** Verify 7 success criteria; update `CLAUDE.md`

<!--
claude --resume a9d1876b-7e73-4f49-912e-2b4fa01545a6
-->
