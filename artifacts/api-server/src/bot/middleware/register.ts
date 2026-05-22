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
    logger.info("[MIDDLEWARE] No ctx.from — passing through");
    return next();
  }

  const uid = tgUser.id;
  logger.info({ uid, firstName: tgUser.first_name }, "[MIDDLEWARE] Processing user");

  try {
    logger.info({ uid }, "[MIDDLEWARE] SELECT user from DB...");

    const existing = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, uid))
      .limit(1);

    logger.info({ uid, found: existing.length > 0 }, "[MIDDLEWARE] SELECT complete");

    if (existing.length > 0) {
      ctx.dbUser = existing[0]!;

      const u = existing[0]!;
      const newUsername = tgUser.username ?? null;
      const newFirst = tgUser.first_name || "User";
      if (u.username !== newUsername || u.firstName !== newFirst) {
        logger.info({ uid }, "[MIDDLEWARE] Syncing display name...");
        await db
          .update(usersTable)
          .set({ username: newUsername, firstName: newFirst })
          .where(eq(usersTable.id, uid));
        ctx.dbUser = { ...u, username: newUsername, firstName: newFirst };
        logger.info({ uid }, "[MIDDLEWARE] Display name synced");
      } else {
        logger.info({ uid }, "[MIDDLEWARE] User loaded — no name change");
      }
    } else {
      logger.info({ uid }, "[MIDDLEWARE] New user — inserting...");
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
      logger.info({ uid }, "[MIDDLEWARE] New user inserted successfully");
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    // Store real error on context so downstream handlers can report it accurately
    ctx.middlewareError = msg;
    logger.error(
      { err, uid, message: msg, stack },
      "[MIDDLEWARE] DB query FAILED — ctx.dbUser will be undefined"
    );
    // ALWAYS call next() — never freeze the chain
  }

  logger.info({ uid, hasUser: !!ctx.dbUser, hasError: !!ctx.middlewareError }, "[MIDDLEWARE] Done — calling next()");
  return next();
}
