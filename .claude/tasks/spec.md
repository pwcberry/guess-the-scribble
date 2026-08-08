# Spec: Guess the Scribble

> Status: **APPROVED** (2026-07-25). Gameplay updated: `round` = a full rotation (every
> player takes one turn as drawer), `turn` = one drawer's period. Decision: **rename in the
> protocol** so code and spec share this vocabulary (`round`→`turn` for the per-drawer
> concept; a new `round` grouping is added). See `plan.md` for the rename + round-feature plan.

## Objective

A real-time multiplayer web game in the Pictionary / skribbl.io tradition: one player
draws a secret word on a shared canvas while everyone else races to guess it in chat.
Fast, correct guesses score points; the drawer scores when players guess. A **round** is a
full rotation in which every player takes one turn as drawer (skribbl-style); the host picks
how many rounds a game runs. The game ends once all rounds are played, with a final scoreboard.

**Who it's for:** Small friend groups who want a quick, no-signup drawing game they can
start by sharing a link.

**What success looks like:**
- A host can create a private room and share an invite code/link in seconds.
- 2–8 anonymous players can join with just a nickname and play a full game.
- Drawing appears on every player's canvas in near real time (< ~150 ms perceived lag on a LAN/broadband).
- The secret word is never leaked to non-drawers over the wire (server-authoritative).
- A completed match (rooms, rounds, words, scores, final drawings) is persisted to the database.

## Tech Stack

| Layer            | Choice                                                                    |
|------------------|---------------------------------------------------------------------------|
| Language         | TypeScript (strict) on both server and client                             |
| Backend          | Fastify                                                                   |
| Real-time        | Native WebSockets via `@fastify/websocket`                                |
| Frontend         | Lit web components + vanilla HTML & CSS                                   |
| Client build     | Vite (dev server + production bundle)                                     |
| Server build     | `tsc` for prod, `tsx` for dev/watch                                       |
| Database         | SQLite (persistent, single file)                                          |
| DB driver        | `better-sqlite3` (synchronous, fast)                                      |
| Query/migrations | `kysely` with its built-in `SqliteDialect` (type-safe queries + migrator) |
| Testing          | Vitest (unit/integration) + Playwright (e2e)                              |
| Shared           | A `shared/` package holding wire-protocol types used by both ends         |
| Packaging        | Single deployable Node app — server serves API + WebSocket + built client |
| Hosting          | Heroku (single web dyno) + Heroku Postgres add-on                         |

**Rationale for native WebSockets:** matches the vanilla ethos, no extra client
dependency, and the message set here is small enough to hand-define with shared TS types.

**Rationale for SQLite:** zero-service dependency — the whole database is one file, so dev
and prod need no separate database process. `better-sqlite3` is synchronous and extremely
fast for the small, frequent reads/writes a game server makes, which keeps the game engine
simple (no connection pool, no async DB round-trips in hot paths). `kysely` layers
end-to-end type safety and a migration runner on top without the weight of a full ORM.

### Recommended Node.js libraries

| Concern            | Library                    | Why                                                          |
|--------------------|----------------------------|-------------------------------------------------------------|
| HTTP + lifecycle   | `fastify`                  | Chosen framework; fast, TS-first, plugin ecosystem.         |
| WebSockets         | `@fastify/websocket`       | Official native-WS plugin; integrates with Fastify routes.  |
| Static/dev serving | `@fastify/static`          | Serve the built client bundle in production.                |
| SQLite driver      | `better-sqlite3`           | Synchronous, fast, battle-tested; ideal for low-latency game state. |
| Queries + migration| `kysely`                   | Type-safe query builder + built-in migrator; SqliteDialect. |
| Schema validation  | `zod` (+ `fastify-type-provider-zod`) | Validate HTTP bodies and inbound WS messages at the boundary. |
| Invite codes / ids | `nanoid`                   | Short, URL-safe room codes and ids.                         |
| Dev runner         | `tsx`                      | Run/watch TS server without a separate build step in dev.   |
| Concurrent dev     | `concurrently`             | Run server + client dev processes together.                 |
| Client build/dev   | `vite`                     | Fast dev server + production bundling for Lit/TS.           |
| Test runner        | `vitest`                   | Vite-native, TS-first; unit + integration.                  |
| E2E                | `@playwright/test`         | Multi-context browser tests (drawer vs guesser).            |
| Lint / format      | `eslint` + `typescript-eslint` + `prettier` | Consistent style, type-aware linting.      |

