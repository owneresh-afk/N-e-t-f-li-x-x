import { Markup } from "telegraf";
import type { BotContext } from "../types.js";
import { minimalPanel } from "../utils/format.js";

export async function showBalance(ctx: BotContext): Promise<void> {
  const user = ctx.dbUser;
  if (!user) return;

  const text = minimalPanel("BALANCE", [
    `▣  Current ···  ${user.balance} pts`,
    `──────────────────────`,
    `◆  Redeems ···  ${user.totalRedeems}`,
    `⟡  Referrals ··  ${user.totalReferrals}`,
  ]);

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback("« BACK", "menu")],
  ]);

  try {
    await ctx.editMessageText(text, keyboard);
  } catch {
    await ctx.reply(text, keyboard);
  }
}
