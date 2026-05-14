/**
 * botUtils.js
 * -----------
 * Shared utilities for all Living Story Telegram bots.
 * Upload pipeline, chapter fetching, image gallery.
 */

import fetch from "node-fetch";
import FormData from "form-data";
import { prisma } from "../lib/prisma.js";

import { getCurrentDay, getChapterConfig } from "../services/day.service.js";
import { HERO_TAGS, defaultTagForDay } from "../config/heroTags.js";

const BACKEND = process.env.SELF_URL || "http://localhost:3001";

// ── Upload ────────────────────────────────────────────────────────────────

/**
 * Download a Telegram photo and POST it to /api/upload.
 * Returns the upload result JSON.
 */
export async function uploadTelegramPhoto({
  bot,
  photo,
  uploaderName,
  heroTagId,
  caption,
}) {
  const token = bot.token;
  const fileInfo = await bot.getFile(photo.file_id);
  const fileUrl = `https://api.telegram.org/file/bot${token}/${fileInfo.file_path}`;

  const imgRes = await fetch(fileUrl);
  const imgBuffer = Buffer.from(await imgRes.arrayBuffer());

  const day = getCurrentDay();
  const tagId = heroTagId || defaultTagForDay(day)?.id || "hero";

  const form = new FormData();
  form.append("image", imgBuffer, {
    filename: "telegram.jpg",
    contentType: "image/jpeg",
  });
  form.append("heroTagId", tagId);
  form.append("uploaderName", uploaderName || "Telegram");
  if (caption) form.append("caption", caption);

  const res = await fetch(`${BACKEND}/api/upload`, {
    method: "POST",
    body: form,
    headers: form.getHeaders(),
  });

  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  return res.json();
}

// ── Chapter ───────────────────────────────────────────────────────────────

export async function getTodaysChapters(limit = 1) {
  const day = getCurrentDay();
  return prisma.chapter.findMany({
    where: { day },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function formatChapterMessage(chapter, day) {
  if (!chapter)
    return `No chapters yet for day ${day}. Be the first to upload a memory! 📷`;
  return `📖 *${chapter.headline || `Day ${day}`}*\n\n${chapter.text || "The story is unfolding…"}`;
}

// ── Last N images ─────────────────────────────────────────────────────────

export async function getLastEvents(limit = 10) {
  return prisma.uploadEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { chapter: true },
  });
}

// ── Hero tag helpers ──────────────────────────────────────────────────────

export function tagByLabel(label) {
  return HERO_TAGS.find((t) => t.label === label);
}

export function tagKeyboard() {
  const rows = [];
  for (let i = 0; i < HERO_TAGS.length; i += 2) {
    const row = [{ text: HERO_TAGS[i].label }];
    if (HERO_TAGS[i + 1]) row.push({ text: HERO_TAGS[i + 1].label });
    rows.push(row);
  }
  return { keyboard: rows, resize_keyboard: true, one_time_keyboard: true };
}

export function mainMenuKeyboard() {
  return {
    keyboard: [
      [{ text: "📖 Today's chapter" }],
      [{ text: "📷 Upload a memory" }],
    ],
    resize_keyboard: true,
    one_time_keyboard: false,
  };
}

export { getCurrentDay, getChapterConfig, HERO_TAGS, defaultTagForDay };
