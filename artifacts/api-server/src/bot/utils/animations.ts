import type { BotContext } from "../types.js";
import { sleep } from "./sleep.js";

export async function sendAnimated(
  ctx: BotContext,
  frames: string[],
  delayMs = 400
): Promise<number> {
  const msg = await ctx.reply(frames[0]!);
  for (let i = 1; i < frames.length; i++) {
    await sleep(delayMs);
    try {
      await ctx.telegram.editMessageText(
        msg.chat.id,
        msg.message_id,
        undefined,
        frames[i]!
      );
    } catch {
      // ignore
    }
  }
  return msg.message_id;
}

export async function editAnimated(
  ctx: BotContext,
  msgId: number,
  frames: string[],
  delayMs = 400
): Promise<void> {
  for (const frame of frames) {
    try {
      await ctx.telegram.editMessageText(
        ctx.chat!.id,
        msgId,
        undefined,
        frame
      );
    } catch {
      // ignore
    }
    await sleep(delayMs);
  }
}

// ─── Boot sequence ────────────────────────────────────────────────────────────
export const BOOT_FRAMES = [
  `◌ ─── BOOT ─────────────────`,
  `◎ ─── INIT ─────────────────`,
  `⌁ ─── LOADING ──────────────`,
  `◉ ─── SYSTEM ONLINE ────────`,
  `✦ ─── READY ────────────────`,
];

// ─── Scanner (verification) ───────────────────────────────────────────────────
export const SCAN_FRAMES = [
  `╭────────────────────╮\n│  ▏   SCANNING...    │\n╰────────────────────╯`,
  `╭────────────────────╮\n│  ▌   SCANNING...    │\n╰────────────────────╯`,
  `╭────────────────────╮\n│  ▊   SCANNING...    │\n╰────────────────────╯`,
  `╭────────────────────╮\n│  ◉   SCAN DONE      │\n╰────────────────────╯`,
];

// ─── Daily claim ──────────────────────────────────────────────────────────────
export const CLAIM_FRAMES = [
  `◌ ─── PROCESSING CLAIM ─────`,
  `◎ ─── VERIFYING ────────────`,
  `◉ ─── REWARD CONFIRMED ─────`,
  `✦ ─── POINTS CREDITED ──────`,
];

// ─── Code generator ───────────────────────────────────────────────────────────
export const GENERATE_FRAMES = [
  `◌ ─── GENERATING ───────────`,
  `◎ ─── ENCRYPTING CODES ─────`,
  `◉ ─── CODES READY ──────────`,
];

// ─── Account redeem ───────────────────────────────────────────────────────────
export const REDEEM_FRAMES = [
  `╭────────────────────╮\n│  ⌁   FETCHING...    │\n╰────────────────────╯`,
  `╭────────────────────╮\n│  ⌁   ALLOCATING...  │\n╰────────────────────╯`,
  `╭────────────────────╮\n│  ◉   FILE READY ✦   │\n╰────────────────────╯`,
];

// ─── Link generator ───────────────────────────────────────────────────────────
export const LINK_FRAMES = [
  `◌ ─── GENERATING LINK ──────`,
  `◎ ─── ENCRYPTING ───────────`,
  `◉ ─── LINK READY ───────────`,
];
