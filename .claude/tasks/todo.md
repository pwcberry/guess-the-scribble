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
- [ ] **1b** Player/session model + reconnection via `sessionId`
- [ ] **1c** Round lifecycle: drawer rotation, 3 word choices, timers
- [ ] **1d** Server-side guess matching + time-decay scoring
- [ ] **1e** Persist games/rounds/results + drawings (replayable stroke JSON)
- [ ] **1f** Freeze full WS protocol with `zod` validation; secret word never to non-drawers

## Phase 2 — Client UI
- [ ] **2a** WS client + reconnection + state store
- [ ] **2b** Lobby/join (nickname + invite link)
- [ ] **2c** Drawing canvas (capture → send; render broadcasts)
- [ ] **2d** Chat/guess component
- [ ] **2e** Round HUD (blanks + timer) + scoreboard + game-end

## Phase 3 — Integration, e2e, deployment
- [ ] **3a** Playwright e2e (two contexts; assert no word leak)
- [ ] **3b** Multi-stage Dockerfile + docker-compose + SQLite volume
- [ ] **3c** Verify 7 success criteria; update `CLAUDE.md`
