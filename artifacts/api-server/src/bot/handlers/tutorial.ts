import { Markup } from "telegraf";
import type { BotContext } from "../types.js";
import { TUTORIAL_CHANNEL_ID, TUTORIAL_MESSAGE_ID } from "../config.js";
import { panel } from "../utils/format.js";

export async function showTutorial(ctx: BotContext): Promise<void> {
  await ctx.answerCbQuery();

  try {
    await ctx.telegram.copyMessage(
      ctx.chat!.id,
      TUTORIAL_CHANNEL_ID,
      TUTORIAL_MESSAGE_ID
    );
  } catch {
    const text = panel("TUTORIAL", [
      "◈  Tutorial unavailable.",
      "◌  Contact admin for help.",
    ]);
    await ctx.reply(
      text,
      Markup.inlineKeyboard([[Markup.button.callback("« BACK", "menu")]])
    );
  }

  await ctx.reply(
    "« Return to menu",
    Markup.inlineKeyboard([[Markup.button.callback("« BACK TO MENU", "menu")]])
  );
}