> Note: Node 22+ ships an experimental built-in `node:sqlite`. We deliberately prefer
> `better-sqlite3` for stability and the mature `kysely` SqliteDialect integration; revisit
> when `node:sqlite` is stable.

## Commands

_(Proposed — finalized during Plan/scaffold. Workspace uses npm workspaces.)_

```
Install:      npm install
Dev (all):    npm run dev            # server (tsx watch) + client (vite) concurrently
Dev server:   npm run dev -w server
Dev client:   npm run dev -w client
Build:        npm run build          # tsc server + vite build client
Typecheck:    npm run typecheck      # tsc --noEmit across workspaces
Lint:         npm run lint           # eslint . ; --fix to autofix
Test:         npm test               # vitest run
Test (watch): npm run test:watch
E2E:          npm run test:e2e       # playwright test
DB migrate:   npm run db:migrate
DB reset:     npm run db:reset
```

## Project Structure

```
guess-the-scribble/
├─ server/                  → Fastify app
│  ├─ src/
│  │  ├─ index.ts           → server bootstrap
│  │  ├─ ws/                → WebSocket handler + connection registry
│  │  ├─ game/              → game engine (rooms, rounds, scoring, timers)
│  │  ├─ db/                → connection, queries, migrations
│  │  ├─ routes/            → HTTP routes (create room, health, word lists)
│  │  └─ words/             → word-list loading/selection
│  └─ tests/
├─ client/                  → Lit + Vite frontend
│  ├─ src/
│  │  ├─ components/        → Lit web components (canvas, chat, lobby, scoreboard…)
│  │  ├─ net/              → WebSocket client + reconnection
│  │  ├─ state/           → client-side game state store
│  │  └─ styles/          → shared vanilla CSS
│  ├─ index.html
│  └─ tests/
├─ shared/                  → wire-protocol types + shared constants (no runtime deps)
│  └─ src/protocol.ts       → discriminated-union message types (client↔server)
├─ e2e/                     → Playwright specs
├─ .claude/tasks/           → spec.md, plan.md, todo.md
└─ package.json             → npm workspaces root
```

## Core Gameplay & Rules

**Room lifecycle**
1. Host `POST /api/rooms` → server creates a room, returns a short invite code + link.
2. Players open the link, enter a nickname, and connect via WebSocket (anonymous;
   identity is a client-stored `sessionId` scoped to the browser).
3. Host configures settings (number of rounds, draw time, max players) and starts the game.
   The round count is host-chosen (minimum 1); every player draws once per round.

**Terminology.** A **turn** is a single drawer's period: they draw one word while everyone
else guesses. A **round** is a full rotation — one turn per player. A game runs a
host-configured number of rounds, so with `R` rounds and `P` players each player draws `R`
times over `R × P` turns total.

> Note: the shipped Phase 0–2 code currently uses `round` for what this spec now calls a
> **turn** (`RoundPublic`, `roundStart`/`roundEnd`, the `rounds` table). We are **renaming in
> the protocol** so code matches this vocabulary — `turn` for the per-drawer concept, with a
> new `round` grouping (rotation) added on top. Tracked in `plan.md`.

**Game loop** — run the configured number of **rounds**; each round is one full rotation of
**turns** (one per player, fixed order). The game ends when the final turn of the final round
completes, then shows the scoreboard.

**Turn loop** (repeats for each player within a round; drawer rotates)
1. Server picks the next drawer and offers them 3 candidate words; drawer chooses one.
2. Server broadcasts turn start (word length/blanks to guessers; full word only to drawer).
3. Drawer draws; stroke events are relayed to all players in the room in real time.
4. Guessers submit guesses in chat. The **server** compares each guess to the secret word.
   - Correct → player is marked as having guessed; awarded points on a time-decay curve;
     their guess is hidden from others (shown as "guessed the word!").
   - Incorrect → shown to the room as normal chat.
5. Turn ends when time expires or all guessers have guessed. Reveal the word; show
   turn scores; drawer earns points scaled by how many guessed.
