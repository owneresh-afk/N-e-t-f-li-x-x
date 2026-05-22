import { Markup } from "telegraf";
import { db, accountsTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";
import type { BotContext } from "../types.js";
import { stockPanel } from "../utils/format.js";

export async function showStock(ctx: BotContext): Promise<void> {
  const [[availRow], [totalRow]] = await Promise.all([
    db.select({ count: count() }).from(accountsTable).where(eq(accountsTable.isUsed, false)),
    db.select({ count: count() }).from(accountsTable),
  ]);

  const available = Number(availRow?.count ?? 0);
  const total = Number(totalRow?.count ?? 0);
  const used = total - available;

  const text = stockPanel(available, used, total);

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback("« BACK", "menu")],
  ]);

  try {
    await ctx.editMessageText(text, keyboard);
  } catch {
    await ctx.reply(text, keyboard);
  }
}
