import { Markup } from "telegraf";
import { db, usersTable } from "@workspace/db";
import type { BotContext } from "../../types.js";
import { panel } from "../../utils/format.js";
import { setConvo, clearConvo } from "../../convo-state.js";
import { sleep } from "../../utils/sleep.js";

export async function startBroadcast(ctx: BotContext): Promise<void> {
  await ctx.answerCbQuery();
  const text = panel("BROADCAST", [
    "◈  Send your message.",
    "◌  All users will receive it.",
    "─────────────────────",
    "◎  Type message now:",
  ]);

  setConvo(ctx.from!.id, { type: "broadcast", data: {} });

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

  const progressText = panel("BROADCASTING", [
    `◈  Total: ${total}`,
    `◎  Status: SENDING...`,
  ]);

  const statusMsg = await ctx.reply(progressText);

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

    // Update progress every 10 users
    if ((i + 1) % 10 === 0 || i === users.length - 1) {
      try {
        const progressBar = buildProgress(i + 1, total);
        await ctx.telegram.editMessageText(
          chatId,
          statusMsg.message_id,
          undefined,
          panel("BROADCASTING", [
            `◈  Progress: ${i + 1}/${total}`,
            `  ${progressBar}`,
            `◎  Success: ${success}`,
            `◌  Failed:  ${failed}`,
          ])
        );
      } catch {
        // ignore edit errors
      }
      await sleep(50);
    }
  }

  const finalText = panel("BROADCAST COMPLETE ✦", [
    `◈  Sent ──── ${success}`,
    `◌  Failed ── ${failed}`,
    `◎  Total ─── ${total}`,
  ]);

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

function buildProgress(done: number, total: number): string {
  if (total === 0) return "▁▁▁▁▁▁▁▁";
  const pct = Math.round((done / total) * 8);
  return "█".repeat(pct) + "▁".repeat(8 - pct);
}
