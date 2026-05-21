import { Markup } from "telegraf";
import type { BotContext } from "../types.js";
import { panel } from "../utils/format.js";
import { REFERRAL_POINTS } from "../config.js";
import { sendAnimated, LINK_FRAMES } from "../utils/animations.js";
import { safeDelete } from "../utils/safe-delete.js";
import { sleep } from "../utils/sleep.js";
import { db, usersTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";

export async function showReferral(ctx: BotContext): Promise<void> {
  await ctx.answerCbQuery();
  const user = ctx.dbUser;
  if (!user) return;

  // Animate link generation
  const animId = await sendAnimated(ctx, LINK_FRAMES, 450);
  await sleep(300);
  await safeDelete(ctx.telegram, ctx.chat!.id, animId);

  const botInfo = await ctx.telegram.getMe();
  const refLink = `https://t.me/${botInfo.username}?start=${user.id}`;

  // Count referrals
  const [refRow] = await db
    .select({ count: count() })
    .from(usersTable)
    .where(eq(usersTable.referredBy, user.id));

  const refCount = Number(refRow?.count ?? 0);
  const refEarnings = refCount * REFERRAL_POINTS;

  const text = panel("REFER & EARN", [
    `◈  Per referral ─ ${REFERRAL_POINTS} pts`,
    `◎  Total refs ─── ${refCount}`,
    `◆  Total earned ─ ${refEarnings} pts`,
    "─────────────────────",
    "◌  Your referral link:",
    `  ${refLink}`,
  ]);

  await ctx.reply(
    text,
    Markup.inlineKeyboard([[Markup.button.callback("« BACK TO MENU", "menu")]])
  );
}

export async function handleReferral(
  ctx: BotContext,
  referrerId: number
): Promise<void> {
  const user = ctx.dbUser;
  if (!user) return;

  // Prevent self-referral and duplicate
  if (referrerId === user.id) return;
  if (user.referredBy !== null) return;

  // Check referrer exists
  const [referrer] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, referrerId))
    .limit(1);

  if (!referrer) return;

  // Mark referred
  await db
    .update(usersTable)
    .set({ referredBy: referrerId })
    .where(eq(usersTable.id, user.id));

  // Award points to referrer when this user gets verified
  // Points are awarded at verification time — see verify.ts
}

export async function awardReferralPoints(ctx: BotContext): Promise<void> {
  const user = ctx.dbUser;
  if (!user || !user.referredBy) return;

  const [referrer] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, user.referredBy))
    .limit(1);

  if (!referrer) return;

  await db
    .update(usersTable)
    .set({
      balance: referrer.balance + REFERRAL_POINTS,
      totalReferrals: referrer.totalReferrals + 1,
    })
    .where(eq(usersTable.id, referrer.id));

  // Notify referrer
  try {
    await ctx.telegram.sendMessage(
      referrer.id,
      panel("REFERRAL BONUS ✦", [
        `◉  +${REFERRAL_POINTS} pts earned`,
        `◈  A referral verified.`,
        `◎  New balance: ${referrer.balance + REFERRAL_POINTS} pts`,
      ])
    );
  } catch {
    // User may have blocked the bot
  }
}
