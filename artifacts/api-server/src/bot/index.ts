import { Telegraf } from "telegraf";
import type { BotContext } from "./types.js";
import { registerMiddleware } from "./middleware/register.js";
import { isAdmin, DB_CHANNEL_ID } from "./config.js";
import { handleStart } from "./handlers/start.js";
import { handleVerify, showVerificationPanel, needsVerification } from "./handlers/verify.js";
import { showMainMenu } from "./handlers/main-menu.js";
import { showProfile } from "./handlers/profile.js";
import { showRedeemConfirm, handleRedeemConfirm } from "./handlers/redeem.js";
import { showTutorial } from "./handlers/tutorial.js";
import { showDaily, handleDailyClaim } from "./handlers/daily.js";
import { showReferral } from "./handlers/referral.js";
import { showBalance } from "./handlers/balance.js";
import { showStock } from "./handlers/stock.js";
import { showAdminPanel } from "./handlers/admin/index.js";
import { showStats } from "./handlers/admin/stats.js";
import { startBroadcast, handleBroadcastMessage } from "./handlers/admin/broadcast.js";
import {
  startGenerateCodes, handleCodesCount, handleCodesPoints, handleCodeRedeem,
} from "./handlers/admin/codes.js";
import {
  startAddChannel, handleChannelId, handleChannelName, handleChannelLink,
  showRemoveChannels, handleRemoveChannel,
} from "./handlers/admin/channels.js";
import { showReverifyConfirm, handleReverifyConfirm } from "./handlers/admin/reverify.js";
import { showStockManager, handleDbChannelDocument, handleDeleteRange } from "./handlers/admin/stock-manager.js";
import { getConvo, clearConvo } from "./convo-state.js";
import { alertPanel } from "./utils/format.js";
import { logger } from "../lib/logger.js";
import { testDbConnection, pool } from "@workspace/db";

// ─── Token guard ──────────────────────────────────────────────────────────────
const token = process.env["BOT_TOKEN"];
if (!token) throw new Error("[STARTUP] BOT_TOKEN is required but not set");
logger.info("[STARTUP] BOT_TOKEN loaded ✓");

export const bot = new Telegraf<BotContext>(token);

// ─── Global Telegraf error catcher ───────────────────────────────────────────
bot.catch((err, ctx) => {
  const uid = ctx.from?.id ?? "unknown";
  const updateType = ctx.updateType ?? "unknown";
  const msg = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  logger.error({ err, uid, updateType, message: msg, stack }, "[BOT.CATCH] Unhandled error in middleware chain");
  ctx.reply(
    [
      `⎋ ─〔 INTERNAL ERROR 〕──────────`,
      `│`,
      `│  ◌  ${msg}`,
      `│  ◌  Check Render logs.`,
      `│`,
      `──────────────────────────────────`,
    ].join("\n")
  ).catch(() => {});
});

// ─── /ping — no DB, registered FIRST ─────────────────────────────────────────
bot.command("ping", (ctx) => {
  const uid = ctx.from?.id ?? 0;
  logger.info({ uid }, "[COMMAND] /ping");
  return ctx.reply(
    [
      `◉ ─〔 PONG ✦ 〕──────────────────`,
      `│`,
      `│  ◎  Bot is alive.`,
      `│  ◈  Polling is active.`,
      `│`,
      `──────────────────────────────────`,
    ].join("\n")
  );
});

// ─── /testlog — verify log pipeline, no DB ───────────────────────────────────
bot.command("testlog", (ctx) => {
  const uid = ctx.from?.id ?? 0;
  logger.info({ uid }, "[TESTLOG] INFO test");
  logger.warn({ uid }, "[TESTLOG] WARN test");
  logger.error({ uid }, "[TESTLOG] ERROR test");
  return ctx.reply(
    [
      `◉ ─〔 LOG TEST 〕────────────────`,
      `│`,
      `│  ◎  3 log lines emitted.`,
      `│  ◌  Check Render logs now.`,
      `│`,
      `──────────────────────────────────`,
    ].join("\n")
  );
});

// ─── DB middleware — applied to everything below ──────────────────────────────
bot.use(registerMiddleware);
logger.info("[STARTUP] registerMiddleware loaded ✓");

