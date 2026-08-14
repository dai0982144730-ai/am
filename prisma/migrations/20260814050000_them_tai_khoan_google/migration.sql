-- Bảng lưu token Google của chủ dự án, để gọi YouTube API thay mặt người dùng.
--
-- Migration này viết tay thay vì để `prisma migrate dev` sinh ra, vì lệnh đó
-- luôn kèm theo hai dòng DROP INDEX xoá mất chỉ mục HNSW của pgvector
-- (ContentEmbedding_vector_idx, NoteEmbedding_vector_idx) — Prisma không biết
-- hai chỉ mục đó tồn tại nên coi là thừa. Xem CLAUDE.md, mục "Cạm bẫy đã gặp".
--
-- Migration này CHỈ thêm một bảng mới, không đụng vào bảng nào đang có, nên chạy
-- bằng `npx prisma migrate deploy` là an toàn tuyệt đối.
--
-- Bảng cố ý chỉ giữ đúng MỘT dòng (id = 'chu_du_an') vì app dùng riêng cho một
-- người. Không dựng bộ bảng User/Account/Session của Auth.js.

CREATE TABLE "GoogleAccount" (
    "id" TEXT NOT NULL DEFAULT 'chu_du_an',
    "email" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "expiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoogleAccount_pkey" PRIMARY KEY ("id")
);
