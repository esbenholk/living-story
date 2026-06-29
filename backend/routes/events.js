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

<<<<<<< HEAD

  
  const mapped = events.map(ev => ({
=======
  console.log(events);

  const mapped = events.map((ev) => ({
>>>>>>> 08cb33e8c9845689f58f489c86cf14f9a0f05301
    ...ev,
    heroTagId: ev.analysisRaw?.heroTagId || null,
    descriptionShort: ev.analysisRaw?.descriptionShort || null,
    descriptionLong: ev.analysisRaw?.descriptionLong || null,
  }));

  res.json({
    events: mapped,
    currentDay: day,
    currentConfig: { day, headline: config.headline, tone: config.tone },
    hasStarted: hasStoryStarted(), // <-- add (import it at top)
    startDate: process.env.STORY_START_DATE, // <-- add
  });
});

export function hasStoryStarted() {
  const start = new Date(process.env.STORY_START_DATE);
  return Date.now() >= start.getTime();
}

export default router;
