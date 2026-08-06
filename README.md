# guess-the-scribble

A skribbl.io clone.

## Prerequisites

- **Node.js** 20+
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

The test database (`gts_test`) is created automatically by `docker/init-test-db.sql`
when the Docker container first starts.

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
