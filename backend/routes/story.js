import express from 'express';
import { prisma } from '../lib/prisma.js';

const router = express.Router();

router.get('/story', async (req, res) => {
  const chapters = await prisma.chapter.findMany({
    orderBy: { createdAt: 'asc' },
    include: {
      uploadEvent: { select: { cloudinaryUrl: true, cutouts: true, tags: true, analysisRaw: true,  } },
    },
  });
  res.json(chapters);
});


router.get('/reset-chat', async (req, res) => {
  const { loadState, saveState } = await import('../services/story.state.service.js');
  const state = await loadState();
  state.chatHistory = [];
  await saveState(state);
  res.json({ ok: true, message: 'Chat history cleared' });
});

export default router;
