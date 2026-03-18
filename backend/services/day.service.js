import { CHAPTER_CONFIG } from '../config/chapters.js';

export function getCurrentDay() {
  const start = new Date(process.env.STORY_START_DATE);
  const raw = Math.floor((Date.now() - start.getTime()) / 86_400_000);
  return Math.min(Math.max(raw, 0), 7) + 1;
}

export function getChapterConfig(day) {
  return CHAPTER_CONFIG[day - 1];
}
