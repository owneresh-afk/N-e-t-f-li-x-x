import { Markup } from "telegraf";
import { db, channelsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { BotContext } from "../../types.js";
import { panel } from "../../utils/format.js";
import { setConvo, clearConvo } from "../../convo-state.js";

export async function startAddChannel(ctx: BotContext): Promise<void> {
  await ctx.answerCbQuery();
  setConvo(ctx.from!.id, { type: "add_channel_id", data: {} });

  const text = panel("ADD CHANNEL", [
    "◈  Step 1 of 3",
    "─────────────────────",
    "◎  Enter Channel ID:",
    "◌  Example: -1001234567890",
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

export async function handleChannelId(
  ctx: BotContext,
  channelId: string
): Promise<void> {
  setConvo(ctx.from!.id, {
    type: "add_channel_name",
    data: { channelId: channelId.trim() },
  });

  const text = panel("ADD CHANNEL", [
    "◈  Step 2 of 3",
    "─────────────────────",
    "◎  Enter Channel Name:",
    "◌  Example: Main Channel",
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

  const text = panel("ADD CHANNEL", [
    "◈  Step 3 of 3",
    "─────────────────────",
    "◎  Enter Channel Link:",
    "◌  Example: https://t.me/channelname",
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

  const text = panel("CHANNEL ADDED ✦", [
    `◈  Name: ${channelName}`,
    `◎  ID: ${channelId}`,
    "─────────────────────",
    "◉  Added to verification.",
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
    const text = panel("REMOVE CHANNEL", [
      "◈  No channels configured.",
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
    return;
  }

  const buttons = channels.map((ch) => [
    Markup.button.callback(
      `⎋  ${ch.channelName}`,
      `adm_rem_ch_${ch.id}`
    ),
  ]);
  buttons.push([Markup.button.callback("« BACK", "admin")]);

  const text = panel("REMOVE CHANNEL", [
    "◈  Select to remove:",
  ]);

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

  const text = panel("CHANNEL REMOVED ✦", [
    "◉  Channel deactivated.",
    "◌  Users no longer need to join it.",
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
