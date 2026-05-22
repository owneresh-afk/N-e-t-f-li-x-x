import { Markup } from "telegraf";
import { db, usersTable, settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { BotContext } from "../../types.js";
import { successPanel } from "../../utils/format.js";

export async function showReverifyConfirm(ctx: BotContext): Promise<void> {
  await ctx.answerCbQuery();

  const text = [
    `⎋ ─〔 CRITICAL OPERATION 〕─────────`,
    `│`,
    `│  ◈  Resets ALL users`,
    `│  ◌  Admins included`,
    `│  ◆  Cannot be undone`,
    `│`,
    `──────────────────────────────────`,
  ].join("\n");

  try {
    await ctx.editMessageText(
      text,
      Markup.inlineKeyboard([
        [Markup.button.callback("⟦ CONFIRM RESET ⟧", "adm_reverify_confirm")],
        [Markup.button.callback("⎋  CANCEL", "admin")],
      ])
    );
  } catch {
    await ctx.reply(
      text,
      Markup.inlineKeyboard([
        [Markup.button.callback("⟦ CONFIRM RESET ⟧", "adm_reverify_confirm")],
        [Markup.button.callback("⎋  CANCEL", "admin")],
      ])
    );
  }
}

export async function handleReverifyConfirm(ctx: BotContext): Promise<void> {
  await ctx.answerCbQuery();

  const rows = await db
    .select()
    .from(settingsTable)
    .where(eq(settingsTable.key, "verification_version"))
    .limit(1);

  const currentVersion = rows.length > 0 ? parseInt(rows[0]!.value, 10) || 0 : 0;
  const newVersion = currentVersion + 1;

  if (rows.length > 0) {
    await db
      .update(settingsTable)
      .set({ value: String(newVersion) })
      .where(eq(settingsTable.key, "verification_version"));
  } else {
    await db.insert(settingsTable).values({
      key: "verification_version",
      value: String(newVersion),
    });
  }

  await db.update(usersTable).set({ isVerified: false, verificationVersion: 0 });

  const text = successPanel("VERIFICATION RESET", [
    `◉  All users must re-verify.`,
    `◈  Version ···  ${newVersion}`,
    `◌  Active on next /start`,
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
