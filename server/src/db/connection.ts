import pg from "pg";
import { Kysely, PostgresDialect } from "kysely";
import type { Database as DB } from "./schema.js";

export type Db = Kysely<DB>;

// PostgreSQL returns bigint (OID 20) as strings by default to avoid 64-bit
// precision loss. Our bigint columns are epoch-millisecond timestamps, all
// safely within Number.MAX_SAFE_INTEGER, so we parse them back to numbers.
pg.types.setTypeParser(20, (val: string) => Number(val));

const DEFAULT_URL = "postgresql://localhost:5432/gts";

/**
 * Return the PostgreSQL connection URL. `DATABASE_URL` should contain only the
 * host, port, and database name — **no credentials**. The `pg` driver
 * automatically merges `PGUSER` and `PGPASSWORD` from the environment when
 * those fields are absent from the URL, keeping secrets out of the connection
 * string entirely.
 *
 * Examples:
 *   DATABASE_URL=postgresql://localhost:5432/gts        (dev)
 *   DATABASE_URL=postgresql://localhost:5432/gts_test   (tests, see vitest.config.ts)
 *   PGUSER=scribbler  PGPASSWORD=…                      (both environments)
 */
export function connectionUrl(): string {
  return process.env.DATABASE_URL ?? DEFAULT_URL;
}

/**
 * Open a PostgreSQL connection pool and wrap it in a typed Kysely instance.
 * Credentials (`PGUSER`, `PGPASSWORD`) are read from the environment by the
 * `pg` driver automatically — they must not be embedded in `url`.
 * Call `db.destroy()` to drain the pool when done.
 */
export function createDb(url: string = connectionUrl()): Db {
  const pool = new pg.Pool({ connectionString: url });
  return new Kysely<DB>({ dialect: new PostgresDialect({ pool }) });
}
