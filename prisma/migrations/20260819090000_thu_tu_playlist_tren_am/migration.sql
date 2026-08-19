-- Thứ tự chủ nhà tự kéo-thả giữa các playlist, chỉ sống trên Am.
--
-- Viết tay theo đúng quy trình trong CLAUDE.md: `prisma migrate dev` sẽ định
-- xoá hai chỉ mục HNSW của pgvector mà nó không hiểu, nên không dùng nó.
ALTER TABLE "YouTubePlaylist" ADD COLUMN "viTri" INTEGER;
