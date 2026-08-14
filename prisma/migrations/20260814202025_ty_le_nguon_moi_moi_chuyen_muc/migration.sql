-- (Đã xoá tay hai lệnh DROP INDEX Prisma tự thêm — chỉ mục HNSW của pgvector,
-- xem "Cạm bẫy đã gặp" trong CLAUDE.md.)

-- CreateTable
CREATE TABLE "CategoryDiscoverySetting" (
    "id" TEXT NOT NULL,
    "contentGroup" "ContentGroup" NOT NULL,
    "newSourceRatio" INTEGER NOT NULL DEFAULT 30,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CategoryDiscoverySetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CategoryDiscoverySetting_contentGroup_key" ON "CategoryDiscoverySetting"("contentGroup");
