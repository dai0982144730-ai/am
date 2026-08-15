-- (Da go tay hai lenh DROP INDEX Prisma tu them -- chi muc HNSW.)

-- AlterTable
ALTER TABLE "UserAssistantSettings" ADD COLUMN     "ttsSpeed" DOUBLE PRECISION NOT NULL DEFAULT 1.0;
