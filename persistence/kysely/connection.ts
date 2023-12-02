import Pool from "pg-pool";
import { Kysely, PostgresDialect } from "kysely";
import "std/dotenv/load.ts";
import type { DB } from "./type.ts";

const dialect = new PostgresDialect({
  pool: new Pool({
    connectionString: Deno.env.get("DATABASE_URL"),
    max: Number(Deno.env.get("DATABASE_MAX_CONNECTIONS")) || 10,
  }),
});

// Database interface is passed to Kysely's constructor, and from now on, Kysely
// knows your database structure.
// Dialect is passed to Kysely's constructor, and from now on, Kysely knows how
// to communicate with your database.
export const db = new Kysely<DB>({
  dialect,
});