// ─── /testdb — live connectivity probe ───────────────────────────────────────
bot.command("testdb", async (ctx) => {
  const uid = ctx.from?.id ?? 0;
  logger.info({ uid }, "[COMMAND] /testdb");
  await ctx.reply("◌ ─── Testing database connection...").catch(() => {});
  try {
    const result = await testDbConnection();
    if (result.ok) {
      logger.info({ uid, latencyMs: result.latencyMs }, "[TESTDB] OK");
      await ctx.reply(
        [
          `◉ ─〔 DATABASE OK ✦ 〕──────────`,
          `│`,
          `│  ◎  Connected successfully.`,
          `│  ◈  Latency ···  ${result.latencyMs}ms`,
          `│`,
          `──────────────────────────────────`,
        ].join("\n")
      );
    } else {
      logger.error({ uid, error: result.error }, "[TESTDB] FAILED");
      await ctx.reply(
        [
          `⎋ ─〔 DATABASE FAILED 〕─────────`,
          `│`,
          `│  ◌  ${result.error}`,
          `│`,
          `──────────────────────────────────`,
        ].join("\n")
      );
    }
  } catch (err) {
    logger.error({ err, uid }, "[TESTDB] Threw unexpectedly");
    await ctx.reply(alertPanel("TESTDB ERROR", ["Unexpected failure. Check logs."])).catch(() => {});
  }
});

