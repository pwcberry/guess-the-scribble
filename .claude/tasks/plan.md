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

---

# Change Request (2026-07-25): `round`→`turn` rename + real `round` grouping

> Spec-driven **Plan** for the approved gameplay change (spec §Objective, §Core Gameplay,
> §Open Questions "RESOLVED 2026-07-25"). **Status: DRAFT — awaiting review.** Do not start
> implementation until approved. New tasks live in `todo.md` under "Phase R".

## What changes (semantics)

Today the code's `round` = **one drawer's turn**, and `settings.rounds` = **number of turns**
— so with 5 players and `rounds: 3`, only 3 players ever draw. The approved model:

- **turn** = one drawer's period (choose word → draw → reveal). *(what code calls `round` now)*
- **round** = a full rotation — one turn per present player.
- `settings.rounds` = number of **rounds (rotations)**; total turns = `rounds × players`.
- Every player draws once per round; the game ends after the **last turn of the last round**.
- **Leaving:** round count is fixed at game start; each round's rotation is recomputed from
  present players (departed players skipped, late joiners included from the next round). If
  present players drop **below 2**, the game ends early at the current scoreboard.

This is a deliberate change to the previously **FROZEN** protocol (approved).

## Protocol design (shared/src/protocol.ts)

Mechanical renames + a small feature addition:

| Now (`round` = turn) | After |
|----------------------|-------|
| `RoundPhase`         | `TurnPhase` |
| `RoundPublic`        | `TurnPublic` |
| `RoundResult`        | `TurnResult` |
| `RoomView.round`     | `RoomView.turn` |
| msg `roundStart { round }` | msg `turnStart { turn }` |
| msg `roundEnd`       | msg `turnEnd` |
| `RoundPublic.ordinal` (turn #) | `TurnPublic.turnOrdinal` (global turn index — canvas reset key) |
| `RoundPublic.totalRounds` (= total turns) | `TurnPublic.roundOrdinal` + `TurnPublic.totalRounds` (rotations) |

- `settings.rounds` **keeps its name** (now means rotations); limits unchanged (min 1, max 10,
  default 3). `gameEnd` unchanged (fires after the final turn of the final round).
- **Recommendation:** no separate `roundEnd`/rotation-boundary wire message in v1 — the HUD
  shows "Round X / Y" from `turnStart`. (Flag if you want a round-transition beat.)
- **zod (`ws/schema.ts`):** inbound `ClientMessage`s carry no round/turn fields, so the
  validator needs **no change** — the CLAUDE.md "mirror protocol in zod" rule is satisfied.

## Engine (server/src/game)

- `round.ts` → `turn.ts`: `Round` class → `Turn`; add `roundOrdinal` to each turn.
- `room.ts`: track `turnOrdinal` (global) **and** `roundOrdinal`; build each round's drawer
  order from present players; advance turn → when a rotation completes, advance round; end the
  game after `settings.rounds` rounds; below-2-players early end. Update emitted `TurnPublic`.
- `events.ts`: internal sink events `roundEnded`→`turnEnded` (+ carry `roundOrdinal`).
- `settings.ts`: doc-comment only (semantics), limits unchanged.

## Persistence (server/src/db)

- `schema.ts`: `rounds`→`turns` (add `round_ordinal`, `ordinal`=global turn index),
  `round_results`→`turn_results` (`round_id`→`turn_id`); `games` add `turn_count`
  (keep `round_count` = rotations).
- `migrations.ts`: forward migration renaming tables/columns + new columns. Dev-only data;
  `db:reset` remains the escape hatch.
- `games.ts`, `persistence.ts`: update inserts/queries + Kysely `Database` types.

## Client (client/src) — match the protocol

`store.ts` (`TurnPublic`, `turn`, reset on `turnOrdinal`, `lastTurn` reveal, `myWord`
lifecycle keyed off turn); `gts-hud.ts` ("Round X/Y" from `roundOrdinal`/`totalRounds`);
`gts-canvas.ts` (reset key → `turnOrdinal`); `gts-lobby.ts` / `gts-join.ts` /
`settings-presets.ts` (settings label stays "Rounds"); `gts-chat`, `gts-scoreboard`,
`gts-game-over`; and all `client/test/**` updated to the new names.

## PR strategy — **DECIDED: Option B (two PRs — feature, then rename)**

The rename is inherently atomic (a discriminated-union `type` string is a runtime value, so
no shim keeps both sides green across two PRs), so **PR-R2 exceeds the 25-file cap** — an
explicit, one-time cap exception for a mechanical rename, agreed 2026-07-25.

**PR-R1 — round-grouping feature, keeping today's `round`=turn names (green, ≤~15 files).**
The interim naming stays clean because `settings.rounds` keeps its name and, once it means
*rotations*, is already the correct total:
- `settings.rounds` meaning → **rotations** (name, limits, default 3 unchanged).
- `RoundPublic.ordinal` stays = **global turn index** (canvas reset key) — unchanged.
- `RoundPublic.totalRounds` stays = `settings.rounds` = number of rotations — now the correct
  "Y" in "Round X / Y" with no wire change.
- **Add** `RoundPublic.rotationOrdinal` = current rotation (1..totalRounds) — the only new
  field. HUD shows `rotationOrdinal` / `totalRounds`.
- Engine: `settings.rounds × players` turns, per-rotation drawer order from present players,
  end after the last rotation, below-2 early end. (Interim engine var `roundOrdinal` = global
  turn counter; a `rotationOrdinal` is derived/tracked.)

**PR-R2 — mechanical rename (~38 files, cap exception).**
`RoundPhase`→`TurnPhase`, `RoundPublic`→`TurnPublic`, `RoundResult`→`TurnResult`,
`RoomView.round`→`turn`, `roundStart`→`turnStart`, `roundEnd`→`turnEnd`,
`RoundPublic.ordinal`→`turnOrdinal`, `rotationOrdinal`→`roundOrdinal`, engine `roundOrdinal`
var→`turnOrdinal`, `round.ts`→`turn.ts` (`Round`→`Turn`), DB `rounds`→`turns` /
`round_results`→`turn_results` / `round_id`→`turn_id` / add `round_ordinal`,`turn_count`,
plus `CLAUDE.md`. No behavior change; `tsc --noEmit` is the safety net.

## Verification (per task and at the end)

- `npm run lint` + `npm test` clean before each commit (CLAUDE.md).
- `npm run typecheck` green across all three packages (the rename's main safety net —
  the compiler flags every missed reference).
- A server engine test proving: N players + `rounds: R` ⇒ exactly `R × N` turns, everyone
  draws `R` times, `gameEnd` after the last turn; plus a below-2-players early-end test.
- Manual smoke: play a 2-player, 2-round game in the browser; HUD shows "Round 1/2"→"2/2".

## Risks

| Risk | Mitigation |
|------|------------|
| Missed reference in the 38-file rename | Lean on `tsc --noEmit`; grep for `round`/`Round` after; the union's `type` strings are caught by the zod/handler switch + tests. |
| DB rename breaks existing dev `data/gts.db` | Forward migration + `db:reset` escape hatch; no production data exists. |
| Off-by-one in round/turn counters (game ends too early/late) | Dedicated engine test asserting exact turn count = `rounds × players` and end timing. |
| `round_count`/`turn_count` meaning drift in persistence | Assert both in a persistence test for a known N players × R rounds game. |
