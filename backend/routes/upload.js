import express from "express";
import multer from "multer";
import { io } from "../server.js";
import { getCutouts } from "../services/cutout.service.js";
import {
  describeImageShort,
  describeImageLong,
  generateStoryOutput,
} from "../services/llm.service.js";
import { loadState, saveState, applyUpdates } from "../services/story.state.service.js";
import { getCurrentDay, getChapterConfig } from "../services/day.service.js";
import { prisma } from "../lib/prisma.js";
import {
  uploadImage,
  updateContext,
  extractPublicIds,
} from "../services/cloudinary.service.js";
import { HERO_TAGS, defaultTagForDay } from "../config/heroTags.js";

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
}).fields([
  { name: "image",     maxCount: 1 },
  { name: "left_eye",  maxCount: 1 },
  { name: "right_eye", maxCount: 1 },
  { name: "mouth",     maxCount: 1 },
]);

// ── Simple serial queue ───────────────────────────────────────────────────
// Ensures LLM jobs run one at a time so state never races.
let llmQueue = Promise.resolve();

function enqueue(fn) {
  llmQueue = llmQueue.then(fn).catch(err =>
    console.error("[QUEUE] Job failed:", err.message));
}

// ── Upload route ──────────────────────────────────────────────────────────

router.post("/upload", upload, async (req, res) => {
  try {
    const day          = getCurrentDay();
    const uploaderName = req.body.uploaderName || null;
    const heroTagId    = req.body.heroTagId || null;
    const heroTag      = HERO_TAGS.find(t => t.id === heroTagId) || defaultTagForDay(day);

    console.log(`[UPLOAD] heroTag: ${heroTag.id} (${heroTag.label}), day: ${day}`);

    const imageFile = req.files?.image?.[0];
    if (!imageFile) return res.status(400).json({ error: "image required" });

    const faceCropFiles = {
      left_eye:  req.files?.left_eye?.[0]  ?? null,
      right_eye: req.files?.right_eye?.[0] ?? null,
      mouth:     req.files?.mouth?.[0]     ?? null,
    };

    // 1. Upload to Cloudinary — fast, do this before responding
    const filename    = `upload_${Date.now()}`;
    const cloudResult = await uploadImage(imageFile.buffer, filename);
    const { secure_url, colors } = cloudResult;
    const tags    = (cloudResult.tags || []).map(t => t.tag || t).slice(0, 10);
    const colours = colors?.predominant?.google || colors?.predominant?.cloudinary || [];

    // 2. Create DB record immediately so Unity can show a pending card
    const event = await prisma.uploadEvent.create({
      data: {
        day,
        cloudinaryUrl: secure_url,
        cutouts:       {},
        tags,
        colours,
        analysisRaw:   { ...cloudResult, heroTagId: heroTag.id },
        uploaderName,
        chapter: {
          create: {
            day,
            headline: "...",
            text:     null,
          },
        },
      },
      include: { chapter: true },
    });

    // 3. Respond immediately — user is done waiting
    res.json({ success: true, eventId: event.id, status: "queued" });

    // 4. Broadcast that something is incoming so Unity can show a spinner
    io.emit("pipeline_start", { uploadEventId: event.id, uploaderName, day });

    // 5. Queue the slow work — runs in background
    enqueue(async () => {
      try {
        // Cutout sidecar
        let cutouts = {};
        try {
          cutouts = await getCutouts(
            secure_url,
            { day, uploaderName: uploaderName || "" },
            faceCropFiles,
          );
        } catch (e) {
          console.warn("[UPLOAD] Cutout sidecar unavailable:", e.message);
        }

        // LLaVA descriptions
        let descriptionShort = null;
        let descriptionLong  = null;
        let memeText         = null;
        try {
          const [shortResult, longResult] = await Promise.all([
            describeImageShort(secure_url).catch(() => null),
            describeImageLong(secure_url).catch(() => null),
          ]);
          descriptionShort = shortResult?.caption  ?? null;
          memeText         = shortResult?.memeText ?? null;
          descriptionLong  = longResult;
        } catch (e) {
          console.warn("[UPLOAD] LLaVA descriptions failed:", e.message);
        }
 
        // Load state + generate chapter
        const config   = getChapterConfig(day);
        const state    = await loadState();
        state.grandArcDay = day;
        const analysis = { tags, colours, descriptionShort, descriptionLong, heroTag };

        let chapterText  = null;
        let headlineText = null;
        let stateUpdates = {};

        try {
          const output = await generateStoryOutput({ config, analysis, state });
          chapterText  = output.chapter;
          headlineText = output.headline;
          stateUpdates = output.stateUpdates || {};
        } catch (e) {
          console.warn("[UPLOAD] LLM generation failed:", e.message);
        }

        // Save state
        const nextState = applyUpdates(state, stateUpdates);
        if (chapterText) nextState.lastChapter = chapterText;
        await saveState(nextState).catch(e =>
          console.warn("[UPLOAD] State save failed:", e.message));

        // Update DB record with results
        await prisma.uploadEvent.update({
          where: { id: event.id },
          data:  {
            cutouts,
              analysisRaw: {
              ...cloudResult,
              descriptionShort,
              descriptionLong,
              memeText,
              heroTagId: heroTag.id,
            },
          },
        });

        await prisma.chapter.update({
          where: { uploadEventId: event.id },
          data:  {
            headline: headlineText || config.headline,
            text:     chapterText,
          },
        });

        // Backfill Cloudinary metadata
        const publicIds = extractPublicIds(cloudResult, cutouts);
        updateContext(publicIds, {
          description_short: descriptionShort || "",
          description_long:  descriptionLong  || "",
          meme_text:         memeText         || "",
          chapter:           chapterText      || "",
          headline:          headlineText     || config.headline,
          day:               String(day),
          uploader:          uploaderName     || "",
          hero_tag:          heroTag.id,
        }).catch(e => console.warn("[UPLOAD] Cloudinary context update failed:", e.message));

        // Broadcast completed chapter to Unity
        io.emit("new_chapter", {
          day,
          headline:      headlineText || config.headline,
          cloudinaryUrl: secure_url,
          cutouts,
          analysis:      { tags, colours, descriptionShort, descriptionLong, heroTag },
          chapterText,
          uploadEventId: event.id,
          uploaderName,
          timestamp:     event.createdAt,
        });

      } catch (err) {
        console.error("[QUEUE] Pipeline error:", err);
        io.emit("pipeline_error", { uploadEventId: event.id, reason: err.message });
      }
    });

  } catch (err) {
    console.error("[UPLOAD] Fatal error:", err);
    io.emit("pipeline_error", { reason: err.message });
    res.status(500).json({ error: err.message });
  }
});

