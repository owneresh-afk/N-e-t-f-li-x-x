export const OWNER_ID = 8731647972;
export const ADMIN_IDS: number[] = [8731647972];

export const TUTORIAL_CHANNEL_ID = -1003713830648;
export const TUTORIAL_MESSAGE_ID = 2;
export const DB_CHANNEL_ID = -1003946101072;

export const DAILY_POINTS = 10;
export const REFERRAL_POINTS = 10;
export const REDEEM_COST = 50;

export const BOT_START_TIME = Date.now();

export function isAdmin(userId: number): boolean {
  return ADMIN_IDS.includes(userId);
}
