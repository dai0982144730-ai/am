/*
  Warnings:

  - You are about to drop the column `vector` on the `ContentEmbedding` table. All the data in the column will be lost.
  - You are about to drop the column `vector` on the `NoteEmbedding` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "YouTubeAccountSignalType" AS ENUM ('subscription', 'liked_video', 'playlist_member');

-- AlterEnum
ALTER TYPE "PlaylistActionType" ADD VALUE 'remove_item';

-- DropIndex
DROP INDEX "ContentEmbedding_vector_idx";

-- DropIndex
DROP INDEX "NoteEmbedding_vector_idx";

-- AlterTable
ALTER TABLE "ContentEmbedding" DROP COLUMN "vector";

-- AlterTable
ALTER TABLE "NoteEmbedding" DROP COLUMN "vector";

-- CreateTable
CREATE TABLE "YouTubeAccountSignal" (
    "id" TEXT NOT NULL,
    "signalType" "YouTubeAccountSignalType" NOT NULL,
    "externalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "channelTitle" TEXT,
    "mappedContentItemId" TEXT,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "YouTubeAccountSignal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "YouTubeAccountSignal_signalType_idx" ON "YouTubeAccountSignal"("signalType");

-- CreateIndex
CREATE UNIQUE INDEX "YouTubeAccountSignal_signalType_externalId_key" ON "YouTubeAccountSignal"("signalType", "externalId");
