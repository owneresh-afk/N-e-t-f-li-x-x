import { Markup } from "telegraf";
import type { BotContext } from "../types.js";
import { TUTORIAL_CHANNEL_ID, TUTORIAL_MESSAGE_ID } from "../config.js";
import { panel } from "../utils/format.js";

export async function showTutorial(ctx: BotContext): Promise<void> {
  await ctx.answerCbQuery();

  let sent = false;
  try {
    await ctx.telegram.copyMessage(
      ctx.chat!.id,
      TUTORIAL_CHANNEL_ID,
      TUTORIAL_MESSAGE_ID
    );
    sent = true;
  } catch {
    // Tutorial channel not reachable
  }

  const resultText = sent
    ? panel("TUTORIAL ✦", [
        "◉  Tutorial sent above.",
        "◌  Scroll up to view it.",
      ])
    : panel("TUTORIAL", [
        "◈  Tutorial unavailable.",
        "◌  Contact admin for help.",
      ]);

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback("« BACK TO MENU", "menu")],
  ]);

  try {
    await ctx.editMessageText(resultText, keyboard);
  } catch {
    await ctx.reply(resultText, keyboard);
  }
}
