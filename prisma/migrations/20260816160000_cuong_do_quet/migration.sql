-- Cường độ quét đêm, phần trăm. 0 = đứng im, 100 = như hiện nay, 200 = gấp đôi.
--
-- Viết tay chứ không dùng `prisma migrate dev`: lệnh đó cần một shadow database
-- và ở máy này nó hỏng vì thiếu extension vector. Xem CLAUDE.md.
ALTER TABLE "UserAssistantSettings"
  ADD COLUMN "cuongDoQuet" INTEGER NOT NULL DEFAULT 100;
