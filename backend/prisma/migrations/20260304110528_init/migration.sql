-- CreateTable
CREATE TABLE "UploadEvent" (
    "id" TEXT NOT NULL,
    "day" INTEGER NOT NULL,
    "cloudinaryUrl" TEXT NOT NULL,
    "cutouts" JSONB NOT NULL,
    "tags" TEXT[],
    "colours" JSONB NOT NULL,
    "analysisRaw" JSONB NOT NULL,
    "uploaderName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UploadEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Chapter" (
    "id" TEXT NOT NULL,
    "day" INTEGER NOT NULL,
    "headline" TEXT NOT NULL,
    "text" TEXT,
    "uploadEventId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Chapter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Chapter_uploadEventId_key" ON "Chapter"("uploadEventId");

-- AddForeignKey
ALTER TABLE "Chapter" ADD CONSTRAINT "Chapter_uploadEventId_fkey" FOREIGN KEY ("uploadEventId") REFERENCES "UploadEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
