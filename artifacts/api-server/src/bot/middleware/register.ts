import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { BotContext } from "../types.js";
import { logger } from "../../lib/logger.js";

export async function registerMiddleware(
  ctx: BotContext,
  next: () => Promise<void>
): Promise<void> {
  const tgUser = ctx.from;

  // Updates with no sender (anonymous channel posts etc.) — pass straight through
  if (!tgUser) {
    return next();
  }

  const uid = tgUser.id;

  try {
    logger.info({ uid }, "[MIDDLEWARE] Looking up user");

    const existing = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, uid))
      .limit(1);

    if (existing.length > 0) {
      ctx.dbUser = existing[0]!;

      // Sync display name if it changed
      const u = existing[0]!;
      const newUsername = tgUser.username ?? null;
      const newFirst = tgUser.first_name || "User";
      if (u.username !== newUsername || u.firstName !== newFirst) {
        await db
          .update(usersTable)
          .set({ username: newUsername, firstName: newFirst })
          .where(eq(usersTable.id, uid));
        ctx.dbUser = { ...u, username: newUsername, firstName: newFirst };
        logger.info({ uid }, "[MIDDLEWARE] User display name synced");
      } else {
        logger.info({ uid }, "[MIDDLEWARE] User loaded");
      }
    } else {
      // First-time user — create record
      const [newUser] = await db
        .insert(usersTable)
        .values({
          id: uid,
          username: tgUser.username ?? null,
          firstName: tgUser.first_name || "User",
          balance: 0,
          totalReferrals: 0,
          totalRedeems: 0,
          isVerified: false,
          verificationVersion: 0,
        })
        .returning();
      ctx.dbUser = newUser!;
      logger.info({ uid }, "[MIDDLEWARE] New user created");
    }
  } catch (err) {
    // Log the full error but ALWAYS call next() — never freeze the chain.
    // Handlers check ctx.dbUser before acting, so missing dbUser is handled gracefully.
    logger.error({ err, uid }, "[MIDDLEWARE] DB error — continuing with dbUser=undefined");
  }

  // next() runs regardless of whether the DB query succeeded or failed
  return next();
}
