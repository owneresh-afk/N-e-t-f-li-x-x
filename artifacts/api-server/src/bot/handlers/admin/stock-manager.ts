import { Markup } from "telegraf";
import { db, accountsTable } from "@workspace/db";
import { eq, count, and, gte, lte } from "drizzle-orm";
import type { BotContext } from "../../types.js";
import { panel } from "../../utils/format.js";
import { DB_CHANNEL_ID } from "../../config.js";
import { sleep } from "../../utils/sleep.js";

export async function showStockManager(ctx: BotContext): Promise<void> {
  const [[available], [used], [total]] = await Promise.all([
    db.select({ count: count() }).from(accountsTable).where(eq(accountsTable.isUsed, false)),
    db.select({ count: count() }).from(accountsTable).where(eq(accountsTable.isUsed, true)),
    db.select({ count: count() }).from(accountsTable),
  ]);

  const text = panel("STOCK MANAGER", [
    `◈  Available ─ ${available?.count ?? 0}`,
    `◆  Used ─────  ${used?.count ?? 0}`,
    `◎  Total ───── ${total?.count ?? 0}`,
    "─────────────────────",
    "◌  Send .txt files to DB",
    "◌  channel to add stock.",
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

export async function handleDbChannelDocument(
  ctx: BotContext
): Promise<void> {
  const msg = ctx.channelPost ?? ctx.message;
  if (!msg || !("document" in msg) || !msg.document) return;

  const doc = msg.document;
  const fileName = doc.file_name ?? "unknown.txt";

  // Only process .txt files
  if (!fileName.toLowerCase().endsWith(".txt")) return;

  const messageId = msg.message_id;
  const chatId = msg.chat.id;
  const messageLink = `https://t.me/c/${String(chatId).replace("-100", "")}/${messageId}`;

  // Check for duplicates
  const [existing] = await db
    .select()
    .from(accountsTable)
    .where(eq(accountsTable.messageId, messageId))
    .limit(1);

  if (existing) return;

  await db.insert(accountsTable).values({
    messageId,
    messageLink,
    fileName,
    isUsed: false,
  });
}

export async function handleBulkDbDocuments(
  ctx: BotContext,
  documents: Array<{ messageId: number; chatId: number; fileName: string }>
): Promise<void> {
  let added = 0;
  let failed = 0;

  const [stockBefore] = await db
    .select({ count: count() })
    .from(accountsTable)
    .where(eq(accountsTable.isUsed, false));

  for (let i = 0; i < documents.length; i++) {
    const doc = documents[i]!;
    try {
      const messageLink = `https://t.me/c/${String(doc.chatId).replace("-100", "")}/${doc.messageId}`;

      const [existing] = await db
        .select()
        .from(accountsTable)
        .where(eq(accountsTable.messageId, doc.messageId))
        .limit(1);

      if (!existing) {
        await db.insert(accountsTable).values({
          messageId: doc.messageId,
          messageLink,
          fileName: doc.fileName,
          isUsed: false,
        });
        added++;
      }
    } catch {
      failed++;
    }
  }

  const [stockAfter] = await db
    .select({ count: count() })
    .from(accountsTable)
    .where(eq(accountsTable.isUsed, false));

  const text = panel("BULK IMPORT COMPLETE ✦", [
    `◈  Added ─── ${added}`,
    `◎  Failed ── ${failed}`,
    `◌  Stock ─── ${stockAfter?.count ?? 0}`,
  ]);

  try {
    await ctx.telegram.sendMessage(DB_CHANNEL_ID, text);
  } catch {
    // ignore if we can't send to channel
  }
}

export async function handleDeleteRange(
  ctx: BotContext,
  startMsgId: number,
  endMsgId: number
): Promise<void> {
  const [start, end] = startMsgId < endMsgId
    ? [startMsgId, endMsgId]
    : [endMsgId, startMsgId];

  // Get all accounts in range
  const toDelete = await db
    .select()
    .from(accountsTable)
    .where(
      and(
        gte(accountsTable.messageId, start),
        lte(accountsTable.messageId, end)
      )
    );

  if (toDelete.length === 0) {
    await ctx.reply(
      panel("DELETE RANGE", [
        "◈  No accounts found in range.",
      ])
    );
    return;
  }

  // Delete the messages from Telegram
  let telegramDeleted = 0;
  for (const account of toDelete) {
    try {
      await ctx.telegram.deleteMessage(DB_CHANNEL_ID, account.messageId);
      telegramDeleted++;
      await sleep(50);
    } catch {
      // Message might already be deleted
    }
  }

  // Remove from DB
  await db
    .update(accountsTable)
    .set({ isUsed: true })
    .where(
      and(
        gte(accountsTable.messageId, start),
        lte(accountsTable.messageId, end)
      )
    );

  // Actually delete from DB
  const { sql } = await import("drizzle-orm");
  await db.execute(
    sql`DELETE FROM accounts WHERE message_id >= ${start} AND message_id <= ${end}`
  );

  const [stockRow] = await db
    .select({ count: count() })
    .from(accountsTable)
    .where(eq(accountsTable.isUsed, false));

  const text = panel("DELETE COMPLETE ✦", [
    `◈  Removed ─── ${toDelete.length}`,
    `◎  TG Deleted ─ ${telegramDeleted}`,
    `◌  Stock ─────  ${stockRow?.count ?? 0}`,
  ]);

  await ctx.reply(text);
}
