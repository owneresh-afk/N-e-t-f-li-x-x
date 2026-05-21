import { Markup } from "telegraf";
import type { BotContext } from "../types.js";
import { panel, formatDate } from "../utils/format.js";

export async function showProfile(ctx: BotContext): Promise<void> {
  const user = ctx.dbUser;
  if (!user) return;

  const displayName = user.username ? `@${user.username}` : user.firstName;
  const text = panel("MY PROFILE", [
    `◈  ${displayName}`,
    `◎  ID ─────── ${user.id}`,
    "─────────────────────",
    `◆  Balance ── ${user.balance} pts`,
    `⟡  Referrals ─ ${user.totalReferrals}`,
    `▣  Redeems ── ${user.totalRedeems}`,
    "─────────────────────",
    `◌  Joined ─── ${formatDate(user.joinDate)}`,
    `◉  Status ─── ${user.isVerified ? "VERIFIED" : "UNVERIFIED"}`,
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
