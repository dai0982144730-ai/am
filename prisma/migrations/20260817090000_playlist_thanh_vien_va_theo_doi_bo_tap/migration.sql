-- CreateEnum
CREATE TYPE "TrangThaiBoTap" AS ENUM ('dang_do', 'dang_theo', 'da_loai', 'het_tap_moi');

-- CreateEnum
CREATE TYPE "PlaylistItemAddedBy" AS ENUM ('user', 'ai');

-- AlterEnum
ALTER TYPE "PlaylistActionType" ADD VALUE 'delete_playlist';
ALTER TYPE "PlaylistActionType" ADD VALUE 'rename_playlist';

-- AlterEnum
ALTER TYPE "SuggestionType" ADD VALUE 'remove_item';
ALTER TYPE "SuggestionType" ADD VALUE 'delete_playlist';
ALTER TYPE "SuggestionType" ADD VALUE 'rename_playlist';

-- AlterTable
ALTER TABLE "PlaylistOrganizationSuggestion" ALTER COLUMN "contentItemId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "YouTubePlaylist" ADD COLUMN     "deletionRequestedAt" TIMESTAMP(3),
ADD COLUMN     "lastSyncedVideoIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "youtubePlaylistId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "TheoDoiBoTap" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "khoaChuoi" TEXT NOT NULL,
    "tenHienThi" TEXT NOT NULL,
    "trangThai" "TrangThaiBoTap" NOT NULL DEFAULT 'dang_do',
    "tapCaoNhatDaTha" INTEGER NOT NULL DEFAULT 0,
    "thaLanCuoiLuc" TIMESTAMP(3),
    "soTapThaHomNay" INTEGER NOT NULL DEFAULT 0,
    "lyDoLoai" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TheoDoiBoTap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TapCuaBo" (
    "id" TEXT NOT NULL,
    "boId" TEXT NOT NULL,
    "contentItemId" TEXT NOT NULL,
    "soTap" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TapCuaBo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlaylistItem" (
    "id" TEXT NOT NULL,
    "playlistId" TEXT NOT NULL,
    "contentItemId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "addedBy" "PlaylistItemAddedBy" NOT NULL DEFAULT 'user',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlaylistItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TheoDoiBoTap_trangThai_idx" ON "TheoDoiBoTap"("trangThai");

-- CreateIndex
CREATE UNIQUE INDEX "TheoDoiBoTap_sourceId_khoaChuoi_key" ON "TheoDoiBoTap"("sourceId", "khoaChuoi");

-- CreateIndex
CREATE UNIQUE INDEX "TapCuaBo_contentItemId_key" ON "TapCuaBo"("contentItemId");

-- CreateIndex
CREATE INDEX "TapCuaBo_boId_soTap_idx" ON "TapCuaBo"("boId", "soTap");

-- CreateIndex
CREATE INDEX "PlaylistItem_playlistId_position_idx" ON "PlaylistItem"("playlistId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "PlaylistItem_playlistId_contentItemId_key" ON "PlaylistItem"("playlistId", "contentItemId");

-- AddForeignKey
ALTER TABLE "TheoDoiBoTap" ADD CONSTRAINT "TheoDoiBoTap_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TapCuaBo" ADD CONSTRAINT "TapCuaBo_boId_fkey" FOREIGN KEY ("boId") REFERENCES "TheoDoiBoTap"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TapCuaBo" ADD CONSTRAINT "TapCuaBo_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "ContentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaylistItem" ADD CONSTRAINT "PlaylistItem_playlistId_fkey" FOREIGN KEY ("playlistId") REFERENCES "YouTubePlaylist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaylistItem" ADD CONSTRAINT "PlaylistItem_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "ContentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
