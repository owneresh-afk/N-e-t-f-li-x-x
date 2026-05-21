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

export const BOOT_FRAMES = [
  `◌  INITIALIZING...`,
  `◎  BOOT SEQUENCE...`,
  `◉  SYSTEM ONLINE`,
  `⟳  LOADING MODULES`,
  `✦  READY`,
];

export const LOADING_FRAMES = [
  `⌁  PROCESSING...\n\n▁▂▃`,
  `⌁  PROCESSING...\n\n▁▂▃▄▅`,
  `⌁  PROCESSING...\n\n▁▂▃▄▅▆▇`,
  `◉  DONE`,
];

export const SCAN_FRAMES = [
  `╭────────────────╮\n│  ▌  SCANNING.. │\n╰────────────────╯`,
  `╭────────────────╮\n│     ▌ SCAN..   │\n╰────────────────╯`,
  `╭────────────────╮\n│        ▌ SCAN  │\n╰────────────────╯`,
  `╭────────────────╮\n│  ◉  VERIFIED   │\n╰────────────────╯`,
];

export const CLAIM_FRAMES = [
  `◌  PROCESSING CLAIM...`,
  `◎  VERIFYING...`,
  `◉  CONFIRMED`,
  `✦  POINTS ADDED`,
];

export const GENERATE_FRAMES = [
  `◌  GENERATING...`,
  `◎  ENCRYPTING CODES...`,
  `◉  CODES READY`,
];

export const REDEEM_FRAMES = [
  `╭────────────────╮\n│  ▌  FETCHING.. │\n╰────────────────╯`,
  `╭────────────────╮\n│    ▌  FETCH..  │\n╰────────────────╯`,
  `╭────────────────╮\n│      ▌  OK     │\n╰────────────────╯`,
  `╭────────────────╮\n│  ◉  ALLOCATED  │\n╰────────────────╯`,
];

export const LINK_FRAMES = [
  `◌  GENERATING LINK...`,
  `◎  ENCRYPTING...`,
  `◉  LINK READY`,
];

export const SUCCESS_FRAMES = [
  `◎  SUCCESS`,
  `◉  CONFIRMED ✦`,
];
