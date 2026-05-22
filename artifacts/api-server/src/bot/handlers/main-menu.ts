import { Markup } from "telegraf";
import { db, usersTable, accountsTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";
import type { BotContext } from "../types.js";
import { ctrlPanel } from "../utils/format.js";
import { safeDelete } from "../utils/safe-delete.js";

export const MAIN_MENU_KEYBOARD = Markup.inlineKeyboard([
  [
    Markup.button.callback("◈  MY PROFILE", "profile"),
    Markup.button.callback("◆  REDEEM", "redeem"),
  ],
  [
    Markup.button.callback("◎  TUTORIAL", "tutorial"),
    Markup.button.callback("◌  DAILY REWARDS", "daily"),
  ],
  [
    Markup.button.callback("⟡  REFER & EARN", "refer"),
    Markup.button.callback("▣  BALANCE", "balance"),
  ],
  [Markup.button.callback("⬢  AVAILABLE STOCK", "stock")],
]);

export async function showMainMenu(
  ctx: BotContext,
  newMessage = false
): Promise<void> {
  const user = ctx.dbUser;
  if (!user) return;

  const [stockRow] = await db
    .select({ count: count() })
    .from(accountsTable)
    .where(eq(accountsTable.isUsed, false));

  const stockCount = Number(stockRow?.count ?? 0);
  const displayName = user.username ? `@${user.username}` : user.firstName;
  const text = ctrlPanel(displayName, user.balance, stockCount);

  if (newMessage) {
    await safeDelete(ctx.telegram, ctx.chat!.id, user.activeMessageId);
    const msg = await ctx.reply(text, MAIN_MENU_KEYBOARD);
    await db
      .update(usersTable)
      .set({ activeMessageId: msg.message_id })
      .where(eq(usersTable.id, ctx.from!.id));
  } else {
    try {
      await ctx.editMessageText(text, MAIN_MENU_KEYBOARD);
    } catch {
      await safeDelete(ctx.telegram, ctx.chat!.id, user.activeMessageId);
      const msg = await ctx.reply(text, MAIN_MENU_KEYBOARD);
      await db
        .update(usersTable)
        .set({ activeMessageId: msg.message_id })
        .where(eq(usersTable.id, ctx.from!.id));
    }
  }
}
