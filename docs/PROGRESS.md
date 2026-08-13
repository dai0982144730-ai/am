# Nhật ký tiến độ

> Cập nhật cuối mỗi phiên làm việc. Máy còn lại dựa vào file này để biết đang ở đâu.

## Đang ở đâu

**Phase 0 — Nền tảng: xong phần code.** Còn chờ database mới chạy migration được.

Đã có: khung Next.js 16 + Tailwind 4, Prisma 7 với đầy đủ cấu trúc dữ liệu
(~30 bảng), logic chấm điểm chất lượng, trang chủ tạm hiển thị tiến độ.
Chạy `npm run dev` là lên được.

## Việc kế tiếp

1. **Tạo database trên Neon** rồi dán `DATABASE_URL` vào `.env` ← đang vướng ở đây
2. Chạy `npm run db:migrate` để tạo bảng thật
3. Bật pgvector và thêm cột vector cho `ContentEmbedding` / `NoteEmbedding`
   (Prisma chưa hỗ trợ kiểu vector nên phải thêm bằng SQL trong migration)
4. Sang Phase 1: quét YouTube — client gọi API kèm đếm quota, lấy lời thoại,
   phân loại bằng Claude

## Cần chủ dự án chuẩn bị

| Việc | Trạng thái | Ghi chú |
|---|---|---|
| Database trên [Neon](https://neon.tech) | ⬜ chưa | Miễn phí, đăng ký bằng Google. **Cần trước khi làm tiếp** |
| Khoá Anthropic API | ⬜ chưa | [console.anthropic.com](https://console.anthropic.com) → API Keys |
| Khoá YouTube Data API v3 | ⬜ chưa | [console.cloud.google.com](https://console.cloud.google.com) → bật YouTube Data API v3 |
| Google OAuth (đăng nhập) | ⬜ chưa | Cùng trang trên → Credentials → OAuth client ID |
| Whitelist tác giả/nguồn ban đầu | ⬜ chưa | Tác giả truyện, giảng sư, blog AI uy tín bạn đã biết |

## Chạy trên máy mới

```bash
git clone https://github.com/dai0982144730-ai/am.git
cd am
npm install            # tự chạy prisma generate
cp .env.example .env   # rồi điền các khoá
npm run dev
```

---

## Lịch sử

### 2026-08-13 — PC ở nhà

**Chuẩn bị**
- Tạo repo, đẩy lên GitHub: https://github.com/dai0982144730-ai/am
- Chốt bản thiết kế trong `docs/plan.md`: 5 chuyên mục (AI, Triết học, Truyện,
  Music, New), cách chấm chất lượng riêng cho từng loại nguồn, lộ trình 15 phase
- Demo giao diện `docs/demo-ui.html` (desktop + mobile, bám theo YouTube)

**Phase 0**
- Dựng khung Next.js 16.3 + TypeScript + Tailwind 4 (App Router, thư mục `src/`)
- Cài Prisma 7.9, Anthropic SDK, Zod 4, Auth.js v5
- Viết `prisma/schema.prisma` — toàn bộ cấu trúc dữ liệu theo bản thiết kế:
  lõi nội dung, 4 trụ chấm điểm, ghi chú & wiki cá nhân, playlist YouTube,
  trợ lý chủ động, vận hành
- `src/lib/scoring/normalize.ts` — chuẩn hoá percentile theo từng loại nguồn,
  bốn trụ tín hiệu, trọng số mặc định cho 5 loại nguồn
- `src/lib/db/prisma.ts` — kết nối database, dùng lại kết nối khi phát triển
- Trang chủ tạm hiển thị tiến độ các phase
- Đã kiểm tra: `npx prisma validate` hợp lệ, `next build` thành công,
  `npm run dev` trả về trang đúng

**Ghi chú kỹ thuật**
- Prisma 7 bỏ `url` trong `datasource` — chuỗi kết nối chuyển sang
  `prisma.config.ts`, và `PrismaClient` cần driver adapter (`@prisma/adapter-pg`)
- `src/generated/` là code Prisma tự sinh, không đưa lên Git. Script
  `postinstall` tự chạy `prisma generate` nên máy mới clone về chỉ cần
  `npm install`
- `.claude/launch.json` trỏ tới dự án này; nếu mở Claude Code ở thư mục cha
  (`D:\CLAUDE\CODE\QLDA`) thì preview sẽ chạy nhầm sang `qlda-web`
