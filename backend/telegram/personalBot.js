import TelegramBot from "node-telegram-bot-api";
import {
  uploadTelegramPhoto, getTodaysChapters, formatChapterMessage,
  mainMenuKeyboard, getCurrentDay, getChapterConfig, HERO_TAGS,
  checkServicesReady,
} from "./botUtils.js";

export function createPersonalBot(token, heroTagId) {
  const bot     = new TelegramBot(token, { polling: true });
  const tagInfo = HERO_TAGS.find(t => t.id === heroTagId);

  bot.on("message", async msg => {
    const chatId = msg.chat.id;
    const text   = msg.text || "";
    const day    = getCurrentDay();

    // ── Service check ─────────────────────────────────────────────────────
    const status = await checkServicesReady();
    if (!status.ready) {
      const issues = [
        !status.sidecar && "image processing",
        !status.ollama  && "story generation",
      ].filter(Boolean).join(" and ");
      await bot.sendMessage(chatId,
        `⚠️ Sorry — the story system is currently down.\n\n` +
        `_${issues} ${issues.includes("and") ? "are" : "is"} not responding._\n\n` +
        `Please try again in a few minutes.`,
        { parse_mode: "Markdown", reply_markup: mainMenuKeyboard() });
      return;
    }

    // ── Photo — always upload with preset tag ─────────────────────────────
    if (msg.photo) {
      const largest = msg.photo[msg.photo.length - 1];
      await bot.sendChatAction(chatId, "typing");
      try {
        const result = await uploadTelegramPhoto({
          bot, photo: largest,
          uploaderName: msg.from?.first_name,
          heroTagId,
        });

        await bot.sendChatAction(chatId, "upload_photo");

        const headline    = result?.headline    || tagInfo?.label || heroTagId;
        const description = result?.descriptionShort || "";
        const caption     = [headline, description].filter(Boolean).join("\n\n");
        const imageUrl    = result?.cutouts?.subject || result?.cloudinaryUrl;

        if (imageUrl) {
          await bot.sendPhoto(chatId, imageUrl, {
            caption,
            parse_mode:   "Markdown",
            reply_markup: mainMenuKeyboard(),
          });
        } else {
          await bot.sendMessage(chatId,
            `✅ *Memory added as ${tagInfo?.label || heroTagId}*\n_Day ${day} — the story grows._`,
            { parse_mode: "Markdown", reply_markup: mainMenuKeyboard() });
        }
      } catch (e) {
        console.error(`[PersonalBot:${heroTagId}] Upload error:`, e.message);
        await bot.sendMessage(chatId, "❌ Upload failed. Try again.",
          { reply_markup: mainMenuKeyboard() });
      }
      return;
    }

    // ── Chapter ───────────────────────────────────────────────────────────
    if (text === "📖 Today's chapter" || /chapter|story/i.test(text)) {
      await bot.sendChatAction(chatId, "typing");
      const chapters = await getTodaysChapters(20);

      if (!chapters.length) {
        await bot.sendMessage(chatId,
          `No chapters yet for day ${day}. Be the first to upload a memory! 📸`,
          { reply_markup: mainMenuKeyboard() });
        return;
      }

      for (const chapter of chapters.reverse()) {
        await bot.sendMessage(chatId,
          `📖 *${chapter.headline || `Day ${day}`}*\n\n${chapter.text || ""}`,
          { parse_mode: "Markdown" });
      }

      await bot.sendMessage(chatId,
        `_${chapters.length} chapter${chapters.length > 1 ? "s" : ""} for day ${day}._`,
        { parse_mode: "Markdown", reply_markup: mainMenuKeyboard() });
      return;
    }

    // ── Start / fallback ──────────────────────────────────────────────────
    const config = getChapterConfig(day);
    await bot.sendMessage(chatId,
      `🌀 *${tagInfo?.label || "Living Story"}* — Day ${day}\n` +
      `_${config?.headline || "The story awaits."}_\n\n` +
      `Send a photo to add your memory as *${tagInfo?.label || heroTagId}*.`,
      { parse_mode: "Markdown", reply_markup: mainMenuKeyboard() });
  });

  bot.on("polling_error", err =>
    console.error(`[PersonalBot:${heroTagId}] Polling error:`, err.message));

  console.log(`[PersonalBot:${heroTagId}] Ready.`);
  return bot;
}