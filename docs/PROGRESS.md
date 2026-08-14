# Nhật ký tiến độ

> Cập nhật cuối mỗi phiên làm việc. Máy còn lại dựa vào file này để biết đang ở đâu.

## Đang ở đâu

**Phase 0 — Nền tảng: XONG.**

Khung Next.js 16 + Tailwind 4, Prisma 7, database Neon đã chạy thật với 36 bảng,
pgvector đã bật, logic chấm điểm chất lượng đã viết. `npm run dev` lên được trang.

## Việc kế tiếp — Phase 1

1. Đăng nhập Google + xin quyền YouTube
2. Nhập **kênh đã đăng ký, video đã thích, playlist hiện có** → `YouTubeAccountSignal`
   (đây là cách dựng gu ngay từ ngày đầu, vì lịch sử xem thì Google không cho lấy)
3. Client gọi YouTube Data API kèm đếm quota (`QuotaUsageLog`)
4. Lấy lời thoại video + phân loại bằng Claude

## Hạng mục mới — Cổng API trợ lý (Phase 15)

Chủ dự án có kế hoạch xây app Android hỏi được cả 3 trang (`am`, `tiendo`,
`phaply`) qua Claude API, sau khi `am` xong. **Chính phiên Claude Code này sẽ
là người viết tiếp app Android đó** — ghi lại ở đây để phiên sau (kể cả phiên
viết app Android) biết bối cảnh.

Yêu cầu gốc: `docs/yeu-cau-cong-api-tro-ly.md`. Rà soát + quyết định áp dụng
cho `am`: `docs/plan.md` mục "Cổng API trợ lý — chuẩn bị cho app Android".

Tóm tắt đã chốt trong buổi rà soát 2026-08-14:
- Data model hiện tại (`Source`/`ContentItem` tổng quát hoá từ Phase 0) khớp
  tốt với khung `ketQua[]` yêu cầu — không cần sửa schema.
- **Không** đổi tên 36 bảng Prisma sang tiếng Việt không dấu (rủi ro cao,
  không lợi gì cho app Android). Quy ước tiếng Việt không dấu chỉ áp dụng ở
  tầng mới: route `app/api/v1/tro-ly/`, hàm trong `lib/nghiepVu/`, tên
  trường JSON trả ra — lớp này dịch từ tên tiếng Anh nội bộ sang JSON tiếng
  Việt không dấu.
- Chưa khảo sát được `tiendo`/`phaply` — repo chưa kết nối vào phiên này.

**3 câu hỏi mở, cần chủ dự án trả lời trước khi bắt đầu code Phase 15**
(chi tiết trong `docs/plan.md`):
1. Repo `tiendo`/`phaply` ở đâu — cho phép khảo sát thật hay chưa tồn tại?
2. Trang nào làm mẫu trước — `am` có schema tốt nhất nhưng chưa có dữ liệu
   thật (Phase 1 ingestion chưa chạy); nếu `phaply`/`tiendo` đã có dữ liệu
   thì làm mẫu ở đó dễ kiểm chứng hơn.
3. Ba repo có gộp monorepo được không, hay hoàn toàn độc lập — quyết định
   cách tổ chức gói dùng chung (`lib/nghiepVu` types, `xacThucTokenTroLy`,
   `chuanHoaDeDoc`).

Các endpoint đọc (`suc-khoe`, `cong-cu`, `tim-kiem`, `noi-dung/{id}`) của
riêng `am` **không cần chờ trả lời 3 câu trên mới bắt đầu** — dựng được ngay
với dữ liệu Phase 1 khi có, xem chi tiết phụ thuộc trong `docs/plan.md`.

## Cần chủ dự án chuẩn bị

