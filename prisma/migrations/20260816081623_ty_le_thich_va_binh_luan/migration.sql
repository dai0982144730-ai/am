-- Hai tỷ lệ tương tác, để sắp xếp theo "tỷ lệ thích cao" và "tỷ lệ bình luận cao".
--
-- ## Vì sao là CỘT SINH TỰ ĐỘNG chứ không phải cột thường
--
-- Prisma không sắp xếp được theo một phép chia. Ba cách khác đều tệ hơn:
--
--   - Đặt tỷ lệ trong bảng ContentScore: chỉ 314/1062 mục có bản ghi điểm,
--     trong khi 952 mục có đủ số thô. Mất hai phần ba dữ liệu.
--   - Cột thường rồi tự điền lúc quét: phải sửa mọi đường nạp dữ liệu, và chỉ
--     cần quên một chỗ là tỷ lệ lệch khỏi số thô mà không ai báo.
--   - Tính trong code rồi sắp xếp: hỏng phân trang.
--
-- Cột sinh tự động luôn khớp với số thô vì database tự tính lại mỗi khi lượt
-- xem hay lượt thích đổi. Không cần chạy bù, không thể lệch.
--
-- ## CẢNH BÁO cho lần sau
--
-- Hai cột này khai trong schema Prisma là `Float?` bình thường, vì Prisma
-- không có cách diễn đạt "cột sinh tự động". Hệ quả:
--
--   1. **Không bao giờ ghi vào chúng.** Prisma chỉ gửi những trường bạn truyền
--      vào, nên đọc và sắp xếp thì an toàn; ghi thì Postgres báo lỗi ngay.
--   2. `prisma migrate dev` sẽ định đổi chúng thành cột thường — đúng kiểu bẫy
--      như hai chỉ mục HNSW. Xem CLAUDE.md.

ALTER TABLE "ContentItem"
  ADD COLUMN "likeRatio" DOUBLE PRECISION
  GENERATED ALWAYS AS (
    CASE WHEN "viewOrPlayCount" > 0 AND "likeCount" IS NOT NULL
      THEN "likeCount"::double precision / "viewOrPlayCount"
    END
  ) STORED;

ALTER TABLE "ContentItem"
  ADD COLUMN "commentRatio" DOUBLE PRECISION
  GENERATED ALWAYS AS (
    CASE WHEN "viewOrPlayCount" > 0 AND "commentCount" IS NOT NULL
      THEN "commentCount"::double precision / "viewOrPlayCount"
    END
  ) STORED;

CREATE INDEX "ContentItem_likeRatio_idx" ON "ContentItem"("likeRatio");
CREATE INDEX "ContentItem_commentRatio_idx" ON "ContentItem"("commentRatio");
