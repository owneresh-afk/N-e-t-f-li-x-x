import { Context } from "telegraf";
import type { User } from "@workspace/db";

export interface BotContext extends Context {
  dbUser?: User;
}

export type ConvoType =
  | "broadcast"
  | "gen_codes_count"
  | "gen_codes_points"
  | "add_channel_id"
  | "add_channel_name"
  | "add_channel_link"
  | "stock_manager";

export interface ConvoState {
  type: ConvoType;
  data: Record<string, unknown>;
}
