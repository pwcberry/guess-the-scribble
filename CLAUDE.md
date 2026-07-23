# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`guess-the-scribble` is a **skribbl.io clone** (a real-time multiplayer drawing-and-guessing game).

Status (see `.claude/tasks/todo.md` for the live plan):

- **Server game engine — done (Phases 0–1).** Rooms/players, invite codes, WS join + reconnection, round lifecycle (drawer rotation, word choices, timers), server-side guess matching + time-decay scoring, SQLite persistence of games/rounds/results/drawings, and a **frozen** WS protocol with zod validation at the trust boundary.
- **Client — greenfield (Phase 2, in progress).** `client/src/my-element.ts` is still the generated Vite + Lit demo. The real WS client, lobby/join, drawing canvas, chat/guess, and round HUD/scoreboard all still need building.
- **Not started (Phase 3):** Playwright e2e, Dockerfile/compose, deployment.

## Repository layout

npm **workspaces** (root `package.json`), three packages plus a root `tsconfig.json` that project-references all three:

- **`shared/` (`@gts/shared`)** — the wire protocol (`shared/src/protocol.ts`), the single source of truth for everything exchanged over the WebSocket. **Emits** `.js` + `.d.ts` to `shared/dist`; both other packages import it as `@gts/shared`. It must be **built before** the others (the `predev` script and `build` order handle this).
- **`server/` (`@gts/server`)** — Fastify app, game engine (`server/src/game`), DB layer (`server/src/db`), WS handlers (`server/src/ws`), REST routes (`server/src/routes`). `nodenext`, **emits** to `server/dist`.
- **`client/` (`@gts/client`)** — Lit + Vite SPA, bundler-mode, `noEmit`. Vite builds it to `client/dist`.

## Commands

Run from the repo root (npm dispatches to the right workspace):

```bash
npm run dev          # shared(watch) + client(Vite) + server(tsx --watch) via concurrently (3 processes)
npm run dev:client   # Vite dev server only
npm run dev:server   # server only (tsx --watch); needs @gts/shared already built
npm run dev:shared   # tsc --watch on the shared protocol only
npm run build        # shared → client → client-empties-dist → server (order matters, see below)
npm run typecheck    # build shared, then tsc --noEmit on client + server
npm run lint         # eslint .
npm test             # vitest run (non-interactive)
npm run db:migrate   # apply migrations to the SQLite db (server workspace)
npm run db:reset     # drop + re-migrate
npm start            # node server/dist/index.js (serves built client + WS)
npm run preview      # Vite preview of the built client
```

Single test file: `npx vitest run server/test/foo.test.ts`. Single package build: `npm run build -w @gts/server`.

**Build order matters:** `@gts/shared` must build first (server + client import its emitted `dist`). The `build` script sequences `shared → client → server`; Vite's `client` build empties `client/dist`, and the server build is independent of it, so the ordering is really about shared-first.

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
- **Game engine (`server/src/game`).** `RoomRegistry` indexes active rooms by invite code and injects shared deps (word pool, `Scheduler` clock, persistence event sink) into each `Room`. `Room` owns **all** game state and outbound messages — the WS layer is a dumb transport adapter. Round state machine: `choosing → drawing → intermission`. The `Scheduler` is **injectable** (`FakeScheduler` in tests) so round/timer logic is deterministic.
- **WS handlers (`server/src/ws/handlers.ts`).** Each socket must send `join` first; on success it's bound to a room + session and further messages dispatch to `room.handleMessage(sessionId, msg)`. Inbound messages are validated by the **zod** schema in `ws/schema.ts` (`parseClientMessage`) at the trust boundary — malformed/invalid are rejected with an `error` message.
- **Persistence (`server/src/db`).** SQLite via **`better-sqlite3`** + **`kysely`** (typed query builder). WAL + FK pragmas, inline migrations, word seed. `createGameEventSink` chains ordered async writes off engine events and exposes `flush()` for tests/shutdown. Reads `DB_FILE` (default `<repo>/data/gts.db`, `:memory:` for ephemeral). Server code uses `nodenext` ESM — local imports carry `.js` specifiers that point at `.ts` sources; don't import client (bundler-mode) `.ts` files here.

## Shared protocol (`@gts/shared`)

- `shared/src/protocol.ts` is the **single source of truth** for the WS protocol: `ClientMessage`, `ServerMessage`, and the view types (`RoomView`, `PlayerView`, `RoundPublic`, …). Both client and server import it.
- **The server is authoritative and never leaks the secret word to non-drawers.** `RoundPublic` carries only `wordPattern` (blanks) + `wordLength`; the full `word` appears only in `roundEnd`. Preserve this invariant in any protocol or engine change.
- **The protocol is FROZEN (Phase 1f).** Any change to `protocol.ts` must be mirrored in the server's zod schema (`server/src/ws/schema.ts`). Treat protocol changes as "ask first".
- Stroke points are **normalised to 0..1** (resolution-independent) so the canvas can render at any size.

## Client (Phase 2 — to build)

Still the Vite/Lit demo. When building the real client, it must connect to the server's `/ws` explicitly (in dev the client is served by Vite on its own port, not by the Node server), speak the `@gts/shared` protocol, and support reconnection via the `sessionId` returned in `joined`.

## Config caveats

- **Dev = three processes.** `npm run dev` runs `@gts/shared` (tsc watch), `@gts/client` (Vite), and `@gts/server` (`tsx --watch`) in parallel via `concurrently`. `predev` builds shared once up front. In dev the client is served by Vite and connects to the server's `/ws`; only the production build (`npm start`) has the Node server serve `client/dist`.
- **Vitest resolves `.js` → `.ts`.** `vitest.config.ts` sets `resolve.extensionAlias` so the server's `nodenext` `.js` specifiers load their `.ts` sources under Vite. Tests live in `{shared,server}/test/**/*.test.ts` (`environment: node`). No client tests yet.

## Architecture & TypeScript

- **UI framework: Lit web components.** `LitElement` subclasses registered with `@customElement('tag-name')`; styles in a static `styles = css\`…\`` block (Shadow DOM–scoped); reactive state via `@property`/`@state`; templates via the `html\`…\`` tagged template. `index.html` mounts the root component as a custom-element tag.
- **TypeScript is strict everywhere.** `verbatimModuleSyntax` is on in all packages — use `import type { … }` for type-only imports. `noUnusedLocals`/`noUnusedParameters`, `erasableSyntaxOnly`, and `noFallthroughCasesInSwitch` are enforced across all tsconfigs.
- **Three module worlds.** Client (`client/tsconfig.json`) is **bundler-mode**, `noEmit`, `allowImportingTsExtensions` — Vite bundles it, local imports use `.ts` extensions. Server (`server/tsconfig.json`) and shared (`shared/tsconfig.json`) are **`nodenext`** and **emit** JS — local imports use `.js` specifiers pointing at `.ts` sources. Don't mix the two worlds.

## Conventions

- **Formatting (enforced by `@stylistic` ESLint + `.editorconfig`):** 2-space indent, **double quotes**, semicolons, LF line endings, trailing newline, no trailing whitespace. `npm run lint` is currently clean — keep it that way.
- **`no-unused-vars`** ignores identifiers matching `^[A-Z_]` (uppercase/underscore-prefixed).