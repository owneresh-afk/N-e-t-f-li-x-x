import { Markup } from "telegraf";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { BotContext } from "../types.js";
import { minimalPanel, timeUntil } from "../utils/format.js";
import { DAILY_POINTS } from "../config.js";
import { editAnimated, CLAIM_FRAMES } from "../utils/animations.js";

const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

export async function showDaily(ctx: BotContext): Promise<void> {
  const user = ctx.dbUser;
  if (!user) return;

  const now = new Date();
  const lastClaim = user.lastDailyClaim;
  const canClaim =
    !lastClaim || now.getTime() - lastClaim.getTime() >= TWENTY_FOUR_HOURS;

  const nextClaim = lastClaim
    ? new Date(lastClaim.getTime() + TWENTY_FOUR_HOURS)
    : now;

  const text = canClaim
    ? minimalPanel("DAILY REWARD", [
        `◈  Reward ·····  ${DAILY_POINTS} pts`,
        `◎  Status ·····  AVAILABLE`,
        `──────────────────────`,
        `◉  Ready to claim`,
      ])
    : minimalPanel("DAILY REWARD", [
        `◈  Reward ·····  ${DAILY_POINTS} pts`,
        `◎  Status ·····  CLAIMED`,
        `──────────────────────`,
        `◌  Next in ·  ${timeUntil(nextClaim)}`,
      ]);

  const keyboard = canClaim
    ? Markup.inlineKeyboard([
        [Markup.button.callback("⟦ CLAIM REWARD ⟧", "daily_claim")],
        [Markup.button.callback("« BACK", "menu")],
      ])
    : Markup.inlineKeyboard([[Markup.button.callback("« BACK", "menu")]]);

  try {
    await ctx.editMessageText(text, keyboard);
  } catch {
    await ctx.reply(text, keyboard);
  }
}

export async function handleDailyClaim(ctx: BotContext): Promise<void> {
  await ctx.answerCbQuery();
  const user = ctx.dbUser;
  if (!user) return;

  const now = new Date();
  const lastClaim = user.lastDailyClaim;
  const canClaim =
    !lastClaim || now.getTime() - lastClaim.getTime() >= TWENTY_FOUR_HOURS;

  if (!canClaim) {
    const nextClaim = new Date(lastClaim!.getTime() + TWENTY_FOUR_HOURS);
    await ctx.answerCbQuery(`Already claimed. Next in ${timeUntil(nextClaim)}`);
    return;
  }

  const msgId =
    ctx.callbackQuery && "message" in ctx.callbackQuery
      ? ctx.callbackQuery.message?.message_id
      : null;

  if (msgId) {
    await editAnimated(ctx, msgId, CLAIM_FRAMES, 400);
  }

  const newBalance = user.balance + DAILY_POINTS;
  await db
    .update(usersTable)
    .set({ balance: newBalance, lastDailyClaim: now })
    .where(eq(usersTable.id, user.id));

  const successText = minimalPanel("REWARD CLAIMED", [
    `◉  +${DAILY_POINTS} pts credited`,
    `◈  Balance ···  ${newBalance} pts`,
    `──────────────────────`,
    `◌  Come back in 24h`,
  ]);

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback("« BACK TO MENU", "menu")],
  ]);

  try {
    await ctx.editMessageText(successText, keyboard);
  } catch {
    await ctx.reply(successText, keyboard);
  }
}
