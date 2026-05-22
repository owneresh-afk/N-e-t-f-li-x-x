import { Markup } from "telegraf";
import type { BotContext } from "../../types.js";
import { consolePanel } from "../../utils/format.js";

export async function showAdminPanel(ctx: BotContext): Promise<void> {
  const adminName = ctx.from?.username ? `@${ctx.from.username}` : "Admin";
  const text = consolePanel(
    [`⌘  ELEVATED ACCESS`, `◈  ${adminName}`],
    [`›  Select an operation:`]
  );

  const keyboard = Markup.inlineKeyboard([
    [
      Markup.button.callback("◆  STATISTICS", "adm_stats"),
      Markup.button.callback("⟡  BROADCAST", "adm_broadcast"),
    ],
    [
      Markup.button.callback("◈  GEN CODES", "adm_codes"),
      Markup.button.callback("▣  STOCK MGR", "adm_stock"),
    ],
    [
      Markup.button.callback("➜  ADD CHANNEL", "adm_add_ch"),
      Markup.button.callback("⎋  REM CHANNEL", "adm_rem_ch"),
    ],
    [Markup.button.callback("⟳  RESTART VERIFY", "adm_reverify")],
  ]);

  if (ctx.callbackQuery) {
    try {
      await ctx.editMessageText(text, keyboard);
      return;
    } catch {
      // fall through
    }
  }
  await ctx.reply(text, keyboard);
}
