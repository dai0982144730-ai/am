-- Cho phép đề xuất "đổi thứ tự bài trong playlist" (reorder_items), và chỗ
-- lưu thứ tự Am muốn ghi thật lên YouTube.
--
-- Tay viết theo đúng cách CLAUDE.md dặn: `prisma migrate diff` trên máy này
-- còn lẫn ba việc KHÔNG liên quan (bỏ qua, không đưa vào file này):
--   - DROP INDEX cho ba chỉ mục có sẵn trên DB nhưng chưa khai trong schema
--     (Author_theoDoi_idx, ContentItem_commentRatio_idx,
--     ContentItem_likeRatio_idx)
--   - ADD COLUMN "vector" cho ContentEmbedding/NoteEmbedding — cột này cần
--     extension pgvector, máy này chưa cài, chạy sẽ lỗi ngay
--   - ALTER COLUMN DROP DEFAULT trên likeRatio/commentRatio — đụng vào cột
--     GENERATED STORED, không liên quan gì tới việc thêm reorder_items

-- AlterEnum
ALTER TYPE "SuggestionType" ADD VALUE 'reorder_items';

-- AlterTable
ALTER TABLE "PlaylistOrganizationSuggestion" ADD COLUMN "desiredOrder" JSONB;
