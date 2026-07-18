# Spec: Guess the Scribble

> Status: **DRAFT — awaiting human review** (Phase 1 of spec-driven workflow).
> Do not advance to Plan until this is approved.

## Objective

A real-time multiplayer web game in the Pictionary / skribbl.io tradition: one player
draws a secret word on a shared canvas while everyone else races to guess it in chat.
Fast, correct guesses score points; the drawer scores when players guess. The drawer
rotates each round; after a set number of rounds the game ends with a final scoreboard.

**Who it's for:** Small friend groups who want a quick, no-signup drawing game they can
start by sharing a link.

**What success looks like:**
- A host can create a private room and share an invite code/link in seconds.
- 2–8 anonymous players can join with just a nickname and play a full game.
- Drawing appears on every player's canvas in near real time (< ~150 ms perceived lag on a LAN/broadband).
- The secret word is never leaked to non-drawers over the wire (server-authoritative).
- A completed match (rooms, rounds, words, scores, final drawings) is persisted to the database.

## Tech Stack

| Layer      | Choice                                                            |
|------------|-------------------------------------------------------------------|
| Language   | TypeScript (strict) on both server and client                     |
| Backend    | Fastify                                                            |
| Real-time  | Native WebSockets via `@fastify/websocket`                        |
| Frontend   | Lit web components + vanilla HTML & CSS                            |
| Client build | Vite (dev server + production bundle)                            |
| Server build | `tsc` for prod, `tsx` for dev/watch                             |
| Database   | SQLite (persistent, single file)                                  |
| DB driver  | `better-sqlite3` (synchronous, fast)                              |
| Query/migrations | `kysely` with its built-in `SqliteDialect` (type-safe queries + migrator) |
| Testing    | Vitest (unit/integration) + Playwright (e2e)                      |
| Shared     | A `shared/` package holding wire-protocol types used by both ends  |
| Packaging  | Docker — multi-stage build, single image serving API + built client |

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
3. Host configures settings (rounds, draw time, max players) and starts the game.

**Round loop** (repeats until `rounds` complete; drawer rotates)
1. Server picks the next drawer and offers them 3 candidate words; drawer chooses one.
2. Server broadcasts round start (word length/blanks to guessers; full word only to drawer).
3. Drawer draws; stroke events are relayed to all players in the room in real time.
4. Guessers submit guesses in chat. The **server** compares each guess to the secret word.
   - Correct → player is marked as having guessed; awarded points on a time-decay curve;
     their guess is hidden from others (shown as "guessed the word!").
   - Incorrect → shown to the room as normal chat.
5. Round ends when time expires or all guessers have guessed. Reveal the word; show
   round scores; drawer earns points scaled by how many guessed.
6. Persist the round (drawer, word, final drawing snapshot, per-player results).

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

Representative message types (non-exhaustive; finalized in Plan):
- Client→Server: `join`, `chooseWord`, `draw` (stroke segment), `clearCanvas`, `undo`,
  `guess`, `startGame`, `leave`.
- Server→Client: `roomState`, `playerJoined`/`playerLeft`, `roundStart`, `wordChoices`
  (drawer only), `drawBroadcast`, `guessResult`, `chat`, `roundEnd`, `gameEnd`, `error`.

## Data Model (SQLite)

Anonymous but persistent — one SQLite file. JSON columns are stored as `TEXT` and
(de)serialized in the query layer. Sketch (finalized in Plan):
- `rooms` — id, invite_code, settings (TEXT/JSON), status, created_at.
- `games` — id, room_id, started_at, ended_at, round_count.
- `rounds` — id, game_id, drawer_nickname, word, drawing (TEXT/JSON — replayable stroke list), ordinal.
- `round_results` — round_id, nickname, guessed_at, points.
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

Packaged as a **Docker** image via a multi-stage build:
1. Build stage: install deps, build `client` (Vite) and `server` (tsc).
2. Runtime stage: slim Node base, production deps only, Fastify serves the API + WebSocket
   and the built client via `@fastify/static`.

Configuration via env vars (DB file path, port, etc.). The SQLite file lives on a mounted
volume so data survives container restarts. A `docker-compose.yml` wires the app to that
volume for local/prod parity. `better-sqlite3` is a native module — the build stage must
compile it against the runtime image's Node/platform (build in the same base image).

## Success Criteria (testable)

1. `POST /api/rooms` returns a unique invite code; opening the link + entering a nickname connects via WS.
2. A drawer's strokes render on a second player's canvas within one animation frame of receipt.
3. A correct guess is detected server-side, scored on the time curve, and hidden from other players' chat.
4. An incorrect guess appears as normal chat to the room.
5. After the configured number of rounds, a final scoreboard is shown and the completed game (rounds, words, results) exists in the database.
6. A non-drawer client never receives the secret word before the round ends (verifiable in captured WS traffic).
7. `npm run build`, `npm run typecheck`, and `npm test` all pass clean.

## Open Questions

_All resolved for v1:_
- **DB:** SQLite (`better-sqlite3` + `kysely`); file path from env var (`./data/gts.db`), `:memory:` for tests.
- **Drawing persistence:** replayable stroke JSON (no PNG).
- **Reconnection:** dropped players may rejoin an in-progress game via `sessionId`.
- **Word list:** built-in English-only list.
- **Hosting:** Docker (multi-stage image, SQLite on a mounted volume).

No open questions remain — spec is ready for approval.
```
