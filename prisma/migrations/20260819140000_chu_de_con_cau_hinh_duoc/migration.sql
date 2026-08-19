-- Chủ đề con cấu hình được: đổi năm cột từ enum khoá cứng sang chữ tự do,
-- và thêm bảng `ChuDeCon` giữ danh sách chủ nhà tự đặt.
--
-- Viết tay theo đúng quy trình trong CLAUDE.md: `prisma migrate dev` sẽ định
-- xoá hai chỉ mục HNSW của pgvector mà nó không hiểu, nên không dùng nó.
--
-- `USING ... ::TEXT` giữ nguyên mọi giá trị đang có — nội dung đã phân loại
-- không mất chữ nào, chỉ đổi kiểu cột.

ALTER TABLE "ContentClassification"
  ALTER COLUMN "aiSubtopic" TYPE TEXT USING "aiSubtopic"::TEXT;
ALTER TABLE "ContentClassification"
  ALTER COLUMN "scienceField" TYPE TEXT USING "scienceField"::TEXT;
ALTER TABLE "ContentClassification"
  ALTER COLUMN "philosophySchool" TYPE TEXT USING "philosophySchool"::TEXT;
ALTER TABLE "ContentClassification"
  ALTER COLUMN "storyGenre" TYPE TEXT USING "storyGenre"::TEXT;
ALTER TABLE "ContentClassification"
  ALTER COLUMN "musicGenre" TYPE TEXT USING "musicGenre"::TEXT;

-- Năm kiểu enum cũ giờ không còn cột nào dùng tới. Xoá đi cho sạch, nhưng
-- CHỈ SAU khi đã đổi kiểu cột ở trên — làm ngược lại thì Postgres từ chối.
DROP TYPE IF EXISTS "AiSubtopic";
DROP TYPE IF EXISTS "ScienceField";
DROP TYPE IF EXISTS "PhilosophySchool";
DROP TYPE IF EXISTS "StoryGenre";
DROP TYPE IF EXISTS "MusicGenre";

CREATE TABLE "ChuDeCon" (
    "id" TEXT NOT NULL,
    "chuyenMuc" "ContentGroup" NOT NULL,
    "ma" TEXT NOT NULL,
    "ten" TEXT NOT NULL,
    "moTa" TEXT,
    "viTri" INTEGER NOT NULL DEFAULT 0,
    "bat" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChuDeCon_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ChuDeCon_chuyenMuc_ma_key" ON "ChuDeCon"("chuyenMuc", "ma");
CREATE INDEX "ChuDeCon_chuyenMuc_bat_viTri_idx" ON "ChuDeCon"("chuyenMuc", "bat", "viTri");
