import express from "express";
import { prisma } from "../lib/prisma.js";
import { getCurrentDay, getChapterConfig } from "../services/day.service.js";

const router = express.Router();

router.get("/events", async (req, res) => {
  const day = getCurrentDay();
  const config = getChapterConfig(day);

  const events = await prisma.uploadEvent.findMany({
    orderBy: { createdAt: "asc" },
    include: { chapter: true },
  });

  res.json({
    events,
    currentDay: day,
    currentConfig: {
      day,
      headline: config.headline,
      tone: config.tone,
    },
  });
});

export default router;
