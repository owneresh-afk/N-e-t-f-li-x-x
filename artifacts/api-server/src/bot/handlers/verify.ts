import { Markup } from "telegraf";
import type { InlineKeyboardButton } from "telegraf/types";
import { db, usersTable, channelsTable, settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { BotContext } from "../types.js";
import { panel } from "../utils/format.js";
import { safeDelete } from "../utils/safe-delete.js";
import { sendAnimated, SCAN_FRAMES } from "../utils/animations.js";
import { sleep } from "../utils/sleep.js";

export async function getVerificationVersion(): Promise<number> {
  const rows = await db
    .select()
    .from(settingsTable)
    .where(eq(settingsTable.key, "verification_version"))
    .limit(1);
  if (rows.length === 0) return 0;
  return parseInt(rows[0]!.value, 10) || 0;
}

export async function needsVerification(ctx: BotContext): Promise<boolean> {
  const user = ctx.dbUser;
  if (!user) return true;
  const globalVersion = await getVerificationVersion();
  if (user.verificationVersion < globalVersion) return true;
  return !user.isVerified;
}

export async function checkChannelMembership(
  ctx: BotContext,
  channelId: string
): Promise<boolean> {
  try {
    const member = await ctx.telegram.getChatMember(channelId, ctx.from!.id);
    return ["member", "administrator", "creator", "restricted"].includes(
      member.status
    );
  } catch {
    return false;
  }
}

function buildVerifyKeyboard(channels: Array<{ channelName: string; channelLink: string }>) {
  const rows: InlineKeyboardButton[][] = channels.map((ch) => [
    { text: `➜  ${ch.channelName}`, url: ch.channelLink },
  ]);
  rows.push([{ text: "⟦ VERIFY ⟧", callback_data: "verify" }]);
  return Markup.inlineKeyboard(rows);
}

export async function showVerificationPanel(ctx: BotContext): Promise<void> {
  const channels = await db
    .select()
    .from(channelsTable)
    .where(eq(channelsTable.isActive, true));

  const text = channels.length === 0
    ? panel("VERIFICATION", [
        "◈  No channels configured yet.",
        "◎  Contact admin.",
      ])
    : panel("VERIFICATION REQUIRED", [
        "◎  Join all channels below",
        "◌  Then press VERIFY",
        "─────────────────────",
        `◈  ${channels.length} channel(s) required`,
      ]);

  const msg = await ctx.reply(text, buildVerifyKeyboard(channels));

  // Store active message
  if (ctx.dbUser) {
    await db
      .update(usersTable)
      .set({ activeMessageId: msg.message_id })
      .where(eq(usersTable.id, ctx.from!.id));
  }
}

export async function handleVerify(ctx: BotContext): Promise<void> {
  await ctx.answerCbQuery();

  const user = ctx.dbUser;
  if (!user) return;

  const channels = await db
    .select()
    .from(channelsTable)
    .where(eq(channelsTable.isActive, true));

  // Scan animation
  const animId = await sendAnimated(ctx, SCAN_FRAMES, 450);
  await sleep(400);
  await safeDelete(ctx.telegram, ctx.chat!.id, animId);

  if (channels.length === 0) {
    await completeVerification(ctx);
    return;
  }

  const results = await Promise.all(
    channels.map((ch) => checkChannelMembership(ctx, ch.channelId))
  );
  const allJoined = results.every(Boolean);

  if (!allJoined) {
    const failText = panel("VERIFICATION FAILED", [
      "◈  Not all channels joined.",
      "◌  Join all and try again.",
    ]);
    try {
      await ctx.editMessageText(failText, buildVerifyKeyboard(channels));
    } catch {
      await ctx.reply(failText, buildVerifyKeyboard(channels));
    }
    return;
  }

  await completeVerification(ctx);
}

async function completeVerification(ctx: BotContext): Promise<void> {
  const globalVersion = await getVerificationVersion();
  await db
    .update(usersTable)
    .set({ isVerified: true, verificationVersion: globalVersion })
    .where(eq(usersTable.id, ctx.from!.id));

  const successText = panel("VERIFIED ✦", [
    "◉  Access granted.",
    "◎  Welcome to the system.",
  ]);

  try {
    await ctx.editMessageText(successText, Markup.inlineKeyboard([]));
  } catch {
    await ctx.reply(successText);
  }

  await sleep(1200);

  // Delete verification message
  try {
    if (ctx.callbackQuery && "message" in ctx.callbackQuery) {
      await safeDelete(
        ctx.telegram,
        ctx.chat!.id,
        ctx.callbackQuery.message!.message_id
      );
    }
  } catch {
    // ignore
  }

  // Refresh dbUser
  const [updated] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, ctx.from!.id))
    .limit(1);
  ctx.dbUser = updated;

  // Award referral points if applicable
  const { awardReferralPoints } = await import("./referral.js");
  await awardReferralPoints(ctx);

  const { showMainMenu } = await import("./main-menu.js");
  await showMainMenu(ctx, true);
}
