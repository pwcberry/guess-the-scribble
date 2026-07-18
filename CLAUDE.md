# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`guess-the-scribble` is a **skribbl.io clone** (a real-time multiplayer drawing-and-guessing game). It is **early scaffold** stage: the client is still the generated Vite + Lit demo (`src/my-element.ts`), and `src/server.ts` is a minimal transport skeleton (static file serving + a WebSocket relay) with **no game rules yet**. Treat the game itself as greenfield: the drawing canvas, rooms/players, turn & word selection, scoring, and the real message protocol all still need building.

## Commands

```bash
npm run dev          # run client + server together (concurrently), see caveat below
npm run dev:client   # Vite dev server only (client)
npm run dev:server   # tsx --watch src/server.ts only (server), needs .env + src/server.ts
npm run build        # build:client then build:server → dist/
npm run build:client # tsc typecheck + vite build → dist/
npm run build:server # tsc -p tsconfig.server.json → dist/server/
npm run preview      # serve the built client with Vite
npm run publish      # build everything, then node dist/server/server.js
npx eslint .         # lint (no npm script wired up yet)
npx vitest           # run tests (see caveat below)
npx vitest run test/foo.test.ts   # run a single test file
```

The app is a **client/server split**: the Vite-built client lives in `dist/`, the compiled Node server (from `src/server.ts` via `tsconfig.server.json`) lives in `dist/server/` and serves that client plus the WebSocket game endpoint. **`build` order matters** — `build:client` (Vite) empties `dist/`, so it must run *before* `build:server`; the `build` script already sequences them that way.

## Before every commit

**Always run lint and the unit tests before committing, and only commit if both pass:**

```bash
npx eslint .     # must be clean — no errors
npx vitest run   # must pass — non-interactive run (not watch mode)
```

Fix any failures before committing rather than committing around them. Do not commit with a failing or skipped lint/test step.

## Server (src/server.ts)

- Plain `node:http` static server + a `ws` `WebSocketServer` on the same port at path `/ws`. Serves `dist/` (with an SPA fallback to `index.html` for extension-less routes) and **relays** `draw`/`clear`/`chat` messages to all *other* connected clients. There is **no game state, no rooms, no validation** beyond ignoring malformed JSON — that's the next layer to build.
- Compiled with `tsconfig.server.json` (`nodenext` modules, **emit on**, out to `dist/server/`). Unlike the client config it does **not** set `allowImportingTsExtensions`, so server imports use normal Node ESM resolution — don't import client `.ts` files (bundler-mode) into the server.
- Reads `PORT` from the environment (`.env`, loaded via `--env-file` in dev; default 3000). `.env` is gitignored — see `.env.example`.

## Config caveats

- **Dev = two processes.** `npm run dev` runs Vite (client) and `tsx --watch src/server.ts` (server) in parallel via `concurrently`. In dev the client is served by Vite on its own port and must connect to the server's `/ws` explicitly; only the production `dist/` build is served by the Node server itself.
- **`vitest.config.ts` expects a `test/` directory** (`include: ["./test/**/*.ts"]`, `globalSetup: ["./test/globalSetup.ts"]`) that doesn't exist yet. Create `test/` and `test/globalSetup.ts` before writing tests.

## Architecture

- **UI framework: Lit web components.** Components are `LitElement` subclasses registered with `@customElement('tag-name')`, styles live in a static `styles = css\`...\`` block (Shadow DOM–scoped), reactive state uses `@property`/`@state`, templates use the `html\`...\`` tagged template. `index.html` mounts the root component directly as a custom element tag.
- **TypeScript is strict.** `verbatimModuleSyntax` is on everywhere, so use `import type { … }` for type-only imports. `noUnusedLocals`/`noUnusedParameters` and `erasableSyntaxOnly` are enforced across all three tsconfigs.
- **Two module worlds.** The **client** (`tsconfig.app.json`) is bundler-mode with `noEmit` + `allowImportingTsExtensions` — Vite bundles it, and local imports use `.ts` extensions. The **server** (`tsconfig.server.json`) is `nodenext` and actually **emits** JS to `dist/server/`. `tsconfig.node.json` typechecks `vite.config.ts` only.

## Conventions

- **Formatting (enforced by `@stylistic` ESLint + `.editorconfig`):** 2-space indent, **double quotes**, semicolons, LF line endings, trailing newline, no trailing whitespace. `npx eslint .` is currently clean — keep it that way.
- **`no-unused-vars`** ignores identifiers matching `^[A-Z_]` (uppercase/underscore-prefixed).