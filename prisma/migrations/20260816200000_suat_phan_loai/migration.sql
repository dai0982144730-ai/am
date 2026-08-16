-- Suất phân loại chia theo chuyên mục và theo loại nguồn, cùng đơn đặt hàng
-- cho chuyên mục Ngẫu hứng. Chủ dự án chốt 2026-08-16.
ALTER TABLE "UserAssistantSettings"
  ADD COLUMN "suatChuyenMuc" JSONB,
  ADD COLUMN "tyLeNguon"     JSONB;

ALTER TABLE "AdHocInterest"
  ADD COLUMN "yeuCau"   TEXT,
  ADD COLUMN "chuDeCon" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
