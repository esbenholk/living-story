import { prisma } from '../lib/prisma.js';

export async function assembleStory() {
  const chapters = await prisma.chapter.findMany({
    where: { text: { not: null } },
    orderBy: { createdAt: 'asc' },
  });

  return chapters
    .map(c => `## ${c.headline}\n${c.text}`)
    .join('\n\n');
}
