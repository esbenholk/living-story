import TelegramBot from "node-telegram-bot-api";
import { prisma } from "../lib/prisma.js";
import {
  uploadTelegramPhoto, getTodaysChapters, formatChapterMessage,
  getLastEvents, getCurrentDay, getChapterConfig, defaultTagForDay,
  checkServicesReady,
} from "./botUtils.js";

export function createMasterBot(token) {
  const MASTER_ID = process.env.TELEGRAM_MASTER_CHAT_ID;
  const bot       = new TelegramBot(token, { polling: true });

  function isMaster(msg) {
    return !MASTER_ID || String(msg.chat.id) === String(MASTER_ID);
  }

  let awaitingResetConfirm = false;

  // Maps fileUniqueId → uploadEvent.id so we can delete by forwarding a photo
  const photoEventMap = new Map();

  bot.on("message", async msg => {
    if (!isMaster(msg)) return;

    const chatId = msg.chat.id;
    const text   = msg.text || "";
    const day    = getCurrentDay();

    // ── Photo received ────────────────────────────────────────────────────
    if (msg.photo) {
      const fileUniqueId = msg.photo[msg.photo.length - 1].file_unique_id;

      // If this photo matches a known event → delete it
      if (photoEventMap.has(fileUniqueId)) {
        const eventId = photoEventMap.get(fileUniqueId);
        try {
          await prisma.chapter.deleteMany({ where: { uploadEventId: eventId } });
          await prisma.uploadEvent.delete({ where: { id: eventId } });
          photoEventMap.delete(fileUniqueId);
          await bot.sendMessage(chatId, `🗑️ Deleted event ${eventId}.`);
        } catch (e) {
          await bot.sendMessage(chatId, `❌ Delete failed: ${e.message}`);
        }
        return;
      }

      // Otherwise — upload it
      const status = await checkServicesReady();
      if (!status.ready) {
        await bot.sendMessage(chatId, "🔴 Bot is down — upload unavailable.");
        return;
      }

      await bot.sendChatAction(chatId, "typing");
      try {
        await uploadTelegramPhoto({
          bot, photo: msg.photo[msg.photo.length - 1],
          uploaderName: "Master",
          heroTagId:    defaultTagForDay(day)?.id || "hero",
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
        await prisma.storyState.deleteMany();
        photoEventMap.clear();
        await bot.sendMessage(chatId, "✅ All events, chapters and story state deleted.");
      } else {
        await bot.sendMessage(chatId, "Reset cancelled.");
      }
      return;
    }

    // ── /images [n] ───────────────────────────────────────────────────────
    const imagesMatch = text.match(/^\/images\s*(\d+)?/i);
    if (imagesMatch) {
      const limit  = Math.min(parseInt(imagesMatch[1] || "10"), 20);
      const events = await getLastEvents(limit);

      if (!events.length) {
        await bot.sendMessage(chatId, "No uploads yet.");
        return;
      }

      await bot.sendMessage(chatId,
        `Last ${events.length} uploads — forward any photo back to delete it:`);

      for (const ev of events) {
        const url = ev.cutouts?.subject || ev.cloudinaryUrl;
        if (!url) continue;
        try {
          const sent = await bot.sendPhoto(chatId, url, {
            caption: [
              ev.chapter?.headline || `Day ${ev.day}`,
              ev.uploaderName ? `by ${ev.uploaderName}` : "",
              ev.heroTagId    ? `#${ev.heroTagId}` : "",
              `id: ${ev.id}`,
            ].filter(Boolean).join(" · "),
          });
          // Register the sent photo so forwarding it back triggers delete
          if (sent.photo) {
            const fuid = sent.photo[sent.photo.length - 1].file_unique_id;
            photoEventMap.set(fuid, ev.id);
          }
        } catch {
          await bot.sendMessage(chatId, `${url}\nid: ${ev.id}`);
        }
      }
      return;
    }

    // ── /chapter ──────────────────────────────────────────────────────────
    if (/^\/chapter|📖/i.test(text)) {
      await bot.sendChatAction(chatId, "typing");
      const chapters = await getTodaysChapters(20);

      if (!chapters.length) {
        await bot.sendMessage(chatId, `No chapters yet for day ${day}.`);
        return;
      }

      for (const chapter of chapters.reverse()) {
        await bot.sendMessage(chatId,
          `📖 *${chapter.headline || `Day ${day}`}*\n\n${chapter.text || ""}`,
          { parse_mode: "Markdown" });
      }

      await bot.sendMessage(chatId,
        `_${chapters.length} chapter${chapters.length > 1 ? "s" : ""} for day ${day}._`,
        { parse_mode: "Markdown" });
      return;
    }

    // ── /status ───────────────────────────────────────────────────────────
    if (/^\/status/i.test(text)) {
      const [todayCount, totalCount, serviceStatus] = await Promise.all([
        prisma.uploadEvent.count({ where: { day } }),
        prisma.uploadEvent.count(),
        checkServicesReady(),
      ]);
      const config = getChapterConfig(day);
      await bot.sendMessage(chatId,
        `📊 *Status*\n\n` +
        `Day: ${day}\n` +
        `Theme: ${config?.headline || "—"}\n` +
        `Uploads today: ${todayCount}\n` +
        `Total uploads: ${totalCount}\n\n` +
        `Sidecar: ${serviceStatus.sidecar ? "✅" : "🔴"}\n` +
        `Ollama: ${serviceStatus.ollama  ? "✅" : "🔴"}`,
        { parse_mode: "Markdown" });
      return;
    }

    // ── /reset ────────────────────────────────────────────────────────────
    if (/^\/reset/i.test(text)) {
      awaitingResetConfirm = true;
      await bot.sendMessage(chatId,
        "⚠️ This will delete ALL events and chapters. Type *yes* to confirm.",
        { parse_mode: "Markdown" });
      return;
    }

    // ── /start or fallback ────────────────────────────────────────────────
    await bot.sendMessage(chatId,
      `🔑 *Master Bot* — Day ${day}\n\n` +
      `/images [n] — last N uploads (forward one back to delete it)\n` +
      `/chapter    — all of today's chapters\n` +
      `/status     — upload stats + service health\n` +
      `/reset      — clear all data\n\n` +
      `Send a photo to upload.`,
      { parse_mode: "Markdown" });
  });

  // bot.on("polling_error", err =>
  //   console.error("[MasterBot] Polling error:", err.message));

  console.log("[MasterBot] Ready.");
  return bot;
}