6. Persist the turn (drawer, word, final drawing snapshot, per-player results).

**Players leaving mid-game.** The round count is fixed at game start and does not change if
players leave; the game plays out all configured rounds, and each round's rotation skips
players who have left. If the room drops below 2 present players, the game cannot continue
and ends early at the current scoreboard.

**Scoring** (initial model, tunable)
- Guessers: base points scaled by remaining time when they guessed (earlier = more).
- Drawer: fixed points per guesser who got it, capped.

**Anti-cheat boundary:** The secret word and full stroke authority live on the server.
Non-drawers receive only blanks/length. Guess correctness is decided server-side.

**Reconnection:** a dropped player may rejoin an in-progress game using their stored
`sessionId`. On reconnect the server resends current room/round state (and, if they are the
active drawer, their word) so play resumes seamlessly. Their score and role are preserved.

**Drawings** are persisted as a **replayable stroke list** (JSON) — enabling round replay
and a potential gallery later. No PNG rasterization in v1.

**Word list:** a built-in **English-only** word list is seeded into the `words` table. No
custom/room-provided lists in v1.

## Wire Protocol (WebSocket)

Single WebSocket per player per room. Messages are JSON with a `type` discriminator,
defined once in `shared/src/protocol.ts` and imported by both ends.

Representative message types (non-exhaustive; finalized in Plan). Per-drawer messages use
**`turn`** vocabulary; **`round`** = a full rotation, **`gameEnd`** fires after the last turn
of the last round:
- Client→Server: `join`, `chooseWord`, `draw` (stroke segment), `clearCanvas`, `undo`,
  `guess`, `startGame`, `leave`.
- Server→Client: `roomState`, `playerJoined`/`playerLeft`, `turnStart` (carries `TurnPublic`
  with the current round ordinal + total rounds), `wordChoices` (drawer only), `drawBroadcast`,
  `guessResult`, `chat`, `turnEnd`, `gameEnd`, `error`.

## Data Model (SQLite)

Anonymous but persistent — one SQLite file. JSON columns are stored as `TEXT` and
(de)serialized in the query layer. Sketch (finalized in Plan):
- `rooms` — id, invite_code, settings (TEXT/JSON), status, created_at.
- `games` — id, room_id, started_at, ended_at, round_count (rotations), turn_count (drawers cycled).
- `turns` — id, game_id, round_ordinal, drawer_nickname, word, drawing (TEXT/JSON — replayable stroke list), ordinal (global turn index).
- `turn_results` — turn_id, nickname, guessed_at, points.
- `players` — session-scoped identity within a game: game_id, session_id, nickname, total_score.
- `words` — word, category/difficulty (seeded word list).

SQLite pragmas set at startup: `journal_mode = WAL` (concurrent readers during writes) and
`foreign_keys = ON`.

**DB file location (decided):** path comes from an env var (default `./data/gts.db`); the
test suite uses `:memory:`. No backup mechanism in v1.

## Code Style

Strict TypeScript, no `any`; wire types shared, never redefined per side. Lit components
use decorators + typed reactive properties. Example:

```ts
import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { PlayerState } from '@gts/shared';

@customElement('gts-scoreboard')
export class Scoreboard extends LitElement {
  static styles = css`
    :host { display: block; }
    .row { display: flex; justify-content: space-between; }
    .row[data-drawer] { font-weight: 600; }
  `;

  @property({ type: Array }) players: PlayerState[] = [];

  render() {
    return html`
      ${this.players.map(
        (p) => html`
          <div class="row" ?data-drawer=${p.isDrawer}>
            <span>${p.nickname}</span><span>${p.score}</span>
          </div>
        `,
      )}
    `;
  }
}
```

Conventions: `kebab-case` custom-element tags prefixed `gts-`; `camelCase` vars/functions;
`PascalCase` types/classes. Server modules are small and single-purpose. Formatting via
Prettier; linting via ESLint (typescript-eslint).

## Testing Strategy

- **Unit (Vitest):** game engine (scoring, round rotation, timer expiry, guess matching),
  word selection, protocol serialization. Pure functions where possible.
- **Integration (Vitest):** WebSocket flows against a running Fastify instance (join →
  draw → guess → round end); DB queries against a test database.
