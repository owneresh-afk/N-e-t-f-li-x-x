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
import { startGenerateCodes, handleCodesCount, handleCodesPoints, handleCodeRedeem } from "./handlers/admin/codes.js";
import { startAddChannel, handleChannelId, handleChannelName, handleChannelLink, showRemoveChannels, handleRemoveChannel } from "./handlers/admin/channels.js";
import { showReverifyConfirm, handleReverifyConfirm } from "./handlers/admin/reverify.js";
import { showStockManager, handleDbChannelDocument, handleDeleteRange } from "./handlers/admin/stock-manager.js";
import { getConvo, clearConvo } from "./convo-state.js";
import { panel } from "./utils/format.js";
import { logger } from "../lib/logger.js";

const token = process.env["BOT_TOKEN"];
if (!token) throw new Error("BOT_TOKEN is required");

export const bot = new Telegraf<BotContext>(token);

// Register middleware — populates ctx.dbUser
bot.use(registerMiddleware);

// ──────────────────────────────────────────────
// COMMANDS
// ──────────────────────────────────────────────

bot.start(handleStart);

bot.command("admin", async (ctx) => {
  if (!isAdmin(ctx.from.id)) {
    await ctx.reply("⎋  Access denied.");
    return;
  }
  await showAdminPanel(ctx);
});

bot.command("code", async (ctx) => {
  const parts = ctx.message.text.split(" ");
  if (parts.length < 2) {
    await ctx.reply(panel("REDEEM CODE", ["◈  Usage: /code YOURCODE"]));
    return;
  }
  const code = parts[1]!.trim();
  await handleCodeRedeem(ctx, code);
});

bot.command("del", async (ctx) => {
  if (!isAdmin(ctx.from.id)) {
    await ctx.reply("⎋  Access denied.");
    return;
  }
  // Format: /del https://t.me/c/CHANNELID/MSGID - https://t.me/c/CHANNELID/MSGID
  const text = ctx.message.text.replace("/del", "").trim();
  const parts = text.split("-").map((s) => s.trim());
  if (parts.length < 2) {
    await ctx.reply(
      panel("DEL RANGE", [
        "◈  Usage:",
        "◌  /del LINK1 - LINK2",
      ])
    );
    return;
  }
  const startId = extractMsgId(parts[0]!);
  const endId = extractMsgId(parts[parts.length - 1]!);
  if (!startId || !endId) {
    await ctx.reply(panel("DEL RANGE", ["⎋  Invalid links provided."]));
    return;
  }
  await handleDeleteRange(ctx, startId, endId);
});

// ──────────────────────────────────────────────
// DB CHANNEL: auto-detect TXT file uploads
// ──────────────────────────────────────────────

bot.on("channel_post", async (ctx) => {
  const post = ctx.channelPost;
  if (post.chat.id !== DB_CHANNEL_ID) return;
  if (!("document" in post) || !post.document) return;
  if (!post.document.file_name?.toLowerCase().endsWith(".txt")) return;

  await handleDbChannelDocument(ctx);
});

// ──────────────────────────────────────────────
// CALLBACK QUERIES
// ──────────────────────────────────────────────

bot.on("callback_query", async (ctx) => {
  if (!("data" in ctx.callbackQuery)) return;
  const data = ctx.callbackQuery.data;

  // Check if user needs verification first
  if (!["verify"].includes(data)) {
    const needsVerif = await needsVerification(ctx);
    if (needsVerif && data !== "verify") {
      await ctx.answerCbQuery();
      const expiredText = panel("VERIFICATION EXPIRED", [
        "◌  Please use /start",
      ]);
      try {
        await ctx.editMessageText(expiredText);
      } catch {
        await ctx.reply(expiredText);
      }
      return;
    }
  }

  await ctx.answerCbQuery().catch(() => {});

  // Main navigation
  if (data === "verify") { await handleVerify(ctx); return; }
  if (data === "menu") { await showMainMenu(ctx, false); return; }
  if (data === "profile") { await showProfile(ctx); return; }
  if (data === "redeem") { await showRedeemConfirm(ctx); return; }
  if (data === "redeem_confirm") { await handleRedeemConfirm(ctx); return; }
  if (data === "tutorial") { await showTutorial(ctx); return; }
  if (data === "daily") { await showDaily(ctx); return; }
  if (data === "daily_claim") { await handleDailyClaim(ctx); return; }
  if (data === "refer") { await showReferral(ctx); return; }
  if (data === "balance") { await showBalance(ctx); return; }
  if (data === "stock") { await showStock(ctx); return; }

  // Admin panel
  if (data === "admin") {
    if (!isAdmin(ctx.from!.id)) { await ctx.answerCbQuery("⎋ Access denied."); return; }
    await showAdminPanel(ctx); return;
  }
  if (data === "adm_stats") { await showStats(ctx); return; }
  if (data === "adm_broadcast") { await startBroadcast(ctx); return; }
  if (data === "adm_codes") { await startGenerateCodes(ctx); return; }
  if (data === "adm_add_ch") { await startAddChannel(ctx); return; }
  if (data === "adm_rem_ch") { await showRemoveChannels(ctx); return; }
  if (data === "adm_reverify") { await showReverifyConfirm(ctx); return; }
  if (data === "adm_reverify_confirm") { await handleReverifyConfirm(ctx); return; }
  if (data === "adm_stock") { await showStockManager(ctx); return; }

  // Dynamic: remove channel by DB ID
  if (data.startsWith("adm_rem_ch_")) {
    const chId = parseInt(data.replace("adm_rem_ch_", ""), 10);
    await handleRemoveChannel(ctx, chId);
    return;
  }
});

// ──────────────────────────────────────────────
// TEXT MESSAGES — conversation state handler
// ──────────────────────────────────────────────

bot.on("text", async (ctx) => {
  const userId = ctx.from.id;
  const state = getConvo(userId);
  if (!state) return;

  const text = ctx.message.text;

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
});

// ──────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────

function extractMsgId(link: string): number | null {
  // Handles https://t.me/c/CHANNELID/MSGID
  const match = link.match(/\/(\d+)$/);
  if (!match) return null;
  return parseInt(match[1]!, 10);
}

export function startBot(): Promise<void> {
  logger.info("Telegram bot starting (long polling)...");
  return bot.launch({ dropPendingUpdates: true });
}

// Graceful shutdown
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
