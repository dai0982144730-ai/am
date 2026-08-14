-- AlterEnum
ALTER TYPE "ContentGroup" ADD VALUE 'khoa_hoc';

-- (Đã xoá tay hai lệnh DROP INDEX mà Prisma tự thêm vào đây.)
--
-- Hai chỉ mục HNSW cho tìm kiếm ngữ nghĩa do pgvector quản lý, Prisma không
-- biết chúng tồn tại nên lần nào tạo migration nó cũng định xoá đi. Xem mục
-- "Cạm bẫy đã gặp" trong CLAUDE.md.

-- CreateTable
CREATE TABLE "WatchHistory" (
    "id" TEXT NOT NULL,
    "contentItemId" TEXT NOT NULL,
    "firstOpenedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastOpenedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "openCount" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "WatchHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WatchHistory_contentItemId_key" ON "WatchHistory"("contentItemId");

-- CreateIndex
CREATE INDEX "WatchHistory_lastOpenedAt_idx" ON "WatchHistory"("lastOpenedAt");

-- AddForeignKey
ALTER TABLE "WatchHistory" ADD CONSTRAINT "WatchHistory_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "ContentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