// ── Retry route ───────────────────────────────────────────────────────────

router.patch("/chapter/:id/retry", async (req, res) => {
  try {
    const event = await prisma.uploadEvent.findUnique({
      where:   { id: req.params.id },
      include: { chapter: true },
    });
    if (!event) return res.status(404).json({ error: "Not found" });

    res.json({ success: true, status: "queued" });

    enqueue(async () => {
      const config    = getChapterConfig(event.day);
      const heroTagId = event.analysisRaw?.heroTagId || null;
      const heroTag   = HERO_TAGS.find(t => t.id === heroTagId) || defaultTagForDay(event.day);
      const analysis  = {
        tags:             event.tags,
        colours:          event.colours,
        descriptionLong:  event.analysisRaw?.descriptionLong  || null,
        descriptionShort: event.analysisRaw?.descriptionShort || null,
        heroTag,
      };

      const state  = await loadState();
      const output = await generateStoryOutput({ config, analysis, state });

      const nextState = applyUpdates(state, output.stateUpdates || {});
      if (output.chapter) nextState.lastChapter = output.chapter;
      await saveState(nextState).catch(e =>
        console.warn("[RETRY] State save failed:", e.message));

      await prisma.chapter.update({
        where: { uploadEventId: event.id },
        data:  { text: output.chapter, headline: output.headline },
      });

      const publicIds = extractPublicIds(
        { public_id: event.analysisRaw?.public_id },
        event.cutouts,
      );
      updateContext(publicIds, { chapter: output.chapter }).catch(e =>
        console.warn("[RETRY] Cloudinary context update failed:", e.message));

      io.emit("new_chapter", {
        day:           event.day,
        headline:      output.headline || config.headline,
        cloudinaryUrl: event.cloudinaryUrl,
        cutouts:       event.cutouts,
        analysis,
        chapterText:   output.chapter,
        uploadEventId: event.id,
        timestamp:     event.createdAt,
      });
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;