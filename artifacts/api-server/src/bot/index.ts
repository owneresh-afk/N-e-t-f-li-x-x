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

// ─── Token guard ──────────────────────────────────────────────────────────────
const token = process.env["BOT_TOKEN"];
if (!token) throw new Error("[STARTUP] BOT_TOKEN is required but not set");
logger.info("[STARTUP] BOT_TOKEN loaded ✓");

export const bot = new Telegraf<BotContext>(token);

// ─── Global Telegraf error catcher ───────────────────────────────────────────
// Catches ANY unhandled error in the entire middleware chain
bot.catch((err, ctx) => {
  const uid = ctx.from?.id ?? "unknown";
  const updateType = ctx.updateType ?? "unknown";
  logger.error({ err, uid, updateType }, "[BOT.CATCH] Unhandled error in middleware chain");
  ctx
    .reply(
      [
        `⎋ ─〔 INTERNAL ERROR 〕──────────`,
        `│`,
        `│  ◌  Something went wrong.`,
        `│  ◌  Please try again or /start`,
        `│`,
        `──────────────────────────────────`,
      ].join("\n")
    )
    .catch(() => {});
});

// ─── /ping — zero dependencies, registered BEFORE all middleware ──────────────
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

// ─── /testlog — verify logging is flowing, no DB needed ──────────────────────
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

// ─── DB middleware — applied to everything below this line ────────────────────
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

// ─── Helper: gate handler behind dbUser existence ────────────────────────────
async function requireUser(ctx: BotContext, handlerName: string): Promise<boolean> {
  if (ctx.dbUser) return true;
  const uid = ctx.from?.id ?? 0;
  logger.error({ uid, handlerName }, "[GATE] dbUser missing — DB may be down");
  await ctx
    .reply(
      [
        `⎋ ─〔 SERVICE UNAVAILABLE 〕──────`,
        `│`,
        `│  ◌  Database unreachable.`,
        `│  ◌  Please try /start again.`,
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
  logger.info({ uid }, "[COMMAND] /start");
  if (!(await requireUser(ctx, "/start"))) return;
  try {
    await handleStart(ctx);
    logger.info({ uid }, "[COMMAND] /start handled");
  } catch (err) {
    logger.error({ err, uid }, "[COMMAND] /start threw");
    await ctx.reply(alertPanel("ERROR", ["Failed to start.", "Try again."])).catch(() => {});
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
    logger.error({ err, uid }, "[COMMAND] /admin threw");
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
    logger.error({ err, uid }, "[COMMAND] /code threw");
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
    await ctx.reply(
      [`╔══〔 DEL RANGE 〕══╗`, `║  ◌  /del LINK1 - LINK2`, `╚══════════════════╝`].join("\n")
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
    logger.error({ err, uid }, "[COMMAND] /del threw");
  }
});

// ─── DB channel: index .txt uploads ──────────────────────────────────────────
bot.on("channel_post", async (ctx) => {
  try {
    const post = ctx.channelPost;
    if (post.chat.id !== DB_CHANNEL_ID) return;
    if (!("document" in post) || !post.document) return;
    if (!post.document.file_name?.toLowerCase().endsWith(".txt")) return;
    logger.info({ msgId: post.message_id, chatId: post.chat.id }, "[STOCK] .txt upload detected");
    await handleDbChannelDocument(ctx);
    logger.info({ msgId: post.message_id }, "[STOCK] Document indexed");
  } catch (err) {
    logger.error({ err }, "[STOCK] channel_post handler threw");
  }
});

// ─── Callback queries ─────────────────────────────────────────────────────────
bot.on("callback_query", async (ctx) => {
  if (!("data" in ctx.callbackQuery)) return;
  const data = ctx.callbackQuery.data;
  const uid = ctx.from?.id ?? 0;
  logger.info({ uid, data }, "[CALLBACK] Received");

  try {
    // Gate: require dbUser for all callbacks except "verify"
    if (data !== "verify") {
      if (!ctx.dbUser) {
        logger.error({ uid, data }, "[CALLBACK] dbUser missing — DB may be down");
        await ctx.answerCbQuery("Service unavailable. Try /start").catch(() => {});
        return;
      }

      // Verification gate
      const needsVerif = await needsVerification(ctx);
      if (needsVerif) {
        logger.info({ uid }, "[CALLBACK] User not verified — showing expired notice");
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

    // ── User navigation ──────────────────────────────────────────────────────
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

    // ── Admin navigation ─────────────────────────────────────────────────────
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

    logger.warn({ uid, data }, "[CALLBACK] No handler matched — unrecognised callback data");

  } catch (err) {
    logger.error({ err, uid, data }, "[CALLBACK] Handler threw — replying with error notice");
    try {
      await ctx.answerCbQuery("Error — check logs").catch(() => {});
      await ctx.reply(alertPanel("ERROR", ["Handler failed.", "Check Render logs."]));
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
    if (state.type === "broadcast")       { await handleBroadcastMessage(ctx, ctx.message.message_id); return; }
    if (state.type === "gen_codes_count") { await handleCodesCount(ctx, text); return; }
    if (state.type === "gen_codes_points") {
      await handleCodesPoints(ctx, text, state.data["count"] as number);
      return;
    }
    if (state.type === "add_channel_id")   { await handleChannelId(ctx, text); return; }
    if (state.type === "add_channel_name") { await handleChannelName(ctx, text, state.data); return; }
    if (state.type === "add_channel_link") { await handleChannelLink(ctx, text, state.data); return; }
  } catch (err) {
    logger.error({ err, uid, stateType: state.type }, "[CONVO] State handler threw");
    clearConvo(uid);
    await ctx.reply(alertPanel("ERROR", ["State handler failed.", "Try again."])).catch(() => {});
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
process.once("SIGINT",  () => { logger.info("[SHUTDOWN] SIGINT  — stopping bot"); bot.stop("SIGINT");  });
process.once("SIGTERM", () => { logger.info("[SHUTDOWN] SIGTERM — stopping bot"); bot.stop("SIGTERM"); });
