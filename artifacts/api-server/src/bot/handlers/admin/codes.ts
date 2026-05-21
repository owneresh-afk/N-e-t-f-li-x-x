import { Markup } from "telegraf";
import { db, codesTable } from "@workspace/db";
import type { BotContext } from "../../types.js";
import { panel } from "../../utils/format.js";
import { setConvo, clearConvo } from "../../convo-state.js";
import { sendAnimated, GENERATE_FRAMES } from "../../utils/animations.js";
import { safeDelete } from "../../utils/safe-delete.js";
import { sleep } from "../../utils/sleep.js";

export async function startGenerateCodes(ctx: BotContext): Promise<void> {
  await ctx.answerCbQuery();
  setConvo(ctx.from!.id, { type: "gen_codes_count", data: {} });

  const text = panel("GENERATE CODES", [
    "◈  Step 1 of 2",
    "─────────────────────",
    "◎  How many codes?",
    "◌  Enter a number (1-100):",
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

export async function handleCodesCount(
  ctx: BotContext,
  countStr: string
): Promise<void> {
  const n = parseInt(countStr.trim(), 10);
  if (isNaN(n) || n < 1 || n > 100) {
    await ctx.reply("⎋  Invalid number. Enter 1-100:");
    return;
  }

  setConvo(ctx.from!.id, { type: "gen_codes_points", data: { count: n } });

  const text = panel("GENERATE CODES", [
    "◈  Step 2 of 2",
    "─────────────────────",
    `◎  Generating: ${n} codes`,
    "◌  Points per code?",
    "◈  Enter value:",
  ]);

  await ctx.reply(
    text,
    Markup.inlineKeyboard([[Markup.button.callback("⎋  CANCEL", "admin")]])
  );
}

export async function handleCodesPoints(
  ctx: BotContext,
  pointsStr: string,
  count: number
): Promise<void> {
  const points = parseInt(pointsStr.trim(), 10);
  if (isNaN(points) || points < 1) {
    await ctx.reply("⎋  Invalid value. Enter a positive number:");
    return;
  }

  clearConvo(ctx.from!.id);

  const animId = await sendAnimated(ctx, GENERATE_FRAMES, 450);
  await sleep(300);
  await safeDelete(ctx.telegram, ctx.chat!.id, animId);

  // Generate unique codes
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    codes.push(generateCode());
  }

  // Insert into DB
  await db.insert(codesTable).values(
    codes.map((code) => ({ code, points }))
  );

  const codeList = codes.map((c) => `◈  ${c}`).join("\n");
  const text =
    panel("CODES GENERATED ✦", [
      `◎  Count: ${count}`,
      `◌  Points: ${points} each`,
      "─────────────────────",
    ]) +
    "\n\n" +
    codeList;

  await ctx.reply(
    text,
    Markup.inlineKeyboard([[Markup.button.callback("« BACK", "admin")]])
  );
}

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 12; i++) {
    if (i === 4 || i === 8) code += "-";
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// User code redemption
export async function handleCodeRedeem(
  ctx: BotContext,
  code: string
): Promise<void> {
  const { usersTable } = await import("@workspace/db");
  const { eq } = await import("drizzle-orm");

  const [found] = await db
    .select()
    .from(codesTable)
    .where(eq(codesTable.code, code.toUpperCase()))
    .limit(1);

  if (!found) {
    await ctx.reply(
      panel("INVALID CODE", [
        "◈  Code not found.",
        "◌  Check and try again.",
      ])
    );
    return;
  }

  if (found.isUsed) {
    await ctx.reply(
      panel("CODE USED", [
        "◈  Already redeemed.",
        "◌  Each code is one-time only.",
      ])
    );
    return;
  }

  const user = ctx.dbUser!;
  const newBalance = user.balance + found.points;

  await db
    .update(codesTable)
    .set({ isUsed: true, usedBy: user.id, usedAt: new Date() })
    .where(eq(codesTable.id, found.id));

  await db
    .update(usersTable)
    .set({ balance: newBalance })
    .where(eq(usersTable.id, user.id));

  await ctx.reply(
    panel("CODE REDEEMED ✦", [
      `◉  +${found.points} pts added`,
      `◈  New balance: ${newBalance} pts`,
    ])
  );
}
