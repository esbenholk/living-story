import express from "express";
import multer from "multer";
import { io } from "../server.js";
import { getCutouts } from "../services/cutout.service.js";
import {
  describeImageShort,
  describeImageLong,
  generateChapter,
  generateStoryOutput,
} from "../services/llm.service.js";
import { assembleStory } from "../services/story.service.js";
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
  { name: "image", maxCount: 1 },
  { name: "left_eye", maxCount: 1 },
  { name: "right_eye", maxCount: 1 },
  { name: "mouth", maxCount: 1 },
]);

router.post("/upload", upload, async (req, res) => {
  try {
    io.emit("pipeline_start");

    const day = getCurrentDay();
    const config = getChapterConfig(day);
    const uploaderName = req.body.uploaderName || null;

    // Resolve hero tag — use what the user picked, fall back to day default
    const heroTagId = req.body.heroTagId || null;
    const heroTag =
      HERO_TAGS.find((t) => t.id === heroTagId) || defaultTagForDay(day);
    console.log(
      `[UPLOAD] heroTag: ${heroTag.id} (${heroTag.label}), day: ${day}`,
    );

    const imageFile = req.files?.image?.[0];
    if (!imageFile) return res.status(400).json({ error: "image required" });

    const faceCropFiles = {
      left_eye: req.files?.left_eye?.[0] ?? null,
      right_eye: req.files?.right_eye?.[0] ?? null,
      mouth: req.files?.mouth?.[0] ?? null,
    };

    // 1. Upload original to Cloudinary
    const filename = `upload_${Date.now()}`;
    const cloudResult = await uploadImage(imageFile.buffer, filename);
    const { secure_url, colors } = cloudResult;
    const tags = (cloudResult.tags || []).map((t) => t.tag || t).slice(0, 10);
    const colours =
      colors?.predominant?.google || colors?.predominant?.cloudinary || [];

    // 2. Sidecar: subject cutout + face crop uploads
    let cutouts = {};
    try {
      cutouts = await getCutouts(
        secure_url,
        { day, uploaderName: uploaderName || "" },
        faceCropFiles,
      );
    } catch (e) {
      console.warn("[UPLOAD] Cutout sidecar unavailable:", e.message);
      cutouts = { subject: null };
    }

    // 3. LLaVA descriptions — run in parallel (both hit the same model sequentially
    //    inside Ollama, but the fetch overhead overlaps)
    let descriptionShort = null;
    let descriptionLong = null;
    try {
      [descriptionShort, descriptionLong] = await Promise.all([
        describeImageShort(secure_url).catch(() => null),
        describeImageLong(secure_url).catch(() => null),
      ]);
    } catch (e) {
      console.warn("[UPLOAD] LLaVA descriptions failed:", e.message);
    }

    // 4. Generate chapter — pass heroTag so the prompt can use it
    const storySoFar = await assembleStory();
    const analysis = {
      tags,
      colours,
      descriptionShort,
      descriptionLong,
      heroTag,
    };

    let chapterText = null;
    let headlineText = null;
    let llmFailed = false;
    try {
      const output = await generateStoryOutput({
        config,
        storySoFar,
        analysis,
      });
      chapterText = output.chapter;
      headlineText = output.headline;

      console.log("invention", chapterText, headlineText);
    } catch (e) {
      console.warn("[UPLOAD] LLM generation unavailable:", e.message);
      llmFailed = true;
    }

    // 5. Back-fill metadata into Cloudinary
    const publicIds = extractPublicIds(cloudResult, cutouts);
    updateContext(publicIds, {
      description_short: descriptionShort || "",
      description_long: descriptionLong || "",
      chapter: chapterText || "",
      headline: headlineText ? headlineText : config.headline,
      day: String(day),
      uploader: uploaderName || "",
      hero_tag: heroTag.id,
    }).catch((e) =>
      console.warn("[UPLOAD] Cloudinary context update failed:", e.message),
    );

    // 6. Save to DB
    const event = await prisma.uploadEvent.create({
      data: {
        day,
        cloudinaryUrl: secure_url,
        cutouts,
        tags,
        colours,
        analysisRaw: {
          ...cloudResult,
          descriptionShort,
          descriptionLong,
          heroTagId: heroTag.id,
        },
        uploaderName,
        chapter: {
          create: {
            day,
            headline: headlineText ? headlineText : config.headline,
            text: chapterText,
          },
        },
      },
      include: { chapter: true },
    });

    // 7. Broadcast
    const payload = {
      day,
      headline: headlineText ? headlineText : config.headline,
      cloudinaryUrl: secure_url,
      cutouts,
      analysis: { tags, colours, descriptionShort, descriptionLong, heroTag },
      chapterText,
      uploadEventId: event.id,
      uploaderName: event.uploaderName,
      timestamp: event.createdAt,
    };

    if (llmFailed) {
      io.emit("pipeline_error", {
        uploadEventId: event.id,
        reason: "LLM_UNAVAILABLE",
      });
    } else {
      io.emit("new_chapter", payload);
    }

    res.json({
      success: true,
      eventId: event.id,
      llmFailed,
      cutouts,
      descriptionShort,
    });
  } catch (err) {
    console.error("[UPLOAD] Pipeline error:", err);
    io.emit("pipeline_error", { reason: err.message });
    res.status(500).json({ error: err.message });
  }
});

router.patch("/chapter/:id/retry", async (req, res) => {
  try {
    const event = await prisma.uploadEvent.findUnique({
      where: { id: req.params.id },
      include: { chapter: true },
    });
    if (!event) return res.status(404).json({ error: "Not found" });

    const config = getChapterConfig(event.day);
    const storySoFar = await assembleStory();
    const heroTagId = event.analysisRaw?.heroTagId || null;
    const heroTag =
      HERO_TAGS.find((t) => t.id === heroTagId) || defaultTagForDay(event.day);
    const analysis = {
      tags: event.tags,
      colours: event.colours,
      descriptionLong:
        event.analysisRaw?.descriptionLong ||
        event.analysisRaw?.description ||
        null,
      descriptionShort: event.analysisRaw?.descriptionShort || null,
      heroTag,
    };

    const chapterText = await generateChapter({ config, storySoFar, analysis });

    await prisma.chapter.update({
      where: { uploadEventId: event.id },
      data: { text: chapterText },
    });

    const publicIds = extractPublicIds(
      { public_id: event.analysisRaw?.public_id },
      event.cutouts,
    );
    updateContext(publicIds, { chapter: chapterText }).catch((e) =>
      console.warn("[RETRY] Cloudinary context update failed:", e.message),
    );

    io.emit("new_chapter", {
      day: event.day,
      headline: config.headline,
      cloudinaryUrl: event.cloudinaryUrl,
      cutouts: event.cutouts,
      analysis,
      chapterText,
      uploadEventId: event.id,
      timestamp: event.createdAt,
    });

    res.json({ success: true, chapterText });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