- **E2E (Playwright):** two browser contexts play a full round — one draws, one guesses,
  score updates, word reveals.
- **Coverage target:** ≥ 80% on `server/src/game/**` (the rules engine); best-effort elsewhere.

## Boundaries

- **Always:** run `npm run typecheck` + `npm test` before commits; keep wire types in
  `shared/`; keep the secret word server-side; validate all client input server-side.
- **Ask first:** adding dependencies; DB schema/migration changes; changing the WS
  protocol shape; introducing accounts/auth; adding infra (Redis, queues).
- **Never:** commit secrets or DB credentials; trust client-reported scores or correctness;
  send the secret word to non-drawers; delete/skip failing tests without approval.

## Deployment

Packaged as a **single Node application deployed to Heroku** (one web dyno). The server
(`@gts/server`) serves the JSON API, the WebSocket endpoint (`/ws`), *and* the built client
bundle from `client/dist` via `@fastify/static`. There is no separate frontend host — the
client, server, and shared protocol are bundled into one deployable unit.

**Runtime shape**
- One process: `node deploy/server/index.js` (the root `npm start` points at the
  `deploy/` tree). Server code continues to run as plain Node ES modules (`nodenext`); no
  bundler is applied to it.
- Heroku Postgres provides `DATABASE_URL`; the app reads it directly (`server/src/db/connection.ts`),
  enables TLS when the URL points at Heroku (`sslmode=require` or `DATABASE_SSL=true`), and
  runs `runMigrations` + `seedWords` on boot so a fresh dyno is playable immediately.
- Heroku sets `PORT` and expects the app to bind `0.0.0.0`; already handled by
  `server/src/index.ts`.
- The client is a static SPA. In production it is served from the same origin as the API,
  so the client's WebSocket URL is derived from `window.location` (`wss:` under HTTPS,
  `ws:` otherwise) at `/ws` — no build-time server URL is baked in. Dev keeps Vite on its
  own port, pointing at `ws://localhost:3000/ws`.

