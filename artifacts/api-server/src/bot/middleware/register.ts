import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { BotContext } from "../types.js";
import { logger } from "../../lib/logger.js";

export async function registerMiddleware(
  ctx: BotContext,
  next: () => Promise<void>
): Promise<void> {
  const tgUser = ctx.from;

  if (!tgUser) {
    // Updates with no sender (channel posts etc.) — pass through
    return next();
  }

  const uid = tgUser.id;

  try {
    logger.info({ uid }, "[MIDDLEWARE] Registering user");

    const existing = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, uid))
      .limit(1);

    if (existing.length > 0) {
      ctx.dbUser = existing[0]!;

      // Sync display name if changed
      const u = existing[0]!;
      const newUsername = tgUser.username ?? null;
      const newFirst = tgUser.first_name || "User";
      if (u.username !== newUsername || u.firstName !== newFirst) {
        await db
          .update(usersTable)
          .set({ username: newUsername, firstName: newFirst })
          .where(eq(usersTable.id, uid));
        ctx.dbUser = { ...u, username: newUsername, firstName: newFirst };
      }

      logger.info({ uid }, "[MIDDLEWARE] User found in DB");
    } else {
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
      logger.info({ uid }, "[MIDDLEWARE] New user registered");
    }
  } catch (err) {
    logger.error({ err, uid }, "[MIDDLEWARE] DB error — continuing without dbUser");
    // Do NOT block next() — let the handler decide what to do with a missing dbUser
    // This prevents the entire bot from freezing when the DB is temporarily unavailable
    try {
      await ctx.reply(
        "⎋ ─〔 SERVICE UNAVAILABLE 〕─────\n│\n│  ◌  Database unreachable.\n│  ◌  Please try again shortly.\n│\n──────────────────────────────"
      );
    } catch {
      // ignore — user may have blocked the bot
    }
    return; // Do not call next() so handlers don't run with undefined dbUser
  }

  return next();
}
