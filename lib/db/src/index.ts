import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Supabase and most hosted Postgres require SSL
  ssl: { rejectUnauthorized: false },
  // Abort connection attempts that hang
  connectionTimeoutMillis: 10_000,
  // Kill idle connections after 30 s
  idleTimeoutMillis: 30_000,
  // Cancel any query that takes longer than 15 s
  statement_timeout: 15_000,
  // Max pool size — keep low on free-tier instances
  max: 5,
});

pool.on("error", (err) => {
  // Surface pool-level errors so they show in Render logs
  console.error("[DATABASE] Pool error:", err.message, err.stack);
});

export const db = drizzle(pool, { schema });

/** Lightweight connectivity probe — resolves with latency or an error string. */
export async function testDbConnection(): Promise<{
  ok: boolean;
  latencyMs?: number;
  error?: string;
}> {
  const start = Date.now();
  let client: pg.PoolClient | undefined;
  try {
    client = await pool.connect();
    await client.query("SELECT 1");
    return { ok: true, latencyMs: Date.now() - start };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  } finally {
    client?.release();
  }
}

export * from "./schema";
