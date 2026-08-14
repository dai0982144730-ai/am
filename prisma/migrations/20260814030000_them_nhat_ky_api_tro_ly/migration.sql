-- Bảng nhật ký cho Cổng API trợ lý (/api/v1/tro-ly/*)
--
-- Migration này viết tay thay vì để `prisma migrate dev` sinh ra, vì lệnh đó
-- luôn kèm theo hai dòng DROP INDEX xoá mất chỉ mục HNSW của pgvector
-- (ContentEmbedding_vector_idx, NoteEmbedding_vector_idx) — Prisma không biết
-- hai chỉ mục đó tồn tại nên coi là thừa. Xem CLAUDE.md, mục "Cạm bẫy đã gặp".
--
-- Migration này CHỈ thêm một bảng mới, không đụng vào bảng nào đang có, nên chạy
-- bằng `npx prisma migrate deploy` là an toàn tuyệt đối.

CREATE TABLE "AssistantApiLog" (
    "id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "tokenLabel" TEXT NOT NULL,
    "responseTimeMs" INTEGER NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "aiInputTokens" INTEGER,
    "aiOutputTokens" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssistantApiLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AssistantApiLog_createdAt_idx" ON "AssistantApiLog"("createdAt");

CREATE INDEX "AssistantApiLog_endpoint_createdAt_idx" ON "AssistantApiLog"("endpoint", "createdAt");
