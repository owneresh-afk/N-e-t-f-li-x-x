import app from "./app";
import { logger } from "./lib/logger";
import { startBot } from "./bot/index";
import { testDbConnection } from "@workspace/db";

// ─── Global safety net ────────────────────────────────────────────────────────
process.on("uncaughtException", (err) => {
  logger.error({ err }, "[CRASH] uncaughtException — process will exit");
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "[CRASH] unhandledRejection — check for missing awaits");
});

// ─── Port validation ──────────────────────────────────────────────────────────
const rawPort = process.env["PORT"];
if (!rawPort) throw new Error("PORT environment variable is required but was not provided.");
const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) throw new Error(`Invalid PORT value: "${rawPort}"`);

// ─── Startup sequence ─────────────────────────────────────────────────────────
async function main(): Promise<void> {
  logger.info("[STARTUP] Server initialising...");

  // 1. Test database connection before anything else
  logger.info("[DATABASE] Testing connection...");
  const dbCheck = await testDbConnection();
  if (dbCheck.ok) {
    logger.info({ latencyMs: dbCheck.latencyMs }, "[DATABASE] Connected successfully");
  } else {
    // Log but do NOT crash — the bot can still start and serve /ping
    logger.error({ error: dbCheck.error }, "[DATABASE] Connection FAILED — bot will run but DB features will fail");
  }

  // 2. Start HTTP server
  await new Promise<void>((resolve, reject) => {
    app.listen(port, (err?: Error) => {
      if (err) { reject(err); return; }
      logger.info({ port }, "[STARTUP] HTTP server listening");
      resolve();
    });
  });

  // 3. Start Telegram bot
  logger.info("[STARTUP] Starting Telegram bot...");
  try {
    await startBot();
  } catch (err) {
    logger.error({ err }, "[STARTUP] Bot crashed — check BOT_TOKEN and network");
    process.exit(1);
  }
}

main().catch((err) => {
  logger.error({ err }, "[STARTUP] Fatal error during startup");
  process.exit(1);
});
