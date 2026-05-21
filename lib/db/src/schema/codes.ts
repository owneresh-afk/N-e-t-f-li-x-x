import { pgTable, serial, text, integer, boolean, bigint, timestamp } from "drizzle-orm/pg-core";

export const codesTable = pgTable("codes", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  points: integer("points").notNull(),
  isUsed: boolean("is_used").notNull().default(false),
  usedBy: bigint("used_by", { mode: "number" }),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Code = typeof codesTable.$inferSelect;
export type InsertCode = typeof codesTable.$inferInsert;
