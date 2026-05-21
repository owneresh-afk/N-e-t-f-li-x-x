import { Markup } from "telegraf";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { BotContext } from "../types.js";
import { panel, timeUntil } from "../utils/format.js";
import { DAILY_POINTS } from "../config.js";
import { sendAnimated, CLAIM_FRAMES } from "../utils/animations.js";
import { safeDelete } from "../utils/safe-delete.js";
import { sleep } from "../utils/sleep.js";

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
    ? panel("DAILY REWARDS", [
        `◈  Reward ── ${DAILY_POINTS} pts`,
        `◎  Status ── AVAILABLE`,
        "─────────────────────",
        "◉  Ready to claim!",
      ])
    : panel("DAILY REWARDS", [
        `◈  Reward ── ${DAILY_POINTS} pts`,
        `◎  Status ── CLAIMED`,
        "─────────────────────",
        `◌  Next in: ${timeUntil(nextClaim)}`,
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

  // Animate claim
  const animId = await sendAnimated(ctx, CLAIM_FRAMES, 450);
  await sleep(300);
  await safeDelete(ctx.telegram, ctx.chat!.id, animId);

  const newBalance = user.balance + DAILY_POINTS;
  await db
    .update(usersTable)
    .set({ balance: newBalance, lastDailyClaim: now })
    .where(eq(usersTable.id, user.id));

  const text = panel("REWARD CLAIMED ✦", [
    `◉  +${DAILY_POINTS} pts added`,
    `◈  Balance: ${newBalance} pts`,
    "─────────────────────",
    "◎  Come back in 24h",
  ]);

  await ctx.reply(
    text,
    Markup.inlineKeyboard([[Markup.button.callback("« BACK TO MENU", "menu")]])
  );
}
