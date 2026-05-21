import { pgTable, serial, text, boolean } from "drizzle-orm/pg-core";

export const channelsTable = pgTable("channels", {
  id: serial("id").primaryKey(),
  channelId: text("channel_id").notNull().unique(),
  channelName: text("channel_name").notNull(),
  channelLink: text("channel_link").notNull(),
  isActive: boolean("is_active").notNull().default(true),
});

export type Channel = typeof channelsTable.$inferSelect;
export type InsertChannel = typeof channelsTable.$inferInsert;
