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
import { testDbConnection } from "@workspace/db";

// ─── Token check ──────────────────────────────────────────────────────────────
const token = process.env["BOT_TOKEN"];
if (!token) throw new Error("[STARTUP] BOT_TOKEN is required but not set");

logger.info("[STARTUP] BOT_TOKEN loaded");

export const bot = new Telegraf<BotContext>(token);

// ─── Global Telegraf error handler ───────────────────────────────────────────
bot.catch((err, ctx) => {
  const uid = ctx.from?.id ?? "unknown";
  const updateType = ctx.updateType ?? "unknown";
  logger.error(
    { err, uid, updateType },
    "[ERROR] Unhandled error in Telegraf middleware chain"
  );
  // Attempt to notify user
  ctx.reply(
    "⎋ ─〔 INTERNAL ERROR 〕──────────\n│\n│  ◌  Something went wrong.\n│  ◌  Please try again.\n│\n──────────────────────────────"
  ).catch(() => {});
});

// ─── /ping — lightweight liveness check (NO DB required, registered FIRST) ───
bot.command("ping", (ctx) => {
  const uid = ctx.from?.id ?? 0;
  logger.info({ uid }, "[COMMAND] /ping received");
  return ctx.reply(
    [
      `◉ ─〔 PONG ✦ 〕──────────────────`,
      `│`,
      `│  ◎  Bot is alive.`,
      `│  ◈  Polling active.`,
      `│  ◌  No DB required for this.`,
      `│`,
      `──────────────────────────────────`,
    ].join("\n")
  );
});

