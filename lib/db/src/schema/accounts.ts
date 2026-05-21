import { pgTable, serial, text, boolean, bigint, integer, timestamp } from "drizzle-orm/pg-core";

export const accountsTable = pgTable("accounts", {
  id: serial("id").primaryKey(),
  messageId: integer("message_id").notNull(),
  messageLink: text("message_link").notNull(),
  fileName: text("file_name").notNull(),
  isUsed: boolean("is_used").notNull().default(false),
  usedBy: bigint("used_by", { mode: "number" }),
  usedAt: timestamp("used_at"),
  addedAt: timestamp("added_at").notNull().defaultNow(),
});

export type Account = typeof accountsTable.$inferSelect;
export type InsertAccount = typeof accountsTable.$inferInsert;
