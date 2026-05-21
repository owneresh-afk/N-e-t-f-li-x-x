import { Markup } from "telegraf";
import { db, accountsTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";
import type { BotContext } from "../types.js";
import { panel } from "../utils/format.js";

export async function showStock(ctx: BotContext): Promise<void> {
  const [availRow] = await db
    .select({ count: count() })
    .from(accountsTable)
    .where(eq(accountsTable.isUsed, false));

  const [totalRow] = await db.select({ count: count() }).from(accountsTable);

  const available = Number(availRow?.count ?? 0);
  const total = Number(totalRow?.count ?? 0);
  const used = total - available;

  const bar = buildBar(available, total);

  const text = panel("AVAILABLE STOCK", [
    `◈  Available ─ ${available}`,
    `◆  Total ───── ${total}`,
    `◎  Used ─────  ${used}`,
    "─────────────────────",
    `  ${bar}`,
  ]);

  try {
    await ctx.editMessageText(
      text,
      Markup.inlineKeyboard([[Markup.button.callback("« BACK", "menu")]])
    );
  } catch {
    await ctx.reply(
      text,
      Markup.inlineKeyboard([[Markup.button.callback("« BACK", "menu")]])
    );
  }
}

function buildBar(available: number, total: number): string {
  if (total === 0) return "▁▁▁▁▁▁▁▁ 0%";
  const pct = Math.round((available / total) * 8);
  const filled = "█".repeat(pct);
  const empty = "▁".repeat(8 - pct);
  const percent = Math.round((available / total) * 100);
  return `${filled}${empty} ${percent}%`;
}
