-- Thêm lĩnh vực khoa học, để mục Khoa học có bộ lọc riêng như bốn mục kia.
--
-- VIẾT TAY, KHÔNG DÙNG `prisma migrate dev`. Lệnh đó dựng một database bóng
-- rồi diễn lại cả 14 migration từ đầu để dò sai lệch — mà database bóng cũng
-- không có pgvector, nên nó chết ngay ở bản `them_pgvector` với
-- "extension vector is not available". Lịch sử migration thật vẫn sạch:
-- 14 bản, 14 file, không bản nào lỗi.
--
-- Áp bằng: npx prisma migrate deploy

-- CreateEnum
CREATE TYPE "ScienceField" AS ENUM ('y_hoc_suc_khoe', 'vat_ly_vu_tru', 'sinh_hoc', 'vat_lieu_nang_luong', 'ky_thuat');

-- AlterTable
ALTER TABLE "ContentClassification" ADD COLUMN "scienceField" "ScienceField";
