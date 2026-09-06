# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`guess-the-scribble` is a **skribbl.io clone** (a real-time multiplayer drawing-and-guessing game).

Status (see `.claude/tasks/todo.md` for the live plan):

- **Server game engine — done (Phases 0–1).** Rooms/players, invite codes, WS join + reconnection, turn lifecycle (drawer rotation, word choices, timers), server-side guess matching + time-decay scoring, PostgreSQL persistence of games/turns/results/drawings, and a **frozen** WS protocol with zod validation at the trust boundary. A **turn** is one drawer's period; a **round** is a full rotation (one turn per present player); a game runs `settings.rounds` rounds and ends after the last turn of the last round.
- **DB refactor (Phase 1g) — pending.** The server DB layer currently uses SQLite (`better-sqlite3`). Phase 1g migrates it to PostgreSQL (`pg` + Kysely's `PostgresDialect`, `DATABASE_URL` env var). See `.claude/tasks/todo.md` for the step-by-step plan.
- **Client — greenfield (Phase 2, in progress).** `client/src/my-element.ts` is still the generated Vite + Lit demo. The real WS client, lobby/join, drawing canvas, chat/guess, and turn HUD/scoreboard all still need building.
- **Not started (Phase 3):** Playwright e2e, Heroku deployment (single-dyno; client + server assembled into a top-level `deploy/` folder that `npm start` boots as `node deploy/server/index.js`).

## Repository layout

npm **workspaces** (root `package.json`), two packages plus a root `tsconfig.json` that project-references both:

- **`server/` (`@gts/server`)** — Fastify app, game engine (`server/src/game`), DB layer (`server/src/db`), WS handlers (`server/src/ws`), REST routes (`server/src/routes`). `nodenext`, **emits** to `server/dist`.
- **`client/` (`@gts/client`)** — Lit + Vite SPA, bundler-mode, `noEmit`. Vite builds it to `client/dist`.

There is no shared workspace. The wire protocol (`ClientMessage`, `ServerMessage`, view types, `WS_PATH`) lives as a **duplicated plain source file** — `server/src/protocol.ts` and `client/src/protocol.ts` — one copy per workspace, each imported locally (no package, no build step). The two copies must be kept byte-for-byte in sync by hand whenever the protocol changes; see "Shared protocol" below.

## Commands

Run from the repo root (npm dispatches to the right workspace):

```bash
npm run dev          # client(Vite) + server(tsx --watch) via concurrently (2 processes)
npm run dev:client   # Vite dev server only
npm run dev:server   # server only (tsx --watch)
npm run build        # client → server → build:deploy (assembles .release/)
npm run typecheck    # tsc --noEmit on client + server
npm run lint         # eslint .
npm test             # vitest run (non-interactive)
npm run db:migrate   # apply migrations to the PostgreSQL db (server workspace; needs DATABASE_URL)
npm run db:reset     # drop + re-migrate (PostgreSQL)
npm start            # node deploy/server/index.js (serves built client + WS from deploy/)
npm run preview      # Vite preview of the built client
```

Single test file: `npx vitest run server/test/foo.test.ts`. Single package build: `npm run build -w @gts/server`.

## Before every commit

**Always run lint and the unit tests from the repo root, and only commit if both pass:**

```bash
npm run lint     # eslint . — must be clean, no errors
npm test         # vitest run — must pass (non-interactive, not watch mode)
```

Fix any failures before committing rather than committing around them. Do not commit with a failing or skipped lint/test step.

## Pull requests

- **Cap each feature PR at 25 changed files.** Keep pull requests small enough for a manageable review — if a feature would touch more than 25 files, split it into multiple PRs. Check with `git diff --name-only main | wc -l` before opening one.

## Server

- **Fastify** (`server/src/app.ts` `buildApp()`) with `@fastify/websocket` (game endpoint at `WS_PATH` = `/ws`) and `@fastify/static` (serves the built client with an SPA fallback to `index.html` for non-`/api`, non-`/ws` GET routes). `buildApp` is **dependency-injected** (`db`, optional `clientDist`) so integration tests run it against an in-memory DB with no static assets. `server/src/index.ts` is the thin bootstrap: open DB → migrate → seed → `buildApp` → listen.
- **Game engine (`server/src/game`).** `RoomRegistry` indexes active rooms by invite code and injects shared deps (word pool, `Scheduler` clock, persistence event sink) into each `Room`. `Room` owns **all** game state and outbound messages — the WS layer is a dumb transport adapter. Per-turn state machine: `choosing → drawing → intermission`; turns are grouped into rounds (full rotations) via a per-round drawer queue. The `Scheduler` is **injectable** (`FakeScheduler` in tests) so turn/timer logic is deterministic.
- **WS handlers (`server/src/ws/handlers.ts`).** Each socket must send `join` first; on success it's bound to a room + session and further messages dispatch to `room.handleMessage(sessionId, msg)`. Inbound messages are validated by the **zod** schema in `ws/schema.ts` (`parseClientMessage`) at the trust boundary — malformed/invalid are rejected with an `error` message.
- **Persistence (`server/src/db`).** PostgreSQL via **`pg`** + **`kysely`** (typed query builder, `PostgresDialect`). Versioned inline migrations, word seed. `createGameEventSink` chains ordered async writes off engine events and exposes `flush()` for tests/shutdown. Reads `DATABASE_URL` (default `postgresql://localhost:5432/gts`; set to a dedicated test database for the test suite). Server code uses `nodenext` ESM — local imports carry `.js` specifiers that point at `.ts` sources; don't import client (bundler-mode) `.ts` files here.

## Shared protocol (duplicated `protocol.ts`)

- `server/src/protocol.ts` and `client/src/protocol.ts` are **duplicate copies** of the WS protocol: `ClientMessage`, `ServerMessage`, and the view types (`RoomView`, `PlayerView`, `TurnPublic`, …), plus `WS_PATH`. There is no shared package — each workspace imports its own local copy.
- **Any change to one copy must be mirrored byte-for-byte in the other.** There is no build step or type check that enforces this across workspaces; a divergence is a silent bug. Diff the two files as part of any protocol change.
- **The server is authoritative and never leaks the secret word to non-drawers.** `TurnPublic` carries only `wordPattern` (blanks) + `wordLength`; the full `word` appears only in `turnEnd`. Preserve this invariant in any protocol or engine change.
- **The protocol is FROZEN (Phase 1f).** Any change to `protocol.ts` must be mirrored in the server's zod schema (`server/src/ws/schema.ts`) as well as in the client's copy. Treat protocol changes as "ask first".
- Stroke points are **normalised to 0..1** (resolution-independent) so the canvas can render at any size.

## Client (Phase 2 — to build)

Still the Vite/Lit demo. When building the real client, it must connect to the server's `/ws` explicitly (in dev the client is served by Vite on its own port, not by the Node server), speak the protocol defined in `client/src/protocol.ts`, and support reconnection via the `sessionId` returned in `joined`.

## Config caveats

- **Dev = two processes.** `npm run dev` runs `@gts/client` (Vite) and `@gts/server` (`tsx --watch`) in parallel via `concurrently`. In dev the client is served by Vite (which proxies `/ws` and `/api` to the Fastify server); only the production build assembles `deploy/`, which the Node server serves from (`npm start` → `node deploy/server/index.js`).
- **Vitest resolves `.js` → `.ts`.** `vitest.config.ts` sets `resolve.extensionAlias` so the server's `nodenext` `.js` specifiers load their `.ts` sources under Vite. Tests live in `{server,client}/test/**/*.test.ts` (`environment: node`).

## Architecture & TypeScript

- **UI framework: Lit web components.** `LitElement` subclasses registered with `@customElement('tag-name')`; styles in a static `styles = css\`…\`` block (Shadow DOM–scoped); reactive state via `@property`/`@state`; templates via the `html\`…\`` tagged template. `index.html` mounts the root component as a custom-element tag.
- **TypeScript is strict everywhere.** `verbatimModuleSyntax` is on in all packages — use `import type { … }` for type-only imports. `noUnusedLocals`/`noUnusedParameters`, `erasableSyntaxOnly`, and `noFallthroughCasesInSwitch` are enforced across all tsconfigs.
- **Two module worlds.** Client (`client/tsconfig.json`) is **bundler-mode**, `noEmit`, `allowImportingTsExtensions` — Vite bundles it, local imports use `.ts` extensions. Server (`server/tsconfig.json`) is **`nodenext`** and **emits** JS — local imports use `.js` specifiers pointing at `.ts` sources. Don't mix the two worlds.

## Conventions

- **Formatting (enforced by `@stylistic` ESLint + `.editorconfig`):** 2-space indent, **double quotes**, semicolons, LF line endings, trailing newline, no trailing whitespace. Control-flow bodies always use braces (`curly: "all"`), on their own lines (`max-statements-per-line` is 1). `npm run lint` is currently clean — keep it that way.
- **`no-unused-vars`** ignores identifiers matching `^[A-Z_]` (uppercase/underscore-prefixed).
