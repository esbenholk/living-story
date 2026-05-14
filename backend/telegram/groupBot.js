/**
 * groupBot.js
 * -----------
 * Group bot — add to any Telegram group chat.
 * Silently uploads every photo shared in the group.
 * Reacts with ✅ on success, ❌ on failure.
 * No conversation tree, no replies that would clutter the chat.
 */

import TelegramBot from "node-telegram-bot-api";
import {
  uploadTelegramPhoto, getCurrentDay, defaultTagForDay,
} from "./botUtils.js";

export function createGroupBot(token) {
  const bot = new TelegramBot(token, { polling: true });

  bot.on("message", async msg => {
    // Only handle photos in group/supergroup chats
    if (!msg.photo) return;
    if (msg.chat.type !== "group" && msg.chat.type !== "supergroup") return;

    const largest = msg.photo[msg.photo.length - 1];
    const day     = getCurrentDay();
    const tagId   = defaultTagForDay(day)?.id || "hero";

    try {
      await uploadTelegramPhoto({
        bot, photo: largest,
        uploaderName: msg.from?.first_name || msg.from?.username || "Group member",
        heroTagId:    tagId,
        caption:      msg.caption || "",
      });

      // React with ✅ — uses sendReaction if available, otherwise a quick reply
      try {
        await bot.setMessageReaction(msg.chat.id, msg.message_id, {
          reaction: [{ type: "emoji", emoji: "✅" }],
        });
      } catch {
        // setMessageReaction requires Bot API 7.0+ — silent fallback
      }

    } catch (e) {
      console.error("[GroupBot] Upload error:", e.message);
      try {
        await bot.setMessageReaction(msg.chat.id, msg.message_id, {
          reaction: [{ type: "emoji", emoji: "❌" }],
        });
      } catch { /* silent */ }
    }
  });

  console.log("[GroupBot] Ready — listening for group photos.");
  return bot;
}
