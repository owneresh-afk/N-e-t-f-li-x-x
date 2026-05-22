import { Markup } from "telegraf";
import type { BotContext } from "../types.js";
import { minimalPanel } from "../utils/format.js";
import { REFERRAL_POINTS } from "../config.js";
import { editAnimated, LINK_FRAMES } from "../utils/animations.js";
import { db, usersTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";

export async function showReferral(ctx: BotContext): Promise<void> {
  await ctx.answerCbQuery();
  const user = ctx.dbUser;
  if (!user) return;

  const msgId =
    ctx.callbackQuery && "message" in ctx.callbackQuery
      ? ctx.callbackQuery.message?.message_id
      : null;

  if (msgId) {
    await editAnimated(ctx, msgId, LINK_FRAMES, 400);
  }

  const botInfo = await ctx.telegram.getMe();
  const refLink = `https://t.me/${botInfo.username}?start=${user.id}`;

  const [refRow] = await db
    .select({ count: count() })
    .from(usersTable)
    .where(eq(usersTable.referredBy, user.id));

  const refCount = Number(refRow?.count ?? 0);
  const refEarnings = refCount * REFERRAL_POINTS;

  const text = minimalPanel("REFER & EARN", [
    `⟡  Per referral ·  ${REFERRAL_POINTS} pts`,
    `◎  Total refs ···  ${refCount}`,
    `◆  Total earned ·  ${refEarnings} pts`,
    `──────────────────────`,
    `◌  Your referral link:`,
    ``,
    `${refLink}`,
  ]);

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback("« BACK TO MENU", "menu")],
  ]);

  try {
    await ctx.editMessageText(text, keyboard);
  } catch {
    await ctx.reply(text, keyboard);
  }
}

export async function handleReferral(
  ctx: BotContext,
  referrerId: number
): Promise<void> {
  const user = ctx.dbUser;
  if (!user) return;
  if (referrerId === user.id) return;
  if (user.referredBy !== null) return;

  const [referrer] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, referrerId))
    .limit(1);

  if (!referrer) return;

  await db
    .update(usersTable)
    .set({ referredBy: referrerId })
    .where(eq(usersTable.id, user.id));
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

  try {
    await ctx.telegram.sendMessage(
      referrer.id,
      [
        `◉ ─〔 REFERRAL BONUS ✦ 〕──────────`,
        `│`,
        `│  ⟡  +${REFERRAL_POINTS} pts earned`,
        `│  ◈  A new referral verified.`,
        `│  ◎  Balance ···  ${referrer.balance + REFERRAL_POINTS} pts`,
        `│`,
        `──────────────────────────────────`,
      ].join("\n")
    );
  } catch {
    // User may have blocked the bot
  }
}
