/**
 * masterBot.js
 * ------------
 * Private master bot — locked to TELEGRAM_MASTER_CHAT_ID.
 * Admin commands:
 *   /images [n]  — get last N uploaded images as a photo gallery (default 10)
 *   /chapter     — today's chapter
 *   /status      — upload stats for today
 *   /reset       — clear all test events (confirmation required)
 *   Any photo    — uploads with day-default hero tag
 */

import TelegramBot from "node-telegram-bot-api";
import { prisma } from "../lib/prisma.js";

import {
  uploadTelegramPhoto,
  getTodaysChapters,
  formatChapterMessage,
  getLastEvents,
  getCurrentDay,
  getChapterConfig,
  defaultTagForDay,
} from "./botUtils.js";

export function createMasterBot(token) {
  const MASTER_ID = process.env.TELEGRAM_MASTER_CHAT_ID;
  const bot = new TelegramBot(token, { polling: true });

  // Guard — ignore everyone except the master chat
  function isMaster(msg) {
    return !MASTER_ID || String(msg.chat.id) === String(MASTER_ID);
  }

  let awaitingResetConfirm = false;

  bot.on("message", async (msg) => {
    if (!isMaster(msg)) return;

    const chatId = msg.chat.id;
    const text = msg.text || "";
    const day = getCurrentDay();

    // ── Photo — upload with day default ───────────────────────────────────
    if (msg.photo) {
      const largest = msg.photo[msg.photo.length - 1];
      await bot.sendMessage(chatId, "⏳ Uploading…");
      try {
        await uploadTelegramPhoto({
          bot,
          photo: largest,
          uploaderName: "Master",
          heroTagId: defaultTagForDay(day)?.id || "hero",
        });
        await bot.sendMessage(chatId, "✅ Uploaded.");
      } catch (e) {
        await bot.sendMessage(chatId, `❌ Upload failed: ${e.message}`);
      }
      return;
    }

    // ── Reset confirmation ────────────────────────────────────────────────
    if (awaitingResetConfirm) {
      awaitingResetConfirm = false;
      if (text.toLowerCase() === "yes") {
        await prisma.chapter.deleteMany();
        await prisma.uploadEvent.deleteMany();
        await bot.sendMessage(chatId, "✅ All events and chapters deleted.");
      } else {
        await bot.sendMessage(chatId, "Reset cancelled.");
      }
      return;
    }

    // ── Commands ──────────────────────────────────────────────────────────

    // /images [n]
    const imagesMatch = text.match(/^\/images\s*(\d+)?/i);
    if (imagesMatch) {
      const limit = Math.min(parseInt(imagesMatch[1] || "10"), 20);
      const events = await getLastEvents(limit);

      if (!events.length) {
        await bot.sendMessage(chatId, "No uploads yet.");
        return;
      }

      await bot.sendMessage(chatId, `Last ${events.length} uploads:`);

      for (const ev of events) {
        const url = ev.cutouts?.subject || ev.cloudinaryUrl;
        if (!url) continue;
        try {
          await bot.sendPhoto(chatId, url, {
            caption: [
              ev.chapter?.headline || `Day ${ev.day}`,
              ev.uploaderName ? `by ${ev.uploaderName}` : "",
              ev.heroTagId ? `#${ev.heroTagId}` : "",
            ]
              .filter(Boolean)
              .join(" · "),
          });
        } catch {
          // If Telegram can't load the URL, send it as text
          await bot.sendMessage(chatId, url);
        }
      }
      return;
    }

    // /chapter
    if (/^\/chapter|📖/i.test(text)) {
      const chapters = await getTodaysChapters(1);
      await bot.sendMessage(
        chatId,
        await formatChapterMessage(chapters[0], day),
        { parse_mode: "Markdown" },
      );
      return;
    }

    // /status
    if (/^\/status/i.test(text)) {
      const todayCount = await prisma.uploadEvent.count({ where: { day } });
      const totalCount = await prisma.uploadEvent.count();
      const config = getChapterConfig(day);
      await bot.sendMessage(
        chatId,
        `📊 *Status*\n\n` +
          `Day: ${day}\n` +
          `Theme: ${config?.headline || "—"}\n` +
          `Uploads today: ${todayCount}\n` +
          `Total uploads: ${totalCount}`,
        { parse_mode: "Markdown" },
      );
      return;
    }

    // /reset
    if (/^\/reset/i.test(text)) {
      awaitingResetConfirm = true;
      await bot.sendMessage(
        chatId,
        "⚠️ This will delete ALL events and chapters. Type *yes* to confirm.",
        { parse_mode: "Markdown" },
      );
      return;
    }

    // /start or fallback
    await bot.sendMessage(
      chatId,
      `🔑 *Master Bot* — Day ${day}\n\n` +
        `/images [n] — last N uploads\n` +
        `/chapter    — today's chapter\n` +
        `/status     — upload stats\n` +
        `/reset      — clear all data\n\n` +
        `Send a photo to upload.`,
      { parse_mode: "Markdown" },
    );
  });

  console.log("[MasterBot] Ready.");
  return bot;
}
