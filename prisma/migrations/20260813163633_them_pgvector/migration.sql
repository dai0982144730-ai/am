-- Bật pgvector để tìm kiếm theo ngữ nghĩa
-- ("tôi từng xem gì về X chưa?" — tìm theo ý nghĩa chứ không phải từ khoá)
CREATE EXTENSION IF NOT EXISTS vector;

-- Prisma chưa hỗ trợ kiểu vector nên thêm cột bằng SQL.
-- 1024 chiều — khớp với model voyage-3 của Voyage AI.
ALTER TABLE "ContentEmbedding" ADD COLUMN IF NOT EXISTS "vector" vector(1024);
ALTER TABLE "NoteEmbedding"    ADD COLUMN IF NOT EXISTS "vector" vector(1024);

-- Chỉ mục HNSW để tìm hàng xóm gần nhất mà không phải quét toàn bảng.
-- vector_cosine_ops: đo độ giống nhau bằng góc giữa hai vector — đúng chuẩn
-- cho embedding văn bản.
CREATE INDEX IF NOT EXISTS "ContentEmbedding_vector_idx"
  ON "ContentEmbedding" USING hnsw ("vector" vector_cosine_ops);

CREATE INDEX IF NOT EXISTS "NoteEmbedding_vector_idx"
  ON "NoteEmbedding" USING hnsw ("vector" vector_cosine_ops);
