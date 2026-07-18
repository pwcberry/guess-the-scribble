# Plan: Guess the Scribble

> Spec-driven **Phase 2 (Plan)** — derived from `.claude/tasks/spec.md` (Phase 1, approved).
> Status: **DRAFT — awaiting human review.** Do not start implementation (Phase 4) until approved.
> Task checklist lives in `.claude/tasks/todo.md`.

## Approach

The repo is an **early scaffold** (single package, `node:http` + `ws` relay, Lit demo), not
greenfield. Per decision, we **migrate the scaffold toward the spec's structure** first
(Phase 0), then build the game on that foundation. Work is delivered in vertical slices so
that after each phase there is something runnable and testable.

## Target structure (from spec)

```
guess-the-scribble/            → npm workspaces root
├─ shared/   → wire-protocol types + constants (no runtime deps)
├─ server/   → Fastify app (HTTP + WebSocket + SQLite + game engine)
├─ client/   → Lit + Vite frontend
├─ e2e/      → Playwright specs
└─ .claude/tasks/  → spec.md, plan.md, todo.md
```

### Migration mapping (current → target)

| Current                          | Target                                             |
|----------------------------------|----------------------------------------------------|
| `src/my-element.ts`, `index.html`, `src/index.css`, `src/assets/`, `public/` | `client/` (Vite root moves here) |
| `src/server.ts` (`node:http`+`ws`) | `server/src/index.ts` (Fastify), engine split into `server/src/{ws,game,db,routes,words}/` |
| inline `GameMessage` union       | `shared/src/protocol.ts`                            |
| `tsconfig.app.json`              | `client/tsconfig.json` (bundler mode, unchanged flags) |
| `tsconfig.server.json`           | `server/tsconfig.json` (nodenext, emits)           |
| root `tsconfig.json` refs        | root refs → `client`, `server`, `shared`           |
| `vitest.config.ts` (broken `test/` path) | per-package vitest config with real test dirs |
| root `package.json` scripts      | workspace-aware root scripts + per-package scripts  |

**Preserved throughout:** strict TS flags (`verbatimModuleSyntax`, `erasableSyntaxOnly`,
`noUnusedLocals/Parameters`), `@stylistic` ESLint rules (2-space, double quotes, semicolons,
LF), and the "eslint + vitest clean before every commit" rule from `CLAUDE.md`.

## Phases & dependency order

```
Phase 0  Foundation / migration ──┐
                                   ▼
Phase 1  Server game engine (core domain)
                                   ▼
Phase 2  Client UI  ───────────────┤ (can start against a mocked server after 1c)
                                   ▼
Phase 3  Integration, e2e, Docker, verification
```

**Phase 0 — Foundation & migration** *(sequential; everything depends on it)*
- npm workspaces + directory restructure (`client/`, `server/`, `shared/`).
- `shared/` protocol package seeded from the existing `GameMessage` union.
- Client moved into `client/`; Lit demo still builds/serves.
- Server rewritten on Fastify (`@fastify/websocket` + `@fastify/static`), relay behavior
  preserved as a stepping stone.
- Build/dev/test scripts rewired; vitest given a real `test/` layout.
- SQLite foundation: `better-sqlite3` + `kysely`, WAL/`foreign_keys` pragmas, migration
  runner, initial schema, English word-list seed.

**Phase 1 — Server game engine** *(the authoritative core; heavy unit-test coverage)*
- Room model + `POST /api/rooms` + `nanoid` invite codes.
- Player/session model + reconnection via `sessionId`.
- Round lifecycle: drawer rotation, 3-word choice, timers.
- Server-side guess matching + time-decay scoring.
- Persistence of games/rounds/round_results/drawings (replayable stroke JSON).
- Full server-side WS protocol with `zod` validation at the boundary.

**Phase 2 — Client UI** *(Lit components; can develop against a stub once protocol is fixed)*
- WS client + reconnection + client state store.
- Lobby/join (nickname, shareable invite link).
- Drawing canvas (capture strokes → send; render broadcasts).
- Chat/guess component.
- Round HUD (word blanks + timer), scoreboard, game-end screen.

**Phase 3 — Integration, e2e, deployment**
- Playwright e2e: two contexts play a round (draw → guess → score → reveal).
- Multi-stage Dockerfile + `docker-compose.yml` + SQLite volume.
- Success-criteria verification pass; update `CLAUDE.md` to match new structure.

## Parallelization

- Phase 0 is strictly sequential (foundation).
- Once the **`shared/` protocol is frozen** (end of Phase 1's WS task), Phase 2 client work
  can proceed in parallel with any remaining Phase 1 persistence work, using a stub server.
- Docker (Phase 3) can be drafted early but is verified last.

## Risks & mitigations

| Risk | Mitigation |
|------|------------|
| `better-sqlite3` is a **native module** — build/runtime ABI mismatch in Docker | Build in the same Node base image as runtime; pin Node version; verify in CI/e2e. |
| Large restructure breaks tooling (3 tsconfigs, eslint, vite) | Migrate in one focused Phase 0 slice; keep the Lit demo runnable as a smoke test; run `eslint .` + `vitest run` after each step. |
| Protocol churn forces client rework | Freeze `shared/src/protocol.ts` before heavy client work; treat protocol changes as "ask first". |
| Secret-word leakage regressions | Server-authoritative from day one; add an explicit e2e/WS-capture assertion that non-drawers never receive the word. |
| Timers/reconnection race conditions | Keep round state in a single server-owned game-loop module; unit-test timer expiry and mid-round reconnect. |

## Verification checkpoints (between phases)

- **After Phase 0:** `npm run build` + `npm run dev` work; app serves the Lit demo; server
  relays over WS; `eslint .` + `vitest run` clean; a trivial DB migration + seed runs.
- **After Phase 1:** engine unit tests green (≥80% on `server/src/game/**`); an integration
  test drives join → draw → guess → round-end → persistence over a real WS.
- **After Phase 2:** manual play in the browser; a full round works end to end locally.
- **After Phase 3:** all seven spec success criteria pass; Docker image runs the full game
  with a persisted SQLite volume.

## Out of scope for v1 (per spec)

Accounts/auth, public matchmaking lobby, custom word lists, PNG drawing export, Redis/
horizontal scaling, backups.
