# Guess The Scribble

A skribbl.io clone. Created with help with AI.

## Prerequisites

- **Node.js** 24+
- **PostgreSQL** 14+ running locally (or a remote instance)

## Quick start

```bash
# Install dependencies
npm install

# Create your local .env from the example and set credentials
cp .env.example .env
# Edit .env: set PGPASSWORD (and optionally PGUSER/DATABASE_URL)

# Start PostgreSQL (Docker required)
docker compose up -d

# Migrate + seed
npm run db:migrate

# Start dev servers (shared watch + Vite + server)
npm run dev
```

> **Credentials:** `PGUSER` and `PGPASSWORD` are passed as libpq environment
> variables — they are never embedded in `DATABASE_URL` or any committed file.
> The `pg` driver reads them automatically.

## Running tests
Start the PostgreSQL container and create the test database. The database (`gts_test`) is created automatically by
`docker/init-test-db.sql` when the Docker container first starts.

```bash
# Start PostgreSQL if not already running
docker compose up -d

# Run all tests — DATABASE_URL defaults to postgresql://localhost:5432/gts_test
# (vitest.config.ts); PGUSER/PGPASSWORD come from .env
npm test
```

## Reset the database

```bash
npm run db:reset   # drops all tables and re-migrates
```

## Production build (single deployable unit)

The client, server, and shared protocol are bundled into one deployable Node app under
a top-level `.release/` folder. The server serves the API, the `/ws` WebSocket, and the
built client bundle — no separate frontend host.

```bash
# Assemble .release/ (shared → client → server → .release/ + prod-only node_modules)
npm run build

# Boot the assembled app (uses the same command Heroku runs)
DATABASE_URL=postgresql://localhost:5432/gts npm start
# ↳ node .release/server/index.js
```

`.release/` layout: `.release/server`, `.release/client`, `.release/shared`, `.release/package.json`,
`.release/node_modules`. It is git-ignored and rebuilt from source every time.

## Deploying to Heroku

Single web dyno + Heroku Postgres add-on. The build hook `heroku-postbuild` runs
`npm run build`, which produces `.release/` and installs its production dependencies.
Heroku's default `npm start` then boots `node .release/server/index.js`.

```bash
heroku create <app-name>
heroku addons:create heroku-postgresql:essential-0
heroku config:set NODE_ENV=production
# Optional: force TLS on a non-Heroku Postgres (Heroku hosts auto-detect):
# heroku config:set DATABASE_SSL=true
git push heroku main
```

Config vars used at runtime:

| Var             | Source                          | Purpose                                        |
|-----------------|---------------------------------|------------------------------------------------|
| `DATABASE_URL`  | Heroku Postgres add-on          | PostgreSQL connection string                   |
| `PORT`          | Heroku                          | HTTP + WS listen port                          |
| `NODE_ENV`      | `production`                    | Standard Node env flag                         |
| `DATABASE_SSL`  | optional (`true`/`false`)       | Force TLS on the pg pool; auto for non-local   |
| `CLIENT_DIST`   | optional                        | Override the SPA bundle path (defaults to `.release/client`) |
| `PGUSER` / `PGPASSWORD` | libpq env vars          | DB credentials (never in `DATABASE_URL`)       |
