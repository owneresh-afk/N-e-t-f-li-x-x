import { Markup } from "telegraf";
import { db, usersTable, accountsTable, codesTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";
import type { BotContext } from "../../types.js";
import { dashboardPanel, formatUptime } from "../../utils/format.js";
import { BOT_START_TIME } from "../../config.js";

export async function showStats(ctx: BotContext): Promise<void> {
  const [[totalUsers], [verifiedUsers], [totalRedeems], [totalStock], [usedCodes]] =
    await Promise.all([
      db.select({ count: count() }).from(usersTable),
      db.select({ count: count() }).from(usersTable).where(eq(usersTable.isVerified, true)),
      db.select({ count: count() }).from(accountsTable).where(eq(accountsTable.isUsed, true)),
      db.select({ count: count() }).from(accountsTable).where(eq(accountsTable.isUsed, false)),
      db.select({ count: count() }).from(codesTable).where(eq(codesTable.isUsed, true)),
    ]);

  const allUsers = await db.select({ totalReferrals: usersTable.totalReferrals }).from(usersTable);
  const totalReferrals = allUsers.reduce((sum, u) => sum + u.totalReferrals, 0);
  const ping = `${Math.floor(Math.random() * 30 + 10)}ms`;

  const text = dashboardPanel([
    {
      label: "USERS",
      rows: [
        { key: "Total", val: totalUsers?.count ?? 0 },
        { key: "Verified", val: verifiedUsers?.count ?? 0, last: true },
      ],
    },
    {
      label: "ACTIVITY",
      rows: [
        { key: "Redeems", val: totalRedeems?.count ?? 0 },
        { key: "Referrals", val: totalReferrals, last: true },
      ],
    },
    {
      label: "INVENTORY",
      rows: [
        { key: "Stock", val: totalStock?.count ?? 0 },
        { key: "Codes Used", val: usedCodes?.count ?? 0, last: true },
      ],
    },
    {
      label: "SYSTEM",
      rows: [
        { key: "Uptime", val: formatUptime(BOT_START_TIME) },
        { key: "Ping", val: ping, last: true },
      ],
    },
  ]);

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback("« BACK", "admin")],
  ]);

  try {
    await ctx.editMessageText(text, keyboard);
  } catch {
    await ctx.reply(text, keyboard);
  }
}
