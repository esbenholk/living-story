import TelegramBot from "node-telegram-bot-api";
import { randomUUID } from "node:crypto";
import { prisma } from "../lib/prisma.js";
import {
  uploadTelegramPhoto,
  getTodaysChapters,
  getLastEvents,
  getCurrentDay,
  getChapterConfig,
  defaultTagForDay,
  checkServicesReady,
} from "./botUtils.js";

let botInstance = null;

// recordingId → { chatId, day, cameraIndex, startedAt }
const recordingChatMap = new Map();

// One active Unity recording at a time
let activeRecording = null;

export async function notifyRecordingUploaded(payload) {
  const recordingId = payload.recordingId || payload.sessionId;

  if (!recordingId) {
    console.warn("[MasterBot] Uploaded recording had no recordingId.");
    return;
  }

  const target = recordingChatMap.get(recordingId);

  if (!target) {
    console.warn(
      "[MasterBot] Recording uploaded, but no Telegram chat was waiting:",
      recordingId,
    );
    return;
  }

  if (!botInstance) {
    console.warn("[MasterBot] Bot is not initialized yet.");
    return;
  }

  recordingChatMap.delete(recordingId);

  if (activeRecording?.id === recordingId) {
    activeRecording = null;
  }

  const sizeMb = payload.bytes
    ? `${(payload.bytes / 1024 / 1024).toFixed(1)} MB`
    : "unknown size";

  const duration = payload.duration
    ? `${Math.round(payload.duration)}s`
    : "unknown duration";

  await botInstance.sendMessage(
    target.chatId,
    `✅ Video uploaded\n\n` +
      `Camera: ${target.cameraIndex}\n` +
      `Recording id: ${recordingId}\n` +
      `Duration: ${duration}\n` +
      `Size: ${sizeMb}\n\n` +
      `${payload.secure_url || payload.url || ""}`,
  );
}

export async function notifyRecordingUploadFailed(payload) {
  const recordingId = payload.recordingId || payload.sessionId;

  if (!recordingId) {
    console.warn("[MasterBot] Recording upload failed with no recordingId.");
    return;
  }

  const target = recordingChatMap.get(recordingId);

  if (!target) {
    console.warn(
      "[MasterBot] Recording upload failed, but no Telegram chat was waiting:",
      recordingId,
    );
    return;
  }

  if (!botInstance) {
    console.warn("[MasterBot] Bot is not initialized yet.");
    return;
  }

  recordingChatMap.delete(recordingId);

  if (activeRecording?.id === recordingId) {
    activeRecording = null;
  }

  await botInstance.sendMessage(
    target.chatId,
    `❌ Video upload failed\n\n` +
      `Camera: ${target.cameraIndex}\n` +
      `Recording id: ${recordingId}\n` +
      `Error: ${payload.error || "Unknown error"}`,
  );
}

