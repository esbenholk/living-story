/**
 * personalBot.js
 * --------------
 * Personal bot factory — creates one bot per hero tag.
 * Pre-tagged: every upload uses the assigned heroTagId.
 * No tag selection step. Open to anyone with the link.
 *
 * createPersonalBot(token, heroTagId) → TelegramBot
 */

import TelegramBot from "node-telegram-bot-api";
import {
  uploadTelegramPhoto, getTodaysChapters, formatChapterMessage,
  mainMenuKeyboard, getCurrentDay, getChapterConfig, HERO_TAGS,
} from "./botUtils.js";

export function createPersonalBot(token, heroTagId) {
  const bot     = new TelegramBot(token, { polling: true });
  const tagInfo = HERO_TAGS.find(t => t.id === heroTagId);

  bot.on("message", async msg => {
    const chatId = msg.chat.id;
    const text   = msg.text || "";
    const day    = getCurrentDay();

    // Photo — always upload with preset tag
    if (msg.photo) {
      const largest = msg.photo[msg.photo.length - 1];
      await bot.sendMessage(chatId, "⏳ Adding your memory…");
      try {
        await uploadTelegramPhoto({
          bot, photo: largest,
          uploaderName: msg.from?.first_name,
          heroTagId,
        });
        await bot.sendMessage(chatId,
          `✅ *Memory added as ${tagInfo?.label || heroTagId}*\n_Day ${day} — the story grows._`,
          { parse_mode: "Markdown", reply_markup: mainMenuKeyboard() });
      } catch (e) {
        console.error(`[PersonalBot:${heroTagId}] Upload error:`, e.message);
        await bot.sendMessage(chatId, "❌ Upload failed. Try again.",
          { reply_markup: mainMenuKeyboard() });
      }
      return;
    }

    // Chapter
    if (text === "📖 Today's chapter" || /chapter|story/i.test(text)) {
      const chapters = await getTodaysChapters(1);
      await bot.sendMessage(chatId,
        await formatChapterMessage(chapters[0], day),
        { parse_mode: "Markdown", reply_markup: mainMenuKeyboard() });
      return;
    }

    // Start / any text
    const config = getChapterConfig(day);
    await bot.sendMessage(chatId,
      `🌀 *${tagInfo?.label || "Living Story"}* — Day ${day}\n` +
      `_${config?.headline || "The story awaits."}_\n\n` +
      `Send a photo to add your memory as *${tagInfo?.label || heroTagId}*.`,
      { parse_mode: "Markdown", reply_markup: mainMenuKeyboard() });
  });

  console.log(`[PersonalBot:${heroTagId}] Ready.`);
  return bot;
}
