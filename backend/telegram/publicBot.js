/**
 * publicBot.js
 * ------------
 * Public bot — redesigned flow:
 *   1. Start → choose Read Chapter or Upload Memory
 *   2. Upload Memory → prompt to send photo
 *   3. Photo received → ask for tag (emoji keyboard)
 *   4. Tag selected → upload → confirm
 *
 * Photo can also be sent at any time — bot will ask for tag after.
 */

import TelegramBot from "node-telegram-bot-api";
import {
  uploadTelegramPhoto,
  getTodaysChapters,
  formatChapterMessage,
  tagByLabel,
  getCurrentDay,
  getChapterConfig,
  HERO_TAGS,
  checkServicesReady,
} from "./botUtils.js";

// ── Tag emoji map ─────────────────────────────────────────────────────────
const TAG_EMOJI = {
  hero: "⚡ The Hero",
  quest: "🗺️ The Quest",
  mentor: "🧙 The Mentor",
  challenge: "⚔️ The Challenge",
  abyss: "🌑 The Abyss",
  villain: "🐍 The Villain",
  transformation: "🦋 Transformation",
  reward: "🏆 The Reward",
};

// ── Keyboards ─────────────────────────────────────────────────────────────

function mainKeyboard() {
  return {
    keyboard: [[{ text: "📖 Read chapter" }], [{ text: "📸 Upload memory" }]],
    resize_keyboard: true,
    one_time_keyboard: false,
  };
}

function tagKeyboard() {
  const rows = [];
  const tags = HERO_TAGS.map((t) => ({ text: TAG_EMOJI[t.id] || t.label }));
  for (let i = 0; i < tags.length; i += 2) rows.push(tags.slice(i, i + 2));
  return {
    keyboard: rows,
    resize_keyboard: true,
    one_time_keyboard: true,
  };
}

// ── Sessions ──────────────────────────────────────────────────────────────

// step: "idle" | "awaiting_photo" | "awaiting_tag"
const sessions = {};
function session(chatId) {
  if (!sessions[chatId])
    sessions[chatId] = { step: "idle", pendingPhoto: null };
  return sessions[chatId];
}

// ── Bot factory ───────────────────────────────────────────────────────────

export function createPublicBot(token) {
  const bot = new TelegramBot(token, { polling: true });

  bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text || "";
    const s = session(chatId);
    const day = getCurrentDay();

    // ── Service check — runs before anything else ─────────────────────────
    const status = await checkServicesReady();
    if (!status.ready) {
      const issues = [
        !status.sidecar && "image processing",
        !status.ollama && "story generation",
      ]
        .filter(Boolean)
        .join(" and ");
      await bot.sendMessage(
        chatId,
        `⚠️ Sorry babe, the Slop Plot Bot is currently brokenhearted.  

` +
          `_${issues} ${issues.includes("and") ? "are" : "is"} not responding._

` +
          `Plz try again later thoo. thnx uuuuu`,
        { parse_mode: "Markdown", reply_markup: mainKeyboard() },
      );
      return;
    }

    // ── Photo received ────────────────────────────────────────────────────
    if (msg.photo) {
      s.pendingPhoto = msg.photo[msg.photo.length - 1];
      s.step = "awaiting_tag";

      await bot.sendMessage(
        chatId,
        "📸 Got your photo!\n\nWhich role does this memory play in the story?",
        { reply_markup: tagKeyboard() },
      );
      return;
    }

    // ── Tag selected ──────────────────────────────────────────────────────
    if (s.step === "awaiting_tag") {
      // Find tag by emoji label or plain label
      const tag = HERO_TAGS.find(
        (t) => text === TAG_EMOJI[t.id] || text === t.label,
      );

      if (tag && s.pendingPhoto) {
        const photo = s.pendingPhoto;
        s.pendingPhoto = null;
        s.step = "idle";

        // Show typing indicator while we process
        await bot.sendChatAction(chatId, "typing");

        try {
          const result = await uploadTelegramPhoto({
            bot,
            photo,
            uploaderName: msg.from?.first_name || "Anonymous",
            heroTagId: tag.id,
          });

          // Switch to "sending photo" indicator
          await bot.sendChatAction(chatId, "upload_photo");

          // Build caption from chapter data
          const headline = result?.headline || TAG_EMOJI[tag.id];
          const description = result?.descriptionShort || "";
          const caption = [headline, description].filter(Boolean).join("\n\n");

          // Send cutout if available, otherwise the original image
          const imageUrl = result?.cutouts?.subject || result?.cloudinaryUrl;

          if (imageUrl) {
            await bot.sendPhoto(chatId, imageUrl, {
              caption,
              parse_mode: "Markdown",
              reply_markup: mainKeyboard(),
            });
          } else {
            await bot.sendMessage(chatId, `✅ *Memory added!*\n\n${caption}`, {
              parse_mode: "Markdown",
              reply_markup: mainKeyboard(),
            });
          }
        } catch (e) {
          console.error("[PublicBot] Upload error:", e.message);
          s.step = "idle";
          await bot.sendMessage(
            chatId,
            "❌ Something went wrong. Please try again.",
            { reply_markup: mainKeyboard() },
          );
        }
        return;
      }

      // Unrecognised input while awaiting tag — re-prompt
      await bot.sendMessage(
        chatId,
        "Please pick a role from the buttons below 👇",
        { reply_markup: tagKeyboard() },
      );
      return;
    }

    // ── Read chapter ──────────────────────────────────────────────────────
    if (text === "📖 Read chapter" || /chapter|story|today/i.test(text)) {
      await bot.sendChatAction(chatId, "typing");
      const chapters = await getTodaysChapters(20);

      if (!chapters.length) {
        await bot.sendMessage(
          chatId,
          `No chapters yet for day ${day}. Be the first to upload a memory! 📸`,
          { reply_markup: mainKeyboard() },
        );
        return;
      }

      // Send each chapter as a separate message so they are readable
      for (const chapter of chapters.reverse()) {
        // oldest first
        await bot.sendMessage(
          chatId,
          `📖 *${chapter.headline || `Day ${day}`}*

${chapter.text || ""}`,
          { parse_mode: "Markdown" },
        );
      }

      // Final message restores the keyboard
      await bot.sendMessage(
        chatId,
        `_${chapters.length} chapter${chapters.length > 1 ? "s" : ""} for day ${day}._`,
        { parse_mode: "Markdown", reply_markup: mainKeyboard() },
      );
      return;
    }

    // ── Upload memory ─────────────────────────────────────────────────────
    if (text === "📸 Upload memory" || /upload|memory/i.test(text)) {
      s.step = "awaiting_photo";
      await bot.sendMessage(
        chatId,
        "📷 Send your photo now — tap the 📎 attachment icon below.",
        { reply_markup: { remove_keyboard: true } },
      );
      return;
    }

    // ── Start / fallback ──────────────────────────────────────────────────
    const config = getChapterConfig(day);
    await bot.sendMessage(
      chatId,
      `🌀 *Living Story* — Day ${day}\n_${config?.headline || "The story is unfolding."}_\n\nWhat would you like to do?`,
      { parse_mode: "Markdown", reply_markup: mainKeyboard() },
    );
  });

  bot.on("polling_error", (err) =>
    console.error("[PublicBot] Polling error:", err.message),
  );

  console.log("[PublicBot] Ready.");
  return bot;
}
