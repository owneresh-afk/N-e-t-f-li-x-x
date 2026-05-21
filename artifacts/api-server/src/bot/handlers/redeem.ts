import { Markup } from "telegraf";
import { db, usersTable, accountsTable } from "@workspace/db";
import { eq, asc, count } from "drizzle-orm";
import type { BotContext } from "../types.js";
import { panel } from "../utils/format.js";
import { REDEEM_COST, DB_CHANNEL_ID } from "../config.js";
import { editAnimated, REDEEM_FRAMES } from "../utils/animations.js";

export async function showRedeemConfirm(ctx: BotContext): Promise<void> {
  const user = ctx.dbUser;
  if (!user) return;

  const [stockRow] = await db
    .select({ count: count() })
    .from(accountsTable)
    .where(eq(accountsTable.isUsed, false));

  const stockCount = Number(stockRow?.count ?? 0);

  if (stockCount === 0) {
    const text = panel("OUT OF STOCK", [
      "◈  No accounts available.",
      "◌  Check back later.",
    ]);
    try {
      await ctx.editMessageText(
        text,
        Markup.inlineKeyboard([[Markup.button.callback("« BACK", "menu")]])
      );
    } catch {
      await ctx.reply(
        text,
        Markup.inlineKeyboard([[Markup.button.callback("« BACK", "menu")]])
      );
    }
    return;
  }

  const text = panel("REDEEM ACCOUNT", [
    `◈  Cost ──── ${REDEEM_COST} pt`,
    `◎  Balance ─ ${user.balance} pts`,
    `◌  Stock ─── ${stockCount} files`,
    "─────────────────────",
    user.balance >= REDEEM_COST
      ? "◉  Sufficient balance."
      : "⎋  Insufficient balance.",
  ]);

  const keyboard =
    user.balance >= REDEEM_COST
      ? Markup.inlineKeyboard([
          [Markup.button.callback("⟦ CONFIRM REDEEM ⟧", "redeem_confirm")],
          [Markup.button.callback("« BACK", "menu")],
        ])
      : Markup.inlineKeyboard([[Markup.button.callback("« BACK", "menu")]]);

  try {
    await ctx.editMessageText(text, keyboard);
  } catch {
    await ctx.reply(text, keyboard);
  }
}

export async function handleRedeemConfirm(ctx: BotContext): Promise<void> {
  await ctx.answerCbQuery();
  const user = ctx.dbUser;
  if (!user) return;

  if (user.balance < REDEEM_COST) {
    await ctx.answerCbQuery("⎋  Insufficient balance.");
    return;
  }

  // Animate in-place on the current menu message
  const msgId =
    ctx.callbackQuery && "message" in ctx.callbackQuery
      ? ctx.callbackQuery.message?.message_id
      : null;

  if (msgId) {
    await editAnimated(ctx, msgId, REDEEM_FRAMES, 420);
  }

  // Fetch first unused account
  const [account] = await db
    .select()
    .from(accountsTable)
    .where(eq(accountsTable.isUsed, false))
    .orderBy(asc(accountsTable.id))
    .limit(1);

  if (!account) {
    const text = panel("OUT OF STOCK", [
      "◈  No accounts available.",
      "◌  Check back later.",
    ]);
    try {
      await ctx.editMessageText(
        text,
        Markup.inlineKeyboard([[Markup.button.callback("« BACK", "menu")]])
      );
    } catch {
      await ctx.reply(
        text,
        Markup.inlineKeyboard([[Markup.button.callback("« BACK", "menu")]])
      );
    }
    return;
  }

  // Mark as used and deduct points
  await db
    .update(accountsTable)
    .set({ isUsed: true, usedBy: user.id, usedAt: new Date() })
    .where(eq(accountsTable.id, account.id));

  const newBalance = user.balance - REDEEM_COST;
  await db
    .update(usersTable)
    .set({
      balance: newBalance,
      totalRedeems: user.totalRedeems + 1,
    })
    .where(eq(usersTable.id, user.id));

  // Forward the actual .txt file from DB channel
  try {
    await ctx.telegram.forwardMessage(ctx.chat!.id, DB_CHANNEL_ID, account.messageId);
  } catch {
    // Fallback: send the direct link if forward fails
    await ctx.reply(
      panel("ACCOUNT READY", [
        `◈  File: ${account.fileName}`,
        `◎  Link: ${account.messageLink}`,
      ])
    );
  }

  // Edit the menu message to show success with back button
  const successText = panel("REDEEM SUCCESS ✦", [
    `◉  File delivered above.`,
    `◈  Cost: ${REDEEM_COST} pt`,
    `◎  Remaining: ${newBalance} pts`,
  ]);

  try {
    await ctx.editMessageText(
      successText,
      Markup.inlineKeyboard([[Markup.button.callback("« BACK TO MENU", "menu")]])
    );
  } catch {
    await ctx.reply(
      successText,
      Markup.inlineKeyboard([[Markup.button.callback("« BACK TO MENU", "menu")]])
    );
  }
}