| Việc | Trạng thái | Ghi chú |
|---|---|---|
| Database trên [Neon](https://neon.tech) | ✅ xong | Đã kết nối, đã tạo bảng |
| Khoá Anthropic API | ⬜ chưa | [console.anthropic.com](https://console.anthropic.com) → API Keys |
| Khoá YouTube Data API v3 | ⬜ chưa | [console.cloud.google.com](https://console.cloud.google.com) → bật YouTube Data API v3 |
| Google OAuth (đăng nhập) | ⬜ chưa | Cùng trang trên → Credentials → OAuth client ID. **Cần cho Phase 1** |
| Whitelist tác giả/nguồn ban đầu | ⬜ chưa | Tác giả truyện, giảng sư, blog AI uy tín bạn đã biết |
| Trả lời 3 câu hỏi mở về Cổng API trợ lý | ⬜ chưa | Xem mục "Hạng mục mới" ở trên |
| Cấp quyền cho GitHub App xem repo `tiendo`/`phaply` (nếu đã tồn tại) | ⬜ chưa | Cần để khảo sát và đồng bộ chuẩn API |

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

**Kết nối database + chốt cách dùng tài khoản YouTube**
- Neon đã kết nối, chạy migration thật: 36 bảng, pgvector đã bật, cột vector 1024
  chiều + chỉ mục HNSW cho `ContentEmbedding` và `NoteEmbedding`
- `scripts/check-db.ts` — kiểm tra nhanh tình trạng database
- Chốt phạm vi dùng tài khoản YouTube: **lịch sử xem và "Xem sau" không lấy được**
  (Google chặn từ 2016). Thay bằng nhập kênh đã đăng ký + video đã thích + playlist
  hiện có (`YouTubeAccountSignal`) để dựng gu ban đầu, còn lịch sử xem thì app tự ghi
- Chốt quyền ghi playlist: thêm/tạo **tự động**, di chuyển/gỡ **chờ duyệt**,
  xoá cả playlist thì **không bao giờ**

**Ghi chú kỹ thuật**
- Prisma 7 bỏ `url` trong `datasource` — chuỗi kết nối chuyển sang
  `prisma.config.ts`, và `PrismaClient` cần driver adapter (`@prisma/adapter-pg`)
- Neon cho hai địa chỉ: bản `-pooler` dùng khi chạy app, bản không `-pooler`
  dùng khi tạo/sửa bảng. `prisma.config.ts` ưu tiên `DIRECT_URL`
- `src/generated/` là code Prisma tự sinh, không đưa lên Git. Script
  `postinstall` tự chạy `prisma generate` nên máy mới clone về chỉ cần
  `npm install`
- `.claude/launch.json` trỏ tới dự án này; nếu mở Claude Code ở thư mục cha
  (`D:\CLAUDE\CODE\QLDA`) thì preview sẽ chạy nhầm sang `qlda-web`

**Cạm bẫy đã vấp — Prisma xoá thứ nó không hiểu**

Cột `vector` ban đầu thêm bằng SQL thủ công, không khai báo trong schema. Lần
`migrate dev` sau đó Prisma coi nó là thừa và **xoá mất**. Đã sửa bằng cách khai
báo `Unsupported("vector(1024)")` trong schema.

Hai chỉ mục HNSW thì vẫn chưa có cách khai báo — mỗi lần `migrate dev` Prisma vẫn
định xoá. Quy trình an toàn khi tạo migration mới: `--create-only` → mở file SQL
xoá các dòng `DROP INDEX ..._vector_idx` → `migrate deploy`. Đã ghi rõ trong
`CLAUDE.md`.

### 2026-08-14 — Văn phòng

**Chuẩn bị máy mới**
- Clone + cài đặt xong trên PC văn phòng (nằm ở `C:\Users\Admin\am`, không
  phải `D:\CLAUDE\CODE\am` như dự tính — `cd` sang ổ khác trên `cmd.exe` cần
  `/d`, và `move` thư mục bị chặn bởi antivirus/quyền ổ D nên giữ nguyên chỗ
  đã clone). `.env` đã điền `DATABASE_URL`/`DIRECT_URL` lấy lại từ Neon,
  `npm run dev` chạy đúng, kết nối database thành công.

**Rà soát yêu cầu "Cổng API trợ lý"**
- Nhận tài liệu yêu cầu xây API cho app Android hỏi được cả 3 trang
  (`am`/`tiendo`/`phaply`) sau này — lưu nguyên văn vào
  `docs/yeu-cau-cong-api-tro-ly.md`.
- Rà soát code Phase 0 hiện tại so với yêu cầu: data model phù hợp tốt,
  chưa có gì ở tầng API/`lib/nghiepVu`/gọi Claude — xem chi tiết ở
  `docs/plan.md` mục "Cổng API trợ lý" và mục "Hạng mục mới" phía trên.
- Quyết định: giữ nguyên schema Prisma tiếng Anh, chỉ áp dụng quy ước tiếng
  Việt không dấu cho tầng route/`lib/nghiepVu`/JSON mới viết.
- Còn 3 câu hỏi mở cần chủ dự án trả lời trước khi bắt đầu code (xem mục
  "Hạng mục mới — Cổng API trợ lý" phía trên), chủ yếu do chưa khảo sát được
  `tiendo`/`phaply`.
- Ghi nhận: sau khi `am` xong toàn bộ, chính phiên Claude Code này tiếp tục
  viết app Android — không phải giao việc khác.
