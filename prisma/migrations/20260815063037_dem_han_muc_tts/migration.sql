-- (Da go tay hai lenh DROP INDEX Prisma tu them -- chi muc HNSW.)

-- CreateTable
CREATE TABLE "TtsUsage" (
    "id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "charactersUsed" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "lastCallAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TtsUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TtsUsage_month_key" ON "TtsUsage"("month");
