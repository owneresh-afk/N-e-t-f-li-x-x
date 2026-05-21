import { pgTable, bigint, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
  id: bigint("id", { mode: "number" }).primaryKey(),
  username: text("username"),
  firstName: text("first_name").notNull().default("User"),
  balance: integer("balance").notNull().default(0),
  totalReferrals: integer("total_referrals").notNull().default(0),
  totalRedeems: integer("total_redeems").notNull().default(0),
  joinDate: timestamp("join_date").notNull().defaultNow(),
  isVerified: boolean("is_verified").notNull().default(false),
  verificationVersion: integer("verification_version").notNull().default(0),
  referredBy: bigint("referred_by", { mode: "number" }),
  lastDailyClaim: timestamp("last_daily_claim"),
  activeMessageId: integer("active_message_id"),
});

export type User = typeof usersTable.$inferSelect;
export type InsertUser = typeof usersTable.$inferInsert;