// ─── /testlog — verify logging pipeline (NO DB) ──────────────────────────────
bot.command("testlog", (ctx) => {
  const uid = ctx.from?.id ?? 0;
  logger.info({ uid }, "[TESTLOG] Log test triggered");
  logger.warn({ uid }, "[TESTLOG] Warning level test");
  logger.error({ uid }, "[TESTLOG] Error level test");
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

// ─── DB middleware — runs for ALL subsequent handlers ─────────────────────────
bot.use(registerMiddleware);
logger.info("[STARTUP] Register middleware loaded");

// ─── /testdb — live DB connectivity probe ────────────────────────────────────
bot.command("testdb", async (ctx) => {
  const uid = ctx.from?.id ?? 0;
  logger.info({ uid }, "[COMMAND] /testdb received");
  await ctx.reply("◌ ─── Testing DB connection...");
  const result = await testDbConnection();
  if (result.ok) {
    logger.info({ uid, latencyMs: result.latencyMs }, "[TESTDB] DB connection OK");
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
    logger.error({ uid, error: result.error }, "[TESTDB] DB connection FAILED");
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
});

// ─── /start ───────────────────────────────────────────────────────────────────
bot.start(async (ctx) => {
  const uid = ctx.from?.id ?? 0;
  logger.info({ uid }, "[COMMAND] /start received");
  try {
    await handleStart(ctx);
  } catch (err) {
    logger.error({ err, uid }, "[COMMAND] /start handler failed");
    await ctx.reply(alertPanel("ERROR", ["Failed to load start. Try again."])).catch(() => {});
  }
});

// ─── /admin ───────────────────────────────────────────────────────────────────
bot.command("admin", async (ctx) => {
  const uid = ctx.from.id;
  logger.info({ uid }, "[COMMAND] /admin received");
  if (!isAdmin(uid)) {
    await ctx.reply("⎋  Access denied.");
    return;
  }
  try {
    await showAdminPanel(ctx);
  } catch (err) {
    logger.error({ err, uid }, "[COMMAND] /admin handler failed");
  }
});

// ─── /code ────────────────────────────────────────────────────────────────────
bot.command("code", async (ctx) => {
  const uid = ctx.from?.id ?? 0;
  const parts = ctx.message.text.split(" ");
  logger.info({ uid }, "[COMMAND] /code received");
  if (parts.length < 2) {
    await ctx.reply(
      [
        `╔══〔 REDEEM CODE 〕══╗`,
        `║  ◈  Usage: /code YOURCODE`,
        `╚════════════════════╝`,
      ].join("\n")
    );
    return;
  }
  try {
    await handleCodeRedeem(ctx, parts[1]!.trim());
  } catch (err) {
    logger.error({ err, uid }, "[COMMAND] /code handler failed");
  }
});

// ─── /del ─────────────────────────────────────────────────────────────────────
bot.command("del", async (ctx) => {
  const uid = ctx.from.id;
  logger.info({ uid }, "[COMMAND] /del received");
  if (!isAdmin(uid)) {
    await ctx.reply("⎋  Access denied.");
    return;
  }
  const text = ctx.message.text.replace("/del", "").trim();
  const parts = text.split("-").map((s) => s.trim());
  if (parts.length < 2) {
    await ctx.reply(
      [
        `╔══〔 DEL RANGE 〕══╗`,
        `║  ◈  Usage:`,
        `║  ◌  /del LINK1 - LINK2`,
        `╚══════════════════╝`,
      ].join("\n")
    );
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
    logger.error({ err, uid }, "[COMMAND] /del handler failed");
  }
});

// ─── DB channel — auto-index .txt uploads ─────────────────────────────────────
bot.on("channel_post", async (ctx) => {
  const post = ctx.channelPost;
  if (post.chat.id !== DB_CHANNEL_ID) return;
  if (!("document" in post) || !post.document) return;
  if (!post.document.file_name?.toLowerCase().endsWith(".txt")) return;
  logger.info({ msgId: post.message_id }, "[STOCK] .txt upload detected in DB channel");
  try {
    await handleDbChannelDocument(ctx);
  } catch (err) {
    logger.error({ err }, "[STOCK] handleDbChannelDocument failed");
  }
});

// ─── Callback queries ─────────────────────────────────────────────────────────
bot.on("callback_query", async (ctx) => {
  if (!("data" in ctx.callbackQuery)) return;
  const data = ctx.callbackQuery.data;
  const uid = ctx.from?.id ?? 0;
  logger.info({ uid, data }, "[CALLBACK] Received");

  try {
    // Verification gate — every callback except "verify" itself
    if (data !== "verify") {
      const needsVerif = await needsVerification(ctx);
      if (needsVerif) {
        await ctx.answerCbQuery();
        const expiredText = [
          `⎋ ─〔 SESSION EXPIRED 〕──────────`,
          `│`,
          `│  ◌  Please use /start to continue.`,
          `│`,
          `──────────────────────────────────`,
        ].join("\n");
        try { await ctx.editMessageText(expiredText); }
        catch { await ctx.reply(expiredText); }
        return;
      }
    }

    await ctx.answerCbQuery().catch(() => {});

    // ── User navigation ──
    if (data === "verify")         { logger.info({ uid }, "[CALLBACK] verify");         await handleVerify(ctx);        return; }
    if (data === "menu")           { logger.info({ uid }, "[CALLBACK] menu");            await showMainMenu(ctx, false); return; }
    if (data === "profile")        { logger.info({ uid }, "[CALLBACK] profile");         await showProfile(ctx);         return; }
    if (data === "redeem")         { logger.info({ uid }, "[CALLBACK] redeem");          await showRedeemConfirm(ctx);   return; }
    if (data === "redeem_confirm") { logger.info({ uid }, "[CALLBACK] redeem_confirm");  await handleRedeemConfirm(ctx); return; }
    if (data === "tutorial")       { logger.info({ uid }, "[CALLBACK] tutorial");        await showTutorial(ctx);        return; }
    if (data === "daily")          { logger.info({ uid }, "[CALLBACK] daily");           await showDaily(ctx);           return; }
    if (data === "daily_claim")    { logger.info({ uid }, "[CALLBACK] daily_claim");     await handleDailyClaim(ctx);    return; }
    if (data === "refer")          { logger.info({ uid }, "[CALLBACK] refer");           await showReferral(ctx);        return; }
    if (data === "balance")        { logger.info({ uid }, "[CALLBACK] balance");         await showBalance(ctx);         return; }
    if (data === "stock")          { logger.info({ uid }, "[CALLBACK] stock");           await showStock(ctx);           return; }

    // ── Admin navigation ──
    if (data === "admin") {
      if (!isAdmin(uid)) { await ctx.answerCbQuery("⎋ Access denied."); return; }
      logger.info({ uid }, "[CALLBACK] admin panel");
      await showAdminPanel(ctx); return;
    }
    if (data === "adm_stats")            { logger.info({ uid }, "[ADMIN] stats");           await showStats(ctx);          return; }
    if (data === "adm_broadcast")        { logger.info({ uid }, "[ADMIN] broadcast");        await startBroadcast(ctx);     return; }
    if (data === "adm_codes")            { logger.info({ uid }, "[ADMIN] gen codes");        await startGenerateCodes(ctx); return; }
    if (data === "adm_add_ch")           { logger.info({ uid }, "[ADMIN] add channel");      await startAddChannel(ctx);    return; }
    if (data === "adm_rem_ch")           { logger.info({ uid }, "[ADMIN] remove channel");   await showRemoveChannels(ctx); return; }
    if (data === "adm_reverify")         { logger.info({ uid }, "[ADMIN] reverify");         await showReverifyConfirm(ctx); return; }
    if (data === "adm_reverify_confirm") { logger.info({ uid }, "[ADMIN] reverify confirm"); await handleReverifyConfirm(ctx); return; }
    if (data === "adm_stock")            { logger.info({ uid }, "[ADMIN] stock manager");    await showStockManager(ctx);   return; }

    if (data.startsWith("adm_rem_ch_")) {
      const chId = parseInt(data.replace("adm_rem_ch_", ""), 10);
      logger.info({ uid, chId }, "[ADMIN] remove channel confirm");
      await handleRemoveChannel(ctx, chId);
      return;
    }

    logger.warn({ uid, data }, "[CALLBACK] Unhandled callback data");

  } catch (err) {
    logger.error({ err, uid, data }, "[CALLBACK] Handler threw an error");
    try { await ctx.reply(alertPanel("ERROR", ["Handler failed. Check logs."])); } catch { /* ignore */ }
  }
});

// ─── Text messages — conversation state ───────────────────────────────────────
bot.on("text", async (ctx) => {
  const uid = ctx.from.id;
  const state = getConvo(uid);
  if (!state) return;

  const text = ctx.message.text;
  logger.info({ uid, stateType: state.type }, "[CONVO] Text message for active state");

  try {
    if (state.type === "broadcast") {
      await handleBroadcastMessage(ctx, ctx.message.message_id);
      return;
    }
    if (state.type === "gen_codes_count") {
      await handleCodesCount(ctx, text);
      return;
    }
    if (state.type === "gen_codes_points") {
      const count = state.data["count"] as number;
      await handleCodesPoints(ctx, text, count);
      return;
    }
    if (state.type === "add_channel_id") {
      await handleChannelId(ctx, text);
      return;
    }
    if (state.type === "add_channel_name") {
      await handleChannelName(ctx, text, state.data);
      return;
    }
    if (state.type === "add_channel_link") {
      await handleChannelLink(ctx, text, state.data);
      return;
    }
  } catch (err) {
    logger.error({ err, uid, stateType: state.type }, "[CONVO] State handler threw an error");
    clearConvo(uid);
  }
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
function extractMsgId(link: string): number | null {
  const match = link.match(/\/(\d+)$/);
  if (!match) return null;
  return parseInt(match[1]!, 10);
}

// ─── Bot launch ───────────────────────────────────────────────────────────────
export async function startBot(): Promise<void> {
  logger.info("[STARTUP] Fetching bot info...");

  const me = await bot.telegram.getMe();
  logger.info(
    { username: me.username, id: me.id },
    "[STARTUP] Bot identity confirmed"
  );

  logger.info("[STARTUP] Launching long polling (dropPendingUpdates=true)...");
  return bot.launch({ dropPendingUpdates: true });
}

// Graceful shutdown
process.once("SIGINT", () => {
  logger.info("[SHUTDOWN] SIGINT received — stopping bot");
  bot.stop("SIGINT");
});
process.once("SIGTERM", () => {
  logger.info("[SHUTDOWN] SIGTERM received — stopping bot");
  bot.stop("SIGTERM");
});
