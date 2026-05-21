import type { Telegram } from "telegraf";

export async function safeDelete(
  telegram: Telegram,
  chatId: number,
  messageId: number | null | undefined
): Promise<void> {
  if (!messageId) return;
  try {
    await telegram.deleteMessage(chatId, messageId);
  } catch {
    // Message already deleted or not found — ignore
  }
}
