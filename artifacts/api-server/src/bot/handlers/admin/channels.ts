import { Markup } from "telegraf";
import { db, channelsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { BotContext } from "../../types.js";
import { stepConsole, successPanel, alertPanel } from "../../utils/format.js";
import { setConvo, clearConvo } from "../../convo-state.js";

export async function startAddChannel(ctx: BotContext): Promise<void> {
  await ctx.answerCbQuery();
  setConvo(ctx.from!.id, { type: "add_channel_id", data: {} });

  const text = stepConsole("ADD CHANNEL", 1, 3, [
    `◎  Enter Channel ID:`,
    `◌  e.g. -1001234567890`,
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

export async function handleChannelId(ctx: BotContext, channelId: string): Promise<void> {
  setConvo(ctx.from!.id, { type: "add_channel_name", data: { channelId: channelId.trim() } });

  const text = stepConsole("ADD CHANNEL", 2, 3, [
    `◎  Enter Channel Name:`,
    `◌  e.g. Main Channel`,
  ]);

  await ctx.reply(
    text,
    Markup.inlineKeyboard([[Markup.button.callback("⎋  CANCEL", "admin")]])
  );
}

export async function handleChannelName(
  ctx: BotContext,
  name: string,
  prevData: Record<string, unknown>
): Promise<void> {
  setConvo(ctx.from!.id, {
    type: "add_channel_link",
    data: { ...prevData, channelName: name.trim() },
  });

  const text = stepConsole("ADD CHANNEL", 3, 3, [
    `◎  Enter Channel Link:`,
    `◌  e.g. https://t.me/channel`,
  ]);

  await ctx.reply(
    text,
    Markup.inlineKeyboard([[Markup.button.callback("⎋  CANCEL", "admin")]])
  );
}

export async function handleChannelLink(
  ctx: BotContext,
  link: string,
  prevData: Record<string, unknown>
): Promise<void> {
  clearConvo(ctx.from!.id);

  const { channelId, channelName } = prevData as {
    channelId: string;
    channelName: string;
  };

  await db.insert(channelsTable).values({
    channelId,
    channelName,
    channelLink: link.trim(),
    isActive: true,
  });

  const text = successPanel("CHANNEL ADDED", [
    `◈  Name ···  ${channelName}`,
    `◎  ID ·····  ${channelId}`,
    `◌  Added to verification.`,
  ]);

  await ctx.reply(
    text,
    Markup.inlineKeyboard([[Markup.button.callback("« BACK", "admin")]])
  );
}

export async function showRemoveChannels(ctx: BotContext): Promise<void> {
  await ctx.answerCbQuery();

  const channels = await db
    .select()
    .from(channelsTable)
    .where(eq(channelsTable.isActive, true));

  if (channels.length === 0) {
    const text = alertPanel("NO CHANNELS", ["No active channels configured."]);
    try {
      await ctx.editMessageText(
        text,
        Markup.inlineKeyboard([[Markup.button.callback("« BACK", "admin")]])
      );
    } catch {
      await ctx.reply(
        text,
        Markup.inlineKeyboard([[Markup.button.callback("« BACK", "admin")]])
      );
    }
    return;
  }

  const buttons = channels.map((ch) => [
    Markup.button.callback(`⎋  ${ch.channelName}`, `adm_rem_ch_${ch.id}`),
  ]);
  buttons.push([Markup.button.callback("« BACK", "admin")]);

  const text = [
    `╔══〔 REMOVE CHANNEL 〕══╗`,
    `║  ◌  Select to deactivate:`,
    `╚════════════════════════╝`,
  ].join("\n");

  try {
    await ctx.editMessageText(text, Markup.inlineKeyboard(buttons));
  } catch {
    await ctx.reply(text, Markup.inlineKeyboard(buttons));
  }
}

export async function handleRemoveChannel(
  ctx: BotContext,
  channelDbId: number
): Promise<void> {
  await ctx.answerCbQuery();

  await db
    .update(channelsTable)
    .set({ isActive: false })
    .where(eq(channelsTable.id, channelDbId));

  const text = successPanel("CHANNEL REMOVED", [
    `◉  Channel deactivated.`,
    `◌  No longer required for verify.`,
  ]);

  try {
    await ctx.editMessageText(
      text,
      Markup.inlineKeyboard([[Markup.button.callback("« BACK", "admin")]])
    );
  } catch {
    await ctx.reply(
      text,
      Markup.inlineKeyboard([[Markup.button.callback("« BACK", "admin")]])
    );
  }
}
