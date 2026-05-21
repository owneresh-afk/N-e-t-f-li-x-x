import { isAdmin } from "../config.js";
import type { BotContext } from "../types.js";

export async function adminOnly(
  ctx: BotContext,
  next: () => Promise<void>
): Promise<void> {
  if (!ctx.from || !isAdmin(ctx.from.id)) {
    await ctx.reply("⎋  Access denied.");
    return;
  }
  return next();
}