**Deploy artifact layout.** All production-ready output is assembled into a single
top-level `deploy/` folder at the repo root — this is the deployable unit that Heroku (and
`npm start` locally) executes. The `build` pipeline emits into it directly (or copies each
workspace's `dist/` into it as a final step) so nothing outside `deploy/` and its
`node_modules` is required at runtime:

```
deploy/
├─ server/          → compiled server (from server/src → server/dist → deploy/server)
├─ client/          → built client bundle (Vite output → deploy/client)
├─ shared/          → compiled shared protocol (.js + .d.ts)
├─ package.json     → runtime manifest (production deps, "start": "node server/index.js",
│                     "engines.node")
└─ node_modules/    → production-only install
```

The root `npm start` becomes `node deploy/server/index.js`; `CLIENT_DIST` defaults to
`deploy/client`. `deploy/` is git-ignored and rebuilt from source on every deploy /
`npm run build`.

**Build pipeline (Heroku `heroku-postbuild`)**
1. `npm ci` (Heroku runs this before the postbuild hook; dev dependencies must be available
   because we compile TypeScript and bundle the client). Set `NPM_CONFIG_PRODUCTION=false`
   or keep the toolchain (`typescript`, `vite`, `@vitejs/plugin-*`) in `dependencies` for
   the workspaces that need them so the build step has what it needs.
2. `npm run build` — builds in order: `@gts/shared` (tsc), `@gts/client` (Vite),
   `@gts/server` (tsc), then assembles the top-level `deploy/` folder (server + client +
   shared + a slimmed runtime `package.json`). Build order is unchanged.
3. Heroku prunes dev dependencies after the postbuild hook; the runtime slug carries the
   `deploy/` tree and production `node_modules`.
4. Release / boot: `npm start` runs `node deploy/server/index.js`, which migrates the
   database and listens on `$PORT`.

**Local execution parity.** The same artifacts run locally with no Heroku-specific glue:

```
npm ci
npm run build
DATABASE_URL=postgresql://localhost:5432/gts npm start
```

Dev mode (`npm run dev`) is unchanged: shared watch + Vite + `tsx --watch` in three
processes, with the client hitting `ws://localhost:3000/ws`.

**Required code / config changes to land this**
- **Server static serving.** `buildApp()` already registers `@fastify/static` and an SPA
  fallback when `clientDist` exists. `server/src/index.ts` must resolve `CLIENT_DIST`
  relative to the compiled server so the path works from Heroku's slug root
  (`deploy/server` → `../client`). Add a startup log if the directory is missing so a
  mis-configured deploy fails loudly.
- **Client → server WS URL.** `client/src/net/ws-client.ts` must construct the WS URL from
  `window.location` in production. Support an optional `VITE_WS_URL` override for
  non-default local setups; default to `${wsProto}//${location.host}/ws`.
- **Server code stays Node modules.** Server continues to compile with `tsc` under
  `nodenext`; do **not** bundle it. Local `.js` specifiers pointing at `.ts` sources are
  preserved. `@gts/shared` is consumed via its emitted `dist` through the npm-workspace
  symlink, which Heroku preserves.
- **TypeScript config.**
  - `shared/tsconfig.json`: unchanged (emits `dist` + `.d.ts`).
  - `server/tsconfig.json`: ensure `outDir: server/dist`, `rootDir: server/src`,
    `module`/`moduleResolution: nodenext`, `sourceMap: true` for prod debugging, and
    `declaration: false` (server is not consumed as a library).
  - `client/tsconfig.json`: stays bundler-mode, `noEmit`; Vite performs the transpile.
    Add a `client/tsconfig.node.json` reference only if `vite.config.ts` needs it.
  - Root `tsconfig.json`: keep project references so `npm run typecheck` covers all three.
- **`package.json` scripts.**
  - Add `"heroku-postbuild": "npm run build"` at the repo root so Heroku produces the
    slug artifacts.
  - Add `"engines": { "node": ">=22" }` at the repo root to pin Heroku's Node stack.
  - Keep `"start": "node server/dist/index.js"` — Heroku uses it by default; no `Procfile`
    required (add one only if we later need a `release` phase for migrations).
- **Database connection.** `server/src/db/connection.ts` must enable TLS when
  `DATABASE_URL` targets Heroku (`ssl: { rejectUnauthorized: false }` when the URL host is
  not localhost, or gated on `DATABASE_SSL=true`). Migrations still run on boot; a Heroku
  `release` phase remains optional.
- **Env vars on Heroku.** `DATABASE_URL` (auto-set by the Heroku Postgres add-on), `PORT`
  (auto-set), `NODE_ENV=production`, optional `DATABASE_SSL=true`, optional `CLIENT_DIST`
  override.

**Non-goals for this deployment iteration.** No Docker image, no multi-service compose, no
CDN in front of the static assets. Docker/Compose remain available for local Postgres in
development only (see `docker-compose.yaml`).

## Success Criteria (testable)

1. `POST /api/rooms` returns a unique invite code; opening the link + entering a nickname connects via WS.
2. A drawer's strokes render on a second player's canvas within one animation frame of receipt.
3. A correct guess is detected server-side, scored on the time curve, and hidden from other players' chat.
4. An incorrect guess appears as normal chat to the room.
5. A game runs the host-configured number of rounds (≥ 1), each round a full rotation of one turn per player; once the final round's last turn completes the game ends, a final scoreboard is shown, and the completed game (turns, words, results) exists in the database.
6. A non-drawer client never receives the secret word before the turn ends (verifiable in captured WS traffic).
7. `npm run build`, `npm run typecheck`, and `npm test` all pass clean.

## Open Questions

_All resolved for v1:_
- **DB:** SQLite (`better-sqlite3` + `kysely`); file path from env var (`./data/gts.db`), `:memory:` for tests.
- **Drawing persistence:** replayable stroke JSON (no PNG).
- **Reconnection:** dropped players may rejoin an in-progress game via `sessionId`.
- **Word list:** built-in English-only list.
- **Hosting:** Heroku (single web dyno running the compiled Node server, which also
  serves the built client) + Heroku Postgres add-on for `DATABASE_URL`.

- **`round`/`turn` naming (RESOLVED 2026-07-25):** rename in the protocol — `turn` for the
  per-drawer concept (was `round`), plus a new `round` = full-rotation grouping and a
  game-end-after-N-rounds condition. This is a deliberate change to the previously FROZEN
  protocol; the rename + round feature are planned in `plan.md`.
```
