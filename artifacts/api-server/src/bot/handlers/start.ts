import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { BotContext } from "../types.js";
import { safeDelete } from "../utils/safe-delete.js";
import { sendAnimated, BOOT_FRAMES } from "../utils/animations.js";
import { sleep } from "../utils/sleep.js";
import { showVerificationPanel, needsVerification } from "./verify.js";
import { showMainMenu } from "./main-menu.js";
import { handleReferral, awardReferralPoints } from "./referral.js";

export async function handleStart(ctx: BotContext): Promise<void> {
  const user = ctx.dbUser;
  if (!user) return;

  // Handle referral parameter
  const payload = (ctx.message as { text?: string })?.text ?? "";
  const parts = payload.split(" ");
  if (parts.length > 1) {
    const refId = parseInt(parts[1]!, 10);
    if (!isNaN(refId)) {
      await handleReferral(ctx, refId);
    }
  }

  // Delete previous active message
  await safeDelete(ctx.telegram, ctx.chat!.id, user.activeMessageId);

  // Boot animation
  const animId = await sendAnimated(ctx, BOOT_FRAMES, 350);
  await sleep(300);
  await safeDelete(ctx.telegram, ctx.chat!.id, animId);

  // Reload user after referral update
  const [freshUser] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, ctx.from!.id))
    .limit(1);
  ctx.dbUser = freshUser;

  const needsVerif = await needsVerification(ctx);

  if (needsVerif) {
    await showVerificationPanel(ctx);
  } else {
    await showMainMenu(ctx, true);
  }
}

export async function handleVerifiedStart(ctx: BotContext): Promise<void> {
  // Called after verification — award referral points if applicable
  await awardReferralPoints(ctx);
}
