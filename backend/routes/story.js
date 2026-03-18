import express from 'express';
import { prisma } from '../lib/prisma.js';

const router = express.Router();

router.get('/story', async (req, res) => {
  const chapters = await prisma.chapter.findMany({
    orderBy: { createdAt: 'asc' },
    include: {
      uploadEvent: { select: { cloudinaryUrl: true, cutouts: true, tags: true } },
    },
  });
  res.json(chapters);
});

export default router;