// ─── /diagnose — check all tables exist and are queryable ────────────────────
bot.command("diagnose", async (ctx) => {
  const uid = ctx.from?.id ?? 0;
  logger.info({ uid }, "[DIAGNOSE] Starting table diagnostics");
  await ctx.reply("◌ ─── Running diagnostics...").catch(() => {});

  const tables = ["users", "channels", "accounts", "codes", "settings"];
  const results: string[] = [];

  for (const table of tables) {
    try {
      const res = await pool.query<{ exists: boolean }>(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = $1
        )`,
        [table]
      );
      const exists = res.rows[0]?.exists === true;

      if (exists) {
        const countRes = await pool.query(`SELECT COUNT(*) AS cnt FROM "${table}"`);
        const cnt = countRes.rows[0]?.cnt ?? "?";
        results.push(`◎  ${table.padEnd(10)} EXISTS   rows: ${cnt}`);
        logger.info({ uid, table, count: cnt }, "[DIAGNOSE] Table OK");
      } else {
        results.push(`⎋  ${table.padEnd(10)} MISSING`);
        logger.error({ uid, table }, "[DIAGNOSE] Table MISSING — run schema migration");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push(`⎋  ${table.padEnd(10)} ERROR: ${msg}`);
      logger.error({ err, uid, table, message: msg }, "[DIAGNOSE] Table query threw");
    }
  }

  const text = [
    `◉ ─〔 DIAGNOSTICS 〕──────────────`,
    `│`,
    ...results.map((r) => `│  ${r}`),
    `│`,
    `──────────────────────────────────`,
  ].join("\n");

  logger.info({ uid, results }, "[DIAGNOSE] Complete");
  await ctx.reply(text).catch(() => {});
});

// ─── Helper: gate handler behind dbUser existence ────────────────────────────
async function requireUser(ctx: BotContext, handlerName: string): Promise<boolean> {
  if (ctx.dbUser) return true;

  const uid = ctx.from?.id ?? 0;
  // ctx.middlewareError carries the real DB error set by registerMiddleware
  const reason = ctx.middlewareError ?? "Unknown — dbUser is undefined after middleware";
  logger.error({ uid, handlerName, reason }, "[GATE] dbUser missing — middleware DB query failed");

  await ctx
    .reply(
      [
        `⎋ ─〔 REGISTRATION FAILED 〕──────`,
        `│`,
        `│  ◌  Could not load user record.`,
        `│  ◌  Error: ${reason}`,
        `│`,
        `│  ◈  Run /diagnose to check tables`,
        `│  ◈  Run /testdb to check connection`,
        `│`,
        `──────────────────────────────────`,
      ].join("\n")
    )
    .catch(() => {});
  return false;
}

// ─── /start ───────────────────────────────────────────────────────────────────
bot.start(async (ctx) => {
  const uid = ctx.from?.id ?? 0;
  logger.info({ uid }, "[COMMAND] /start received");
  if (!(await requireUser(ctx, "/start"))) return;
  try {
    await handleStart(ctx);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    logger.error({ err, uid, message: msg, stack }, "[COMMAND] /start threw");
    await ctx.reply(
      [
        `⎋ ─〔 START ERROR 〕─────────────`,
        `│`,
        `│  ◌  ${msg}`,
        `│`,
        `──────────────────────────────────`,
      ].join("\n")
    ).catch(() => {});
  }
});

// ─── /admin ───────────────────────────────────────────────────────────────────
bot.command("admin", async (ctx) => {
  const uid = ctx.from.id;
  logger.info({ uid }, "[COMMAND] /admin");
  if (!isAdmin(uid)) { await ctx.reply("⎋  Access denied."); return; }
  if (!(await requireUser(ctx, "/admin"))) return;
  try {
    await showAdminPanel(ctx);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err, uid, message: msg }, "[COMMAND] /admin threw");
  }
});

// ─── /code ────────────────────────────────────────────────────────────────────
bot.command("code", async (ctx) => {
  const uid = ctx.from?.id ?? 0;
  logger.info({ uid }, "[COMMAND] /code");
  if (!(await requireUser(ctx, "/code"))) return;
  const parts = ctx.message.text.split(" ");
  if (parts.length < 2) {
    await ctx.reply(
      [`╔══〔 REDEEM CODE 〕══╗`, `║  ◈  Usage: /code YOURCODE`, `╚════════════════════╝`].join("\n")
    );
    return;
  }
  try {
    await handleCodeRedeem(ctx, parts[1]!.trim());
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err, uid, message: msg }, "[COMMAND] /code threw");
  }
});

// ─── /del (admin) ─────────────────────────────────────────────────────────────
bot.command("del", async (ctx) => {
  const uid = ctx.from.id;
  logger.info({ uid }, "[COMMAND] /del");
  if (!isAdmin(uid)) { await ctx.reply("⎋  Access denied."); return; }
  const text = ctx.message.text.replace("/del", "").trim();
  const parts = text.split("-").map((s) => s.trim());
  if (parts.length < 2) {
    await ctx.reply([`╔══〔 DEL RANGE 〕══╗`, `║  ◌  /del LINK1 - LINK2`, `╚══════════════════╝`].join("\n"));
    return;
  }
  const startId = extractMsgId(parts[0]!);
  const endId = extractMsgId(parts[parts.length - 1]!);
  if (!startId || !endId) {
    await ctx.reply(alertPanel("INVALID LINKS", ["Could not parse message IDs."]));
    return;
  }
  try {
    await handleDeleteRange(ctx, startId, endId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err, uid, message: msg }, "[COMMAND] /del threw");
  }
});

// ─── DB channel: index .txt uploads ──────────────────────────────────────────
bot.on("channel_post", async (ctx) => {
  try {
    const post = ctx.channelPost;
    if (post.chat.id !== DB_CHANNEL_ID) return;
    if (!("document" in post) || !post.document) return;
    if (!post.document.file_name?.toLowerCase().endsWith(".txt")) return;
    logger.info({ msgId: post.message_id }, "[STOCK] .txt upload detected");
    await handleDbChannelDocument(ctx);
    logger.info({ msgId: post.message_id }, "[STOCK] Document indexed");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err, message: msg }, "[STOCK] channel_post handler threw");
  }
});

// ─── Callback queries ─────────────────────────────────────────────────────────
bot.on("callback_query", async (ctx) => {
  if (!("data" in ctx.callbackQuery)) return;
  const data = ctx.callbackQuery.data;
  const uid = ctx.from?.id ?? 0;
  logger.info({ uid, data }, "[CALLBACK] Received");

  try {
    if (data !== "verify") {
      if (!ctx.dbUser) {
        const reason = ctx.middlewareError ?? "dbUser undefined after middleware";
        logger.error({ uid, data, reason }, "[CALLBACK] dbUser missing");
        await ctx.answerCbQuery("Registration failed — try /start").catch(() => {});
        await ctx.reply(
          [
            `⎋ ─〔 REGISTRATION FAILED 〕──────`,
            `│`,
            `│  ◌  ${reason}`,
            `│  ◈  Run /diagnose to check tables`,
            `│`,
            `──────────────────────────────────`,
          ].join("\n")
        ).catch(() => {});
        return;
      }

      const needsVerif = await needsVerification(ctx);
      if (needsVerif) {
        logger.info({ uid }, "[CALLBACK] User not verified");
        await ctx.answerCbQuery().catch(() => {});
        const txt = [
          `⎋ ─〔 SESSION EXPIRED 〕──────────`,
          `│`,
          `│  ◌  Please use /start to continue.`,
          `│`,
          `──────────────────────────────────`,
        ].join("\n");
        try { await ctx.editMessageText(txt); }
        catch { await ctx.reply(txt); }
        return;
      }
    }

    await ctx.answerCbQuery().catch(() => {});

    if (data === "verify")         { await handleVerify(ctx);        return; }
    if (data === "menu")           { await showMainMenu(ctx, false); return; }
    if (data === "profile")        { await showProfile(ctx);         return; }
    if (data === "redeem")         { await showRedeemConfirm(ctx);   return; }
    if (data === "redeem_confirm") { await handleRedeemConfirm(ctx); return; }
    if (data === "tutorial")       { await showTutorial(ctx);        return; }
    if (data === "daily")          { await showDaily(ctx);           return; }
    if (data === "daily_claim")    { await handleDailyClaim(ctx);    return; }
    if (data === "refer")          { await showReferral(ctx);        return; }
    if (data === "balance")        { await showBalance(ctx);         return; }
    if (data === "stock")          { await showStock(ctx);           return; }

    if (data === "admin") {
      if (!isAdmin(uid)) { await ctx.answerCbQuery("⎋ Access denied."); return; }
      await showAdminPanel(ctx); return;
    }
    if (data === "adm_stats")            { await showStats(ctx);           return; }
    if (data === "adm_broadcast")        { await startBroadcast(ctx);      return; }
    if (data === "adm_codes")            { await startGenerateCodes(ctx);  return; }
    if (data === "adm_add_ch")           { await startAddChannel(ctx);     return; }
    if (data === "adm_rem_ch")           { await showRemoveChannels(ctx);  return; }
    if (data === "adm_reverify")         { await showReverifyConfirm(ctx); return; }
    if (data === "adm_reverify_confirm") { await handleReverifyConfirm(ctx); return; }
    if (data === "adm_stock")            { await showStockManager(ctx);    return; }

    if (data.startsWith("adm_rem_ch_")) {
      const chId = parseInt(data.replace("adm_rem_ch_", ""), 10);
      logger.info({ uid, chId }, "[ADMIN] remove channel confirm");
      await handleRemoveChannel(ctx, chId);
      return;
    }

    logger.warn({ uid, data }, "[CALLBACK] No handler matched");

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    logger.error({ err, uid, data, message: msg, stack }, "[CALLBACK] Handler threw");
    try {
      await ctx.answerCbQuery("Error — check logs").catch(() => {});
      await ctx.reply(
        [
          `⎋ ─〔 CALLBACK ERROR 〕──────────`,
          `│`,
          `│  ◌  ${msg}`,
          `│  ◌  Check Render logs.`,
          `│`,
          `──────────────────────────────────`,
        ].join("\n")
      );
    } catch { /* ignore */ }
  }
});

// ─── Text: conversation state handler ────────────────────────────────────────
bot.on("text", async (ctx) => {
  const uid = ctx.from.id;
  const state = getConvo(uid);
  if (!state) return;

  logger.info({ uid, stateType: state.type }, "[CONVO] Handling state");

  try {
    const text = ctx.message.text;
    if (state.type === "broadcast")        { await handleBroadcastMessage(ctx, ctx.message.message_id); return; }
    if (state.type === "gen_codes_count")  { await handleCodesCount(ctx, text); return; }
    if (state.type === "gen_codes_points") { await handleCodesPoints(ctx, text, state.data["count"] as number); return; }
    if (state.type === "add_channel_id")   { await handleChannelId(ctx, text); return; }
    if (state.type === "add_channel_name") { await handleChannelName(ctx, text, state.data); return; }
    if (state.type === "add_channel_link") { await handleChannelLink(ctx, text, state.data); return; }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err, uid, stateType: state.type, message: msg }, "[CONVO] State handler threw");
    clearConvo(uid);
    await ctx.reply(alertPanel("ERROR", [msg])).catch(() => {});
  }
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
function extractMsgId(link: string): number | null {
  const match = link.match(/\/(\d+)$/);
  if (!match) return null;
  return parseInt(match[1]!, 10);
}

// ─── Launch ───────────────────────────────────────────────────────────────────
export async function startBot(): Promise<void> {
  logger.info("[STARTUP] Verifying bot identity...");
  const me = await bot.telegram.getMe();
  logger.info({ username: me.username, id: me.id }, "[STARTUP] Bot identity confirmed ✓");
  logger.info("[STARTUP] Starting long polling (dropPendingUpdates=true)...");
  return bot.launch({ dropPendingUpdates: true });
}

// ─── Graceful shutdown ────────────────────────────────────────────────────────
process.once("SIGINT",  () => { logger.info("[SHUTDOWN] SIGINT  — stopping"); bot.stop("SIGINT");  });
process.once("SIGTERM", () => { logger.info("[SHUTDOWN] SIGTERM — stopping"); bot.stop("SIGTERM"); });
