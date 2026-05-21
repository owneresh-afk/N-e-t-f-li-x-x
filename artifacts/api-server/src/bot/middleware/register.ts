import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { BotContext } from "../types.js";

export async function registerMiddleware(
  ctx: BotContext,
  next: () => Promise<void>
): Promise<void> {
  const tgUser = ctx.from;
  if (!tgUser) return next();

  const existing = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, tgUser.id))
    .limit(1);

  if (existing.length > 0) {
    ctx.dbUser = existing[0]!;
    // Update username/firstName if changed
    const u = existing[0]!;
    const newUsername = tgUser.username ?? null;
    const newFirst = tgUser.first_name || "User";
    if (u.username !== newUsername || u.firstName !== newFirst) {
      await db
        .update(usersTable)
        .set({ username: newUsername, firstName: newFirst })
        .where(eq(usersTable.id, tgUser.id));
      ctx.dbUser = { ...u, username: newUsername, firstName: newFirst };
    }
  } else {
    const [newUser] = await db
      .insert(usersTable)
      .values({
        id: tgUser.id,
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
  }

  return next();
}