export function createMasterBot(token, io) {
  const MASTER_ID = process.env.TELEGRAM_MASTER_CHAT_ID;
  const bot = new TelegramBot(token, { polling: true });

  botInstance = bot;

  function isMasterChatId(chatId) {
    return !MASTER_ID || String(chatId) === String(MASTER_ID);
  }

  function isMaster(msg) {
    return isMasterChatId(msg.chat.id);
  }

  let awaitingResetConfirm = false;

  // Maps fileUniqueId → uploadEvent.id so we can delete by forwarding a photo
  const photoEventMap = new Map();

  function emitToUnity(eventName, payload) {
    if (!io) {
      throw new Error(
        "Socket.IO instance was not passed into createMasterBot(token, io).",
      );
    }

    console.log(`[MasterBot] emit ${eventName}`, {
      clients: io.engine?.clientsCount,
      payload,
    });

    io.emit(eventName, payload);
  }

  async function showCameraPicker(chatId) {
    if (activeRecording) {
      await bot.sendMessage(
        chatId,
        `🎥 A recording is already active.\n\nPress Done to stop it first.`,
      );
      return;
    }

    await bot.sendMessage(chatId, "🎥 Choose camera to record:", {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "Camera 0", callback_data: "recordVideo:camera:0" },
            { text: "Camera 1", callback_data: "recordVideo:camera:1" },
            { text: "Camera 2", callback_data: "recordVideo:camera:2" },
          ],
        ],
      },
    });
  }

  function buildDeleteEventPayload(ev) {
    return {
      uploadEventId: ev.id,
      day: ev.day,
      cloudinaryUrl: ev.cloudinaryUrl,
      cutouts: ev.cutouts || {},
      tags: ev.tags || [],
      colours: ev.colours || [],
      analysisRaw: ev.analysisRaw || {},
      uploaderName: ev.uploaderName || null,
      heroTagId: ev.heroTagId || ev.analysisRaw?.heroTagId || null,
      chapter: ev.chapter
        ? {
            headline: ev.chapter.headline || null,
            text: ev.chapter.text || null,
          }
        : null,
      timestamp: ev.createdAt,
      deletedAt: new Date().toISOString(),
      source: "telegram-master-bot",
    };
  }

  async function startVideoRecording(chatId, cameraIndex = 0) {
    if (activeRecording) {
      await bot.sendMessage(
        chatId,
        `🎥 A recording is already active.\n\nPress Done to stop it first.`,
      );
      return;
    }

    if (![0, 1, 2].includes(cameraIndex)) {
      await bot.sendMessage(
        chatId,
        `❌ Invalid camera index: ${cameraIndex}. Choose 0, 1, or 2.`,
      );
      return;
    }

    const day = getCurrentDay();
    const recordingId = randomUUID();

    recordingChatMap.set(recordingId, {
      chatId,
      day,
      cameraIndex,
      startedAt: Date.now(),
    });

    const payload = {
      recordingId,
      sessionId: recordingId,
      day,
      cameraIndex,
      maxSeconds: 300,
      startedAt: new Date().toISOString(),
      source: "telegram-master-bot",
    };

    try {
      emitToUnity("recordVideo:start", payload);
    } catch (e) {
      recordingChatMap.delete(recordingId);
      await bot.sendMessage(chatId, `❌ Could not start recording: ${e.message}`);
      return;
    }

    const sent = await bot.sendMessage(
      chatId,
      `🎥 Recording started\n\n` +
        `Camera: ${cameraIndex}\n` +
        `Day: ${day}\n` +
        `Recording id: ${recordingId}\n\n` +
        `Press Done when you want to stop recording.`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "✅ Done",
                callback_data: `recordVideo:done:${recordingId}`,
              },
            ],
          ],
        },
      },
    );

    activeRecording = {
      id: recordingId,
      day,
      cameraIndex,
      chatId,
      startedAt: Date.now(),
      controlMessageId: sent.message_id,
    };
  }

  async function finishVideoRecording(chatId, recordingIdFromButton = null) {
    if (!activeRecording) {
      await bot.sendMessage(chatId, "No active recording.");
      return;
    }

    if (
      recordingIdFromButton &&
      String(recordingIdFromButton) !== String(activeRecording.id)
    ) {
      await bot.sendMessage(
        chatId,
        "That Done button belongs to an older recording.",
      );
      return;
    }

    const recording = activeRecording;
    activeRecording = null;

    const durationSeconds = Math.round(
      (Date.now() - recording.startedAt) / 1000,
    );

    try {
      emitToUnity("recordVideo:stop", {
        recordingId: recording.id,
        sessionId: recording.id,
        day: recording.day,
        cameraIndex: recording.cameraIndex,
        durationSeconds,
        endedAt: new Date().toISOString(),
        source: "telegram-master-bot",
      });
    } catch (e) {
      await bot.sendMessage(chatId, `❌ Could not stop recording: ${e.message}`);
      return;
    }

    bot
      .editMessageReplyMarkup(
        { inline_keyboard: [] },
        {
          chat_id: recording.chatId,
          message_id: recording.controlMessageId,
        },
      )
      .catch(() => {});

    await bot.sendMessage(
      chatId,
      `🛑 Recording stopped\n\n` +
        `Camera: ${recording.cameraIndex}\n` +
        `Duration: ${durationSeconds}s\n` +
        `Recording id: ${recording.id}\n\n` +
        `Unity should now finalize and upload the MP4.`,
    );
  }

  bot.on("callback_query", async query => {
    const msg = query.message;
    if (!msg) return;

    const chatId = msg.chat.id;

    if (!isMasterChatId(chatId)) {
      await bot.answerCallbackQuery(query.id, {
        text: "Not allowed",
        show_alert: true,
      });
      return;
    }

    const data = query.data || "";

    const cameraMatch = data.match(/^recordVideo:camera:([0-2])$/);
    if (cameraMatch) {
      const cameraIndex = Number(cameraMatch[1]);

      await bot.answerCallbackQuery(query.id, {
        text: `Starting camera ${cameraIndex}…`,
      });

      await startVideoRecording(chatId, cameraIndex);
      return;
    }

    const doneMatch = data.match(/^recordVideo:done:(.+)$/);
    if (doneMatch) {
      await bot.answerCallbackQuery(query.id, {
        text: "Stopping recording…",
      });

      await finishVideoRecording(chatId, doneMatch[1]);
      return;
    }

    await bot.answerCallbackQuery(query.id);
  });

  bot.on("message", async msg => {
    if (!isMaster(msg)) return;

    const chatId = msg.chat.id;
    const text = msg.text || "";
    const day = getCurrentDay();

    // ── Photo received ────────────────────────────────────────────────────
    if (msg.photo) {
      const fileUniqueId = msg.photo[msg.photo.length - 1].file_unique_id;

      // If this photo matches a known event → delete it
if (photoEventMap.has(fileUniqueId)) {
  const eventId = photoEventMap.get(fileUniqueId);

  try {
    const ev = await prisma.uploadEvent.findUnique({
      where: { id: eventId },
      include: { chapter: true },
    });

      if (!ev) {
        photoEventMap.delete(fileUniqueId);
        await bot.sendMessage(chatId, `⚠️ Event ${eventId} was already gone.`);
        return;
      }

      const deletePayload = buildDeleteEventPayload(ev);

      await prisma.chapter.deleteMany({ where: { uploadEventId: eventId } });
      await prisma.uploadEvent.delete({ where: { id: eventId } });

      photoEventMap.delete(fileUniqueId);

      emitToUnity("delete_event", deletePayload);

      await bot.sendMessage(
        chatId,
        `🗑️ Deleted event ${eventId} and notified Unity.`,
      );
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
          bot,
          photo: msg.photo[msg.photo.length - 1],
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
        await prisma.storyState.deleteMany();
        photoEventMap.clear();

        await bot.sendMessage(
          chatId,
          "✅ All events, chapters and story state deleted.",
        );
      } else {
        await bot.sendMessage(chatId, "Reset cancelled.");
      }

      return;
    }

    // ── /recordVideo ──────────────────────────────────────────────────────
    const recordVideoMatch = text.match(/^\/recordVideo\s*([0-2])?/i);
    if (recordVideoMatch) {
      const cameraIndex =
        recordVideoMatch[1] !== undefined ? Number(recordVideoMatch[1]) : null;

      if (cameraIndex === null) {
        await showCameraPicker(chatId);
      } else {
        await startVideoRecording(chatId, cameraIndex);
      }

      return;
    }

    // Optional fallback: lets you type "done" instead of pressing the button
    if (/^done$/i.test(text.trim()) && activeRecording) {
      await finishVideoRecording(chatId);
      return;
    }

    // ── /images [n] ───────────────────────────────────────────────────────
    const imagesMatch = text.match(/^\/images\s*(\d+)?/i);
    if (imagesMatch) {
      const limit = Math.min(parseInt(imagesMatch[1] || "10"), 20);
      const events = await getLastEvents(limit);

      if (!events.length) {
        await bot.sendMessage(chatId, "No uploads yet.");
        return;
      }

      await bot.sendMessage(
        chatId,
        `Last ${events.length} uploads — forward any photo back to delete it:`,
      );

      for (const ev of events) {
        const url = ev.cutouts?.subject || ev.cloudinaryUrl;
        if (!url) continue;

        try {
          const sent = await bot.sendPhoto(chatId, url, {
            caption: [
              ev.chapter?.headline || `Day ${ev.day}`,
              ev.uploaderName ? `by ${ev.uploaderName}` : "",
              ev.heroTagId ? `#${ev.heroTagId}` : "",
              `id: ${ev.id}`,
            ]
              .filter(Boolean)
              .join(" · "),
          });

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
        await bot.sendMessage(
          chatId,
          `📖 *${chapter.headline || `Day ${day}`}*\n\n${chapter.text || ""}`,
          { parse_mode: "Markdown" },
        );
      }

      await bot.sendMessage(
        chatId,
        `_${chapters.length} chapter${
          chapters.length > 1 ? "s" : ""
        } for day ${day}._`,
        { parse_mode: "Markdown" },
      );

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

      await bot.sendMessage(
        chatId,
        `📊 *Status*\n\n` +
          `Day: ${day}\n` +
          `Theme: ${config?.headline || "—"}\n` +
          `Uploads today: ${todayCount}\n` +
          `Total uploads: ${totalCount}\n\n` +
          `Sidecar: ${serviceStatus.sidecar ? "✅" : "🔴"}\n` +
          `Ollama: ${serviceStatus.ollama ? "✅" : "🔴"}`,
        { parse_mode: "Markdown" },
      );

      return;
    }

    // ── /reboot ───────────────────────────────────────────────────────────────
    if (/^\/reboot/i.test(text)) {
      const payload = {
        requestedAt: new Date().toISOString(),
        requestedBy: "telegram-master-bot",
        day,
      };

      try {
        emitToUnity("reboot_simulation", payload);

        await bot.sendMessage(
          chatId,
          `🔁 Reboot signal sent to Unity.\n\nplease check screen to confirm`,
        );
      } catch (e) {
        await bot.sendMessage(chatId, `❌ Could not emit reboot: ${e.message}`);
      }

      return;
    }

    // ── /reset ────────────────────────────────────────────────────────────
    if (/^\/reset/i.test(text)) {
      awaitingResetConfirm = true;

      await bot.sendMessage(
        chatId,
        "⚠️ This will delete ALL events and chapters. Type *yes* to confirm.",
        { parse_mode: "Markdown" },
      );

      return;
    }

    // ── /start or fallback ────────────────────────────────────────────────
    await bot.sendMessage(
      chatId,
      `🔑 *Master Bot* — Day ${day}\n\n` +
        `/images [n] — last N uploads (forward one back to delete it)\n` +
        `/chapter — all of today's chapters\n` +
        `/status — upload stats + service health\n` +
        `/recordVideo — choose camera and start Unity recording\n` +
        `/recordVideo 0 — start recording camera 0\n` +
        `/recordVideo 1 — start recording camera 1\n` +
        `/recordVideo 2 — start recording camera 2\n` +
        `/reboot — send reboot signal to Unity\n` +
        `/reset — clear all data\n\n` +
        `Send a photo to upload.`,
      { parse_mode: "Markdown" },
    );
  });

  // bot.on("polling_error", err =>
  //   console.error("[MasterBot] Polling error:", err.message));

  console.log("[MasterBot] Ready.");
  return bot;
}