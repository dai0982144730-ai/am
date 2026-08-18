-- Video chỉ có mặt để xem được bên trong playlist, không thuộc kho tuyển chọn.
--
-- Viết tay theo đúng quy trình trong CLAUDE.md: `prisma migrate dev` sẽ định
-- xoá hai chỉ mục HNSW của pgvector mà nó không hiểu, nên không dùng nó.
ALTER TABLE "ContentItem" ADD COLUMN "chiTrongPlaylist" BOOLEAN NOT NULL DEFAULT false;
