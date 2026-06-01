import TelegramBot from "node-telegram-bot-api";
import {
  uploadTelegramPhoto, getCurrentDay, defaultTagForDay,
  checkServicesReady, HERO_TAGS,
} from "./botUtils.js";

// Emoji per hero tag — used as reaction on successful upload
const TAG_REACTION = {
  hero:           "⚡",
  quest:          "🗺",
  mentor:         "🧙",
  challenge:      "⚔",
  abyss:          "🌑",
  villain:        "🐍",
  transformation: "🦋",
  reward:         "🏆",
};

// Tag emoji keyboard labels (matches publicBot)
const TAG_EMOJI = {
  hero:           "⚡ The Hero",
  quest:          "🗺️ The Quest",
  mentor:         "🧙 The Mentor",
  challenge:      "⚔️ The Challenge",
  abyss:          "🌑 The Abyss",
  villain:        "🐍 The Villain",
  transformation: "🦋 Transformation",
  reward:         "🏆 The Reward",
};

function tagKeyboard() {
  const rows = [];
  const tags = HERO_TAGS.map(t => ({ text: TAG_EMOJI[t.id] || t.label }));
  for (let i = 0; i < tags.length; i += 2) rows.push(tags.slice(i, i + 2));
  return { keyboard: rows, resize_keyboard: true, one_time_keyboard: true };
}

// Per-user pending photo { photo, messageId }
const pending = {};

export function createGroupBot(token) {
  const bot = new TelegramBot(token, { polling: true });

  bot.on("message", async msg => {
    const isGroup = msg.chat.type === "group" || msg.chat.type === "supergroup";
    if (!isGroup) return;

    const chatId    = msg.chat.id;
    const userId    = msg.from?.id;
    const text      = msg.text || "";
    const day       = getCurrentDay();

    // ── Tag selection reply ───────────────────────────────────────────────
    if (pending[userId]) {
      const tag = HERO_TAGS.find(
        t => text === TAG_EMOJI[t.id] || text === t.label);

      if (tag) {
        const { photo, messageId } = pending[userId];
        delete pending[userId];

        try {
          await uploadTelegramPhoto({
            bot, photo,
            uploaderName: msg.from?.first_name || msg.from?.username || "Group member",
            heroTagId:    tag.id,
          });

          // React with the tag's emoji on the original photo message
          const reaction = TAG_REACTION[tag.id] || "✅";
          try {
            await bot.setMessageReaction(chatId, messageId, {
              reaction: [{ type: "emoji", emoji: reaction }],
            });
          } catch { /* Bot API 7.0+ only */ }

          // Also react on the tag selection message
          try {
            await bot.setMessageReaction(chatId, msg.message_id, {
              reaction: [{ type: "emoji", emoji: reaction }],
            });
          } catch { /* silent */ }

        } catch (e) {
          console.error("[GroupBot] Upload error:", e.message);
          try {
            await bot.setMessageReaction(chatId, messageId, {
              reaction: [{ type: "emoji", emoji: "❌" }],
            });
          } catch { /* silent */ }
        }
        return;
      }

      // Unrecognised — re-prompt
      await bot.sendMessage(chatId,
        `@${msg.from?.username || "hey"} — pick a role from the buttons 👇`,
        { reply_markup: tagKeyboard() });
      return;
    }

    // ── Photo received ────────────────────────────────────────────────────
    if (!msg.photo) return;

    // Service check
    const status = await checkServicesReady();
    if (!status.ready) {
      await bot.sendMessage(chatId,
        `sorry babes i can't take pictures right now 😔`,
        { reply_to_message_id: msg.message_id });
      return;
    }

    // Store pending photo and ask for tag
    pending[userId] = {
      photo:     msg.photo[msg.photo.length - 1],
      messageId: msg.message_id,
    };

    await bot.sendMessage(chatId,
      `@${msg.from?.username || msg.from?.first_name} which role does this memory play? 👇`,
      { reply_to_message_id: msg.message_id, reply_markup: tagKeyboard() });
  });

  // bot.on("polling_error", err =>
  //   console.error("[GroupBot] Polling error:", err.message));

  console.log("[GroupBot] Ready — listening for group photos.");
  return bot;
}