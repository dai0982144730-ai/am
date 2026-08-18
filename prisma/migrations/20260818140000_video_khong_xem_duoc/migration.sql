-- Video YouTube không còn cho xem (đã xoá hoặc chuyển sang riêng tư).
--
-- Viết tay theo đúng quy trình trong CLAUDE.md: `prisma migrate dev` sẽ định
-- xoá hai chỉ mục HNSW của pgvector mà nó không hiểu, nên không dùng nó.
ALTER TABLE "ContentItem" ADD COLUMN "khongXemDuoc" BOOLEAN NOT NULL DEFAULT false;
