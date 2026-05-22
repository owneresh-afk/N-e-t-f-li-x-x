import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { BotContext } from "../types.js";
import { safeDelete } from "../utils/safe-delete.js";
import { sendAnimated, BOOT_FRAMES } from "../utils/animations.js";
import { sleep } from "../utils/sleep.js";
import { showVerificationPanel, needsVerification } from "./verify.js";
import { showMainMenu } from "./main-menu.js";
import { handleReferral, awardReferralPoints } from "./referral.js";
import { logger } from "../../lib/logger.js";

export async function handleStart(ctx: BotContext): Promise<void> {
  const uid = ctx.from?.id ?? 0;
  logger.info({ uid }, "[START] Command received");

  const user = ctx.dbUser;
  if (!user) {
    // dbUser missing — the middleware already logged the real error
    logger.error({ uid, middlewareError: ctx.middlewareError }, "[START] Aborting — no dbUser from middleware");
    return;
  }
  logger.info({ uid, balance: user.balance, isVerified: user.isVerified }, "[START] User loaded from context");

  // ── Referral parameter ────────────────────────────────────────────────────
  try {
    const payload = (ctx.message as { text?: string })?.text ?? "";
    const parts = payload.split(" ");
    if (parts.length > 1) {
      const refId = parseInt(parts[1]!, 10);
      if (!isNaN(refId) && refId !== uid) {
        logger.info({ uid, refId }, "[START] Referral parameter detected");
        await handleReferral(ctx, refId);
        logger.info({ uid, refId }, "[START] Referral handled");
      }
    }
  } catch (err) {
    logger.error({ err, uid }, "[START] Referral handling failed — continuing");
  }

  // ── Delete previous active message ────────────────────────────────────────
  try {
    if (user.activeMessageId) {
      logger.info({ uid, activeMessageId: user.activeMessageId }, "[START] Deleting previous active message");
      await safeDelete(ctx.telegram, ctx.chat!.id, user.activeMessageId);
    }
  } catch (err) {
    logger.warn({ err, uid }, "[START] safeDelete failed — continuing");
  }

  // ── Boot animation ────────────────────────────────────────────────────────
  let animId: number | undefined;
  try {
    logger.info({ uid }, "[START] Sending boot animation");
    animId = await sendAnimated(ctx, BOOT_FRAMES, 350);
    await sleep(300);
    await safeDelete(ctx.telegram, ctx.chat!.id, animId);
    logger.info({ uid }, "[START] Animation complete");
  } catch (err) {
    logger.warn({ err, uid }, "[START] Animation failed — continuing without it");
    if (animId) {
      await safeDelete(ctx.telegram, ctx.chat!.id, animId).catch(() => {});
    }
  }

  // ── Reload fresh user after referral update ───────────────────────────────
  try {
    logger.info({ uid }, "[START] Re-fetching fresh user from DB");
    const [freshUser] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, uid))
      .limit(1);
    if (freshUser) {
      ctx.dbUser = freshUser;
      logger.info({ uid, balance: freshUser.balance }, "[START] Fresh user loaded");
    } else {
      logger.warn({ uid }, "[START] Re-fetch returned no rows — using cached user");
    }
  } catch (err) {
    logger.error({ err, uid }, "[START] Re-fetch failed — using cached user");
  }

  // ── Verification check ────────────────────────────────────────────────────
  let needsVerif = false;
  try {
    logger.info({ uid }, "[START] Checking verification status");
    needsVerif = await needsVerification(ctx);
    logger.info({ uid, needsVerif }, "[START] Verification check result");
  } catch (err) {
    logger.error({ err, uid }, "[START] needsVerification threw — defaulting to needs verify");
    needsVerif = true;
  }

  // ── Route to appropriate panel ────────────────────────────────────────────
  if (needsVerif) {
    logger.info({ uid }, "[START] Showing verification panel");
    try {
      await showVerificationPanel(ctx);
      logger.info({ uid }, "[START] Verification panel shown");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      logger.error({ err, uid, message: msg, stack }, "[START] showVerificationPanel threw");
      await ctx.reply(
        [
          `⎋ ─〔 ERROR 〕──────────────────────`,
          `│`,
          `│  ◌  Failed to load verification.`,
          `│  ◌  ${msg}`,
          `│`,
          `──────────────────────────────────`,
        ].join("\n")
      ).catch(() => {});
    }
  } else {
    logger.info({ uid }, "[START] Showing main menu");
    try {
      await showMainMenu(ctx, true);
      logger.info({ uid }, "[START] Main menu shown — /start complete");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      logger.error({ err, uid, message: msg, stack }, "[START] showMainMenu threw");
      await ctx.reply(
        [
          `⎋ ─〔 ERROR 〕──────────────────────`,
          `│`,
          `│  ◌  Failed to load main menu.`,
          `│  ◌  ${msg}`,
          `│`,
          `──────────────────────────────────`,
        ].join("\n")
      ).catch(() => {});
    }
  }
}

export async function handleVerifiedStart(ctx: BotContext): Promise<void> {
  await awardReferralPoints(ctx);
}
