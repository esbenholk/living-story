-- CreateTable
CREATE TABLE "StoryState" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "aliceTraits" TEXT[],
    "aliceExperiences" TEXT[],
    "aliceAppearance" TEXT,
    "villainTraits" TEXT[],
    "villainExperiences" TEXT[],
    "villainAppearance" TEXT,
    "villainName" TEXT,
    "npcs" JSONB NOT NULL DEFAULT '[]',
    "quests" JSONB NOT NULL DEFAULT '[]',
    "challenges" JSONB NOT NULL DEFAULT '[]',
    "beliefs" JSONB NOT NULL DEFAULT '[]',
    "threads" JSONB NOT NULL DEFAULT '[]',
    "grandArcDay" INTEGER NOT NULL DEFAULT 1,
    "chaptersWritten" INTEGER NOT NULL DEFAULT 0,
    "lastSummary" TEXT,

    CONSTRAINT "StoryState_pkey" PRIMARY KEY ("id")
);
