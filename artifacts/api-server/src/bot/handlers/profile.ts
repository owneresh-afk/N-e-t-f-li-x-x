import { Markup } from "telegraf";
import type { BotContext } from "../types.js";
import { userCard, formatDate } from "../utils/format.js";

export async function showProfile(ctx: BotContext): Promise<void> {
  const user = ctx.dbUser;
  if (!user) return;

  const displayName = user.username ? `@${user.username}` : user.firstName;
  const text = userCard(
    displayName,
    user.id,
    user.balance,
    user.totalReferrals,
    user.totalRedeems,
    formatDate(user.joinDate),
    user.isVerified
  );

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback("« BACK", "menu")],
  ]);

  try {
    await ctx.editMessageText(text, keyboard);
  } catch {
    await ctx.reply(text, keyboard);
  }
}
