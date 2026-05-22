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
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10_000,
  idleTimeoutMillis: 30_000,
  statement_timeout: 15_000,
  max: 5,
});

pool.on("error", (err) => {
  console.error("[DATABASE] Pool error:", err.message, err.stack);
});

export const db = drizzle(pool, { schema });

/** Lightweight connectivity probe */
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

/**
 * Production-safe database initialization.
 * Uses CREATE TABLE IF NOT EXISTS — never crashes if tables already exist.
 * Called once on bot startup before any handlers are registered.
 */
export async function initDb(): Promise<void> {
  const client = await pool.connect();
  try {
    console.log("[DATABASE] Running schema initialization...");

    await client.query("BEGIN");

    // ── users ──────────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id                   BIGINT PRIMARY KEY,
        username             TEXT,
        first_name           TEXT NOT NULL DEFAULT 'User',
        balance              INTEGER NOT NULL DEFAULT 0,
        total_referrals      INTEGER NOT NULL DEFAULT 0,
        total_redeems        INTEGER NOT NULL DEFAULT 0,
        join_date            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        is_verified          BOOLEAN NOT NULL DEFAULT FALSE,
        verification_version INTEGER NOT NULL DEFAULT 0,
        referred_by          BIGINT,
        last_daily_claim     TIMESTAMPTZ,
        active_message_id    INTEGER,
        CONSTRAINT users_balance_non_negative CHECK (balance >= 0)
      )
    `);
    console.log("[DATABASE] users table ready");

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_username ON users (username)
      WHERE username IS NOT NULL
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_referred_by ON users (referred_by)
      WHERE referred_by IS NOT NULL
    `);

    // ── channels ───────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS channels (
        id           SERIAL PRIMARY KEY,
        channel_id   TEXT NOT NULL UNIQUE,
        channel_name TEXT NOT NULL,
        channel_link TEXT NOT NULL,
        is_active    BOOLEAN NOT NULL DEFAULT TRUE
      )
    `);
    console.log("[DATABASE] channels table ready");

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_channels_active ON channels (is_active)
    `);

    // ── accounts ───────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS accounts (
        id           SERIAL PRIMARY KEY,
        message_id   INTEGER NOT NULL,
        message_link TEXT NOT NULL,
        file_name    TEXT NOT NULL,
        is_used      BOOLEAN NOT NULL DEFAULT FALSE,
        used_by      BIGINT,
        used_at      TIMESTAMPTZ,
        added_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    console.log("[DATABASE] accounts table ready");

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_accounts_is_used    ON accounts (is_used)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_accounts_message_id ON accounts (message_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_accounts_used_by ON accounts (used_by)
      WHERE used_by IS NOT NULL
    `);

    // ── codes ──────────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS codes (
        id         SERIAL PRIMARY KEY,
        code       TEXT NOT NULL UNIQUE,
        points     INTEGER NOT NULL,
        is_used    BOOLEAN NOT NULL DEFAULT FALSE,
        used_by    BIGINT,
        used_at    TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT codes_points_positive CHECK (points > 0)
      )
    `);
    console.log("[DATABASE] codes table ready");

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_codes_is_used ON codes (is_used)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_codes_used_by ON codes (used_by)
      WHERE used_by IS NOT NULL
    `);

    // ── settings ───────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS settings (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `);
    console.log("[DATABASE] settings table ready");

    // ── seed default settings ──────────────────────────────────────────────
    await client.query(`
      INSERT INTO settings (key, value)
      VALUES ('verification_version', '0')
      ON CONFLICT (key) DO NOTHING
    `);
    await client.query(`
      INSERT INTO settings (key, value)
      VALUES ('stock_counter', '0')
      ON CONFLICT (key) DO NOTHING
    `);

    await client.query("COMMIT");
    console.log("[DATABASE] Schema initialization complete ✓");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[DATABASE] Schema initialization FAILED:", msg);
    throw err;
  } finally {
    client.release();
  }
}

export * from "./schema";
