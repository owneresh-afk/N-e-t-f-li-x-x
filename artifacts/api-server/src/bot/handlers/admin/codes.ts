import { Markup } from "telegraf";
import { db, codesTable } from "@workspace/db";
import type { BotContext } from "../../types.js";
import { panel } from "../../utils/format.js";
import { setConvo, clearConvo } from "../../convo-state.js";
import { editAnimated, GENERATE_FRAMES } from "../../utils/animations.js";
import { safeDelete } from "../../utils/safe-delete.js";

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
    const errMsg = await ctx.reply("⎋  Invalid. Enter a number between 1-100:");
    setTimeout(() => safeDelete(ctx.telegram, ctx.chat!.id, errMsg.message_id), 4000);
    return;
  }

  // Delete user's input message
  await safeDelete(ctx.telegram, ctx.chat!.id, ctx.message?.message_id);

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
    const errMsg = await ctx.reply("⎋  Invalid. Enter a positive number:");
    setTimeout(() => safeDelete(ctx.telegram, ctx.chat!.id, errMsg.message_id), 4000);
    return;
  }

  clearConvo(ctx.from!.id);

  // Delete user's input message
  await safeDelete(ctx.telegram, ctx.chat!.id, ctx.message?.message_id);

  // Animate in-place on the step-2 message (last bot message before this)
  // We send a fresh animation message since we don't have the step-2 message ID
  const animMsg = await ctx.reply(GENERATE_FRAMES[0]!);
  await editAnimated(ctx, animMsg.message_id, GENERATE_FRAMES.slice(1), 420);
  await safeDelete(ctx.telegram, ctx.chat!.id, animMsg.message_id);

  // Generate unique codes
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    codes.push(generateCode());
  }

  await db.insert(codesTable).values(codes.map((code) => ({ code, points })));

  // Header panel
  const header = panel("CODES GENERATED ✦", [
    `◎  Count: ${count}`,
    `◌  Points: ${points} each`,
    "─────────────────────",
    "◈  Tap a code to copy:",
  ]);

  // Codes in monospace — each on its own line, tappable to copy
  const codeLines = codes.map((c) => `<code>${c}</code>`).join("\n");
  const fullText = `${header}\n\n${codeLines}`;

  // Telegram messages have a 4096 char limit — split if needed
  const chunks = splitMessage(fullText, 4096);
  for (const chunk of chunks) {
    await ctx.reply(chunk, {
      parse_mode: "HTML",
      ...Markup.inlineKeyboard([[Markup.button.callback("« BACK", "admin")]]),
    });
  }
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

function splitMessage(text: string, limit: number): string[] {
  if (text.length <= limit) return [text];
  const chunks: string[] = [];
  const lines = text.split("\n");
  let current = "";
  for (const line of lines) {
    if ((current + "\n" + line).length > limit) {
      if (current) chunks.push(current);
      current = line;
    } else {
      current = current ? current + "\n" + line : line;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

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

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback("« BACK TO MENU", "menu")],
  ]);

  if (!found) {
    const msg = await ctx.reply(
      panel("INVALID CODE", [
        "◈  Code not found.",
        "◌  Check and try again.",
      ]),
      keyboard
    );
    setTimeout(() => safeDelete(ctx.telegram, ctx.chat!.id, msg.message_id), 8000);
    return;
  }

  if (found.isUsed) {
    const msg = await ctx.reply(
      panel("CODE USED", [
        "◈  Already redeemed.",
        "◌  Each code is one-time only.",
      ]),
      keyboard
    );
    setTimeout(() => safeDelete(ctx.telegram, ctx.chat!.id, msg.message_id), 8000);
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

  // Also delete the /code command message
  await safeDelete(ctx.telegram, ctx.chat!.id, ctx.message?.message_id);

  const msg = await ctx.reply(
    panel("CODE REDEEMED ✦", [
      `◉  +${found.points} pts added`,
      `◈  New balance: ${newBalance} pts`,
    ]),
    keyboard
  );
  // Auto-delete after 8 seconds
  setTimeout(() => safeDelete(ctx.telegram, ctx.chat!.id, msg.message_id), 8000);
}
