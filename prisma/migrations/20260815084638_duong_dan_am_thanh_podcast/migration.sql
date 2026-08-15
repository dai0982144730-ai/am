-- Chỗ chứa đường dẫn file âm thanh gốc của tập podcast.
ALTER TABLE "ContentItem" ADD COLUMN     "audioUrl" TEXT;

-- ĐÃ XOÁ hai lệnh `DROP INDEX ..._vector_idx` mà Prisma tự thêm vào đây.
-- Hai chỉ mục HNSW đó do pgvector quản lý, Prisma không biết chúng tồn tại nên
-- lần nào tạo migration cũng định xoá. Xem mục "Cạm bẫy" trong CLAUDE.md.
