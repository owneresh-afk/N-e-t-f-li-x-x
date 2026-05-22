import { Markup } from "telegraf";
import { db, usersTable } from "@workspace/db";
import type { BotContext } from "../../types.js";
import { broadcastPanel, broadcastCompletePanel, stepConsole } from "../../utils/format.js";
import { setConvo, clearConvo } from "../../convo-state.js";
import { sleep } from "../../utils/sleep.js";

export async function startBroadcast(ctx: BotContext): Promise<void> {
  await ctx.answerCbQuery();
  setConvo(ctx.from!.id, { type: "broadcast", data: {} });

  const text = stepConsole("BROADCAST", 1, 1, [
    `◎  Send your message below.`,
    `◌  It will reach all users.`,
  ]);

  try {
    await ctx.editMessageText(
      text,
      Markup.inlineKeyboard([[Markup.button.callback("⎋  CANCEL", "admin")]])
    );
  } catch {
    await ctx.reply(
      text,
      Markup.inlineKeyboard([[Markup.button.callback("⎋  CANCEL", "admin")]])
    );
  }
}

export async function handleBroadcastMessage(
  ctx: BotContext,
  messageId: number
): Promise<void> {
  clearConvo(ctx.from!.id);

  const users = await db.select({ id: usersTable.id }).from(usersTable);
  const total = users.length;

  const statusMsg = await ctx.reply(broadcastPanel(0, total, 0, 0));

  let success = 0;
  let failed = 0;
  const chatId = ctx.chat!.id;

  for (let i = 0; i < users.length; i++) {
    try {
      await ctx.telegram.copyMessage(users[i]!.id, chatId, messageId);
      success++;
    } catch {
      failed++;
    }

    if ((i + 1) % 10 === 0 || i === users.length - 1) {
      try {
        await ctx.telegram.editMessageText(
          chatId,
          statusMsg.message_id,
          undefined,
          broadcastPanel(i + 1, total, success, failed)
        );
      } catch {
        // ignore
      }
      await sleep(50);
    }
  }

  const finalText = broadcastCompletePanel(success, failed, total);
  try {
    await ctx.telegram.editMessageText(
      chatId,
      statusMsg.message_id,
      undefined,
      finalText,
      Markup.inlineKeyboard([[Markup.button.callback("« BACK", "admin")]])
    );
  } catch {
    await ctx.reply(
      finalText,
      Markup.inlineKeyboard([[Markup.button.callback("« BACK", "admin")]])
    );
  }
}
