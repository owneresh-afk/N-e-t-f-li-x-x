import { Markup } from "telegraf";
import type { BotContext } from "../types.js";
import { panel } from "../utils/format.js";

export async function showBalance(ctx: BotContext): Promise<void> {
  const user = ctx.dbUser;
  if (!user) return;

  const text = panel("BALANCE", [
    `◈  Current ── ${user.balance} pts`,
    "─────────────────────",
    `◆  Redeems ─ ${user.totalRedeems}`,
    `⟡  Referrals ─ ${user.totalReferrals}`,
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
}
