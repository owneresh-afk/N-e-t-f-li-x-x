import { Markup } from "telegraf";
import type { InlineKeyboardButton } from "telegraf/types";
import { db, usersTable, channelsTable, settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { BotContext } from "../types.js";
import { scannerPanel, alertPanel } from "../utils/format.js";
import { safeDelete } from "../utils/safe-delete.js";
import { sendAnimated, SCAN_FRAMES } from "../utils/animations.js";
import { sleep } from "../utils/sleep.js";
import { logger } from "../../lib/logger.js";

// ─── Verification version ─────────────────────────────────────────────────────

export async function getVerificationVersion(): Promise<number> {
  try {
    const rows = await db
      .select()
      .from(settingsTable)
      .where(eq(settingsTable.key, "verification_version"))
      .limit(1);
    if (rows.length === 0) return 0;
    return parseInt(rows[0]!.value, 10) || 0;
  } catch (err) {
    logger.error({ err }, "[VERIFICATION] getVerificationVersion failed — defaulting to 0");
    return 0;
  }
}

export async function needsVerification(ctx: BotContext): Promise<boolean> {
  try {
    const user = ctx.dbUser;
    if (!user) {
      logger.warn("[VERIFICATION] needsVerification called with no dbUser — assuming needs verify");
      return true;
    }
    const globalVersion = await getVerificationVersion();
    if (user.verificationVersion < globalVersion) {
      logger.info({ uid: user.id, globalVersion, userVersion: user.verificationVersion }, "[VERIFICATION] Version mismatch — needs re-verify");
      return true;
    }
    return !user.isVerified;
  } catch (err) {
    logger.error({ err }, "[VERIFICATION] needsVerification threw — defaulting to true");
    return true;
  }
}

// ─── Membership check ─────────────────────────────────────────────────────────

export async function checkChannelMembership(
  ctx: BotContext,
  channelId: string
): Promise<boolean> {
  try {
    const member = await ctx.telegram.getChatMember(channelId, ctx.from!.id);
    const joined = ["member", "administrator", "creator", "restricted"].includes(member.status);
    logger.info({ uid: ctx.from!.id, channelId, status: member.status, joined }, "[VERIFICATION] Membership check");
    return joined;
  } catch (err) {
    logger.warn({ err, channelId }, "[VERIFICATION] getChatMember failed — treating as not joined");
    return false;
  }
}

// ─── Panel helpers ────────────────────────────────────────────────────────────

function buildVerifyKeyboard(channels: Array<{ channelName: string; channelLink: string }>) {
  const rows: InlineKeyboardButton[][] = channels.map((ch) => [
    { text: `➜  ${ch.channelName}`, url: ch.channelLink },
  ]);
  rows.push([{ text: "⟦ VERIFY ⟧", callback_data: "verify" }]);
  return Markup.inlineKeyboard(rows);
}

// ─── Show scanner ─────────────────────────────────────────────────────────────

export async function showVerificationPanel(ctx: BotContext): Promise<void> {
  logger.info({ uid: ctx.from?.id }, "[VERIFICATION] Showing verification panel");
  try {
    const channels = await db
      .select()
      .from(channelsTable)
      .where(eq(channelsTable.isActive, true));

    const names = channels.map((c) => c.channelName);
    const text = scannerPanel(names, channels.length);
    const msg = await ctx.reply(text, buildVerifyKeyboard(channels));

    if (ctx.dbUser) {
      await db
        .update(usersTable)
        .set({ activeMessageId: msg.message_id })
        .where(eq(usersTable.id, ctx.from!.id));
    }
  } catch (err) {
    logger.error({ err, uid: ctx.from?.id }, "[VERIFICATION] showVerificationPanel failed");
    await ctx.reply(alertPanel("ERROR", ["Could not load verification.", "Try /start again."]));
  }
}

// ─── Handle verify button ─────────────────────────────────────────────────────

export async function handleVerify(ctx: BotContext): Promise<void> {
  await ctx.answerCbQuery().catch(() => {});
  const uid = ctx.from?.id;
  logger.info({ uid }, "[VERIFICATION] Verify button clicked");

  try {
    const channels = await db
      .select()
      .from(channelsTable)
      .where(eq(channelsTable.isActive, true));

    logger.info({ uid, channelCount: channels.length }, "[VERIFICATION] Checking membership for all channels");

    const animId = await sendAnimated(ctx, SCAN_FRAMES, 430);
    await sleep(350);
    await safeDelete(ctx.telegram, ctx.chat!.id, animId);

    if (channels.length === 0) {
      logger.info({ uid }, "[VERIFICATION] No channels configured — auto-verifying");
      await completeVerification(ctx);
      return;
    }

    const results = await Promise.all(
      channels.map((ch) => checkChannelMembership(ctx, ch.channelId))
    );
    const allJoined = results.every(Boolean);
    logger.info({ uid, allJoined, results }, "[VERIFICATION] Membership results");

    if (!allJoined) {
      const failText = alertPanel("SCAN FAILED", [
        "Not all channels joined.",
        "Join all channels and try again.",
      ]);
      try {
        await ctx.editMessageText(failText, buildVerifyKeyboard(channels));
      } catch {
        await ctx.reply(failText, buildVerifyKeyboard(channels));
      }
      return;
    }

    await completeVerification(ctx);
  } catch (err) {
    logger.error({ err, uid }, "[VERIFICATION] handleVerify threw");
    await ctx.reply(alertPanel("ERROR", ["Verification failed.", "Try again."])).catch(() => {});
  }
}

// ─── Complete verification ────────────────────────────────────────────────────

async function completeVerification(ctx: BotContext): Promise<void> {
  const uid = ctx.from!.id;
  logger.info({ uid }, "[VERIFICATION] Completing verification");

  try {
    const globalVersion = await getVerificationVersion();
    await db
      .update(usersTable)
      .set({ isVerified: true, verificationVersion: globalVersion })
      .where(eq(usersTable.id, uid));

    logger.info({ uid, globalVersion }, "[VERIFICATION] User marked as verified");

    const successText = [
      `◉ ─〔 ACCESS GRANTED ✦ 〕──────────`,
      `│`,
      `│  ◎  Identity verified.`,
      `│  ◌  Welcome to the system.`,
      `│`,
      `──────────────────────────────────`,
    ].join("\n");

    try {
      await ctx.editMessageText(successText, Markup.inlineKeyboard([]));
    } catch {
      await ctx.reply(successText);
    }

    await sleep(1200);

    // Clean up the verification message
    try {
      if (ctx.callbackQuery && "message" in ctx.callbackQuery) {
        await safeDelete(ctx.telegram, ctx.chat!.id, ctx.callbackQuery.message!.message_id);
      }
    } catch { /* ignore */ }

    // Reload fresh user
    const [updated] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, uid))
      .limit(1);
    ctx.dbUser = updated;

    const { awardReferralPoints } = await import("./referral.js");
    await awardReferralPoints(ctx);

    const { showMainMenu } = await import("./main-menu.js");
    await showMainMenu(ctx, true);

    logger.info({ uid }, "[VERIFICATION] Verification flow complete — main menu shown");
  } catch (err) {
    logger.error({ err, uid }, "[VERIFICATION] completeVerification threw");
    await ctx.reply(alertPanel("ERROR", ["Verification partially failed.", "Try /start."])).catch(() => {});
  }
}
