-- Cột vector giờ đã được khai báo trong schema.prisma bằng Unsupported(),
-- nên Prisma biết nó tồn tại và sẽ không xoá đi trong các lần migrate sau.
ALTER TABLE "ContentEmbedding" ADD COLUMN "vector" vector(1024);
ALTER TABLE "NoteEmbedding"    ADD COLUMN "vector" vector(1024);

-- Chỉ mục HNSW để tìm hàng xóm gần nhất mà không phải quét toàn bảng.
-- vector_cosine_ops: đo độ giống nhau bằng góc giữa hai vector — đúng chuẩn
-- cho embedding văn bản.
--
-- Prisma không quản lý được loại chỉ mục này nên nó không xuất hiện trong
-- schema.prisma. Nếu sau này chạy "migrate dev" mà thấy Prisma định xoá,
-- hãy sửa lại file migration đó thay vì để nó xoá.
CREATE INDEX "ContentEmbedding_vector_idx"
  ON "ContentEmbedding" USING hnsw ("vector" vector_cosine_ops);

CREATE INDEX "NoteEmbedding_vector_idx"
  ON "NoteEmbedding" USING hnsw ("vector" vector_cosine_ops);
