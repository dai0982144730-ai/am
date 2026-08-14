-- (Đã gỡ tay hai lệnh DROP INDEX Prisma tự thêm — chỉ mục HNSW.)

-- AlterTable
ALTER TABLE "ContentClassification" ADD COLUMN     "contentQualityScore" DOUBLE PRECISION;
