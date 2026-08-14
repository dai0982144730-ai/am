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

## Phase 15 — Cổng API trợ lý: XONG (phần của `am`)

Sáu endpoint dưới `/api/v1/tro-ly/` đã viết xong, build sạch, đã thử chạy thật.
Tài liệu đầy đủ: **`docs/API-TRO-LY.md`** — kể cả mục "Ghi chú cho phiên làm app
Android", là cầu nối sang giai đoạn 2.

Bối cảnh: sau khi `am` xong, một app Android sẽ hỏi được cả 3 trang (`am`,
`tiendo`, `phaply`) qua Claude API. **Chính phiên Claude Code này viết tiếp app
Android đó** — ghi lại để phiên sau biết.

### Ba câu hỏi mở đã được trả lời (2026-08-14)

1. `tiendo` và `phaply` **chưa có repo**, chủ dự án sẽ gửi khi có.
2. Làm **`am` trước** làm mẫu, chốt chuẩn rồi nhân bản.
3. Ba trang **tách rời**, không gộp monorepo.

→ Kéo theo quyết định về gói dùng chung: `src/lib/troLyChung/` là **thư mục chép
tay** giữa ba repo, không làm package npm (phải dựng hạ tầng phát hành cho một
thứ rất ít thay đổi) và không gộp monorepo (chủ dự án đã chốt tách rời). Lý do
đầy đủ trong `src/lib/troLyChung/README.md`.

### Đã làm gì

- `src/lib/troLyChung/` — bộ dùng chung, **chép nguyên sang 2 trang kia sau này**:
  khung dữ liệu chuẩn, xác thực token, vỏ tuyến, chuẩn hoá giọng đọc, đọc số
  tiếng Việt. Chép sang trang khác chỉ phải đổi 2 chỗ (`TEN_TRANG` và bảng viết
  tắt), 4 file còn lại giữ nguyên.
- `src/lib/nghiepVu/` — riêng của `am`: lớp dịch `ContentItem` → JSON tiếng Việt,
  4 định nghĩa công cụ, gọi Claude sinh 2 bản trả lời, gom bản tin.
- `src/app/api/v1/tro-ly/` — 6 tuyến, vỏ HTTP mỏng.
- Bảng `AssistantApiLog` + migration **viết tay** (`20260814030000_them_nhat_ky_api_tro_ly`)
  — chỉ thêm bảng mới, chạy `migrate deploy` an toàn, tránh hẳn cạm bẫy Prisma
  xoá chỉ mục HNSW.
- `TOKEN_TRO_LY` đã thêm vào `.env.example`.
- `docs/API-TRO-LY.md` + `docs/vi-du-goi-api.http` (test nhanh mọi endpoint).

### Đã kiểm chứng thật

`npx tsc --noEmit` sạch · `npx eslint src` sạch · `next build` thành công, 6 tuyến
đăng ký đúng. Chạy dev server và gọi thật:

- Không token → 401 `thieu_token`; token bịa → 401 `token_sai` *(nghiệm thu #7)*
- `/cong-cu` trả đúng định dạng `tools` của Claude API *(nghiệm thu #2)*
- Giới hạn tần suất: đúng 60 lần lọt, lần thứ 61 bị chặn 429; token khác không
  bị ảnh hưởng
- Tham số sai → 400 kèm thông báo tiếng Việt chỉ rõ trường nào sai
- Database tắt → `/suc-khoe` vẫn trả 200 kèm lý do dễ hiểu (không lộ đường dẫn
  máy chủ hay mã nguồn)
- Đọc số tiếng Việt: đúng cả 17 trường hợp bất quy tắc (mười lăm, hai mươi mốt,
  hai mươi tư, một trăm lẻ năm, một nghìn không trăm lẻ năm…)
- Chuẩn hoá giọng đọc: "AI" viết hoa → "ây ai", nhưng "ai" viết thường (từ tiếng
  Việt) giữ nguyên — đúng như thiết kế

**Chưa kiểm chứng được**: `/tim-kiem`, `/noi-dung/{id}`, `/hoi`,
`/tom-tat-hom-nay` mới chỉ chạy qua build và typecheck, chưa gọi với dữ liệu
thật vì Phase 1 (quét YouTube) chưa chạy nên kho còn rỗng. `/hoi` cũng cần
`ANTHROPIC_API_KEY` mà hiện chưa có.

## Cần chủ dự án chuẩn bị

| Việc | Trạng thái | Ghi chú |
|---|---|---|
| Database trên [Neon](https://neon.tech) | ✅ xong | Đã kết nối, đã tạo bảng |
| Khoá Anthropic API | ⬜ chưa | [console.anthropic.com](https://console.anthropic.com) → API Keys |
| Khoá YouTube Data API v3 | ⬜ chưa | [console.cloud.google.com](https://console.cloud.google.com) → bật YouTube Data API v3 |
| Google OAuth (đăng nhập) | ⬜ chưa | Cùng trang trên → Credentials → OAuth client ID. **Cần cho Phase 1** |
| Whitelist tác giả/nguồn ban đầu | ⬜ chưa | Tác giả truyện, giảng sư, blog AI uy tín bạn đã biết |
| Chạy `npx prisma migrate deploy` để tạo bảng `AssistantApiLog` | ⬜ chưa | **Đừng dùng `migrate dev`** — xem `docs/API-TRO-LY.md` |
| Sinh `TOKEN_TRO_LY` điền vào `.env` | ⬜ chưa | Cần để gọi được Cổng API trợ lý |
| Gửi repo `tiendo` / `phaply` khi có | ⬜ chưa | Để chép bộ `troLyChung` sang và đồng bộ chuẩn API |

## Chỗ để dữ liệu — hiện tại và về sau

**Hiện tại**: database đặt trên [Neon](https://neon.tech) (đám mây), code chạy
trên máy. Lý do: chủ dự án làm trên **hai máy ở hai nơi** (PC ở nhà và máy văn
phòng), nên database phải nằm trên mạng thì hai máy mới thấy chung dữ liệu.

**Về sau, khi chạy thật**: đưa **cả dữ liệu lẫn code về chung một nơi**. Chưa
chốt là nơi nào — quyết định sau, khi tới lúc triển khai thật.

Điều này ảnh hưởng tới việc gì: `DATABASE_URL` và địa chỉ máy chủ trong
`docs/API-TRO-LY.md` sẽ đổi khi triển khai. Không ảnh hưởng gì tới code, vì mọi
địa chỉ đều đọc từ biến môi trường chứ không viết cứng.

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

**Phase 15 — dựng xong Cổng API trợ lý cho `am`**
- Chủ dự án trả lời 3 câu hỏi mở: `tiendo`/`phaply` chưa có repo, làm `am` trước,
  ba trang tách rời không gộp.
- Viết `src/lib/troLyChung/` (6 file dùng chung), `src/lib/nghiepVu/` (6 file
  riêng của `am`), 6 tuyến dưới `src/app/api/v1/tro-ly/`.
- Thêm bảng `AssistantApiLog` + migration viết tay, tránh cạm bẫy Prisma xoá
  chỉ mục HNSW.
- `docs/API-TRO-LY.md` + `docs/vi-du-goi-api.http`.
- Đã chạy thật và kiểm chứng — chi tiết ở mục "Phase 15" phía trên.

**Ghi chú kỹ thuật mới học được**
- Prisma 7 sinh enum thành kiểu union chặt (`ContentGroup`), truyền chuỗi thường
  vào là TypeScript báo lỗi. Cách sạch: viết hàm kiểm tra dạng "type guard" rồi
  gán vào biến cục bộ, không ép kiểu bừa.
- Kiểu của bản ghi lấy kèm quan hệ nên để `Prisma.ContentItemGetPayload<{ include:
  typeof QUAN_HE_CAN_LAY }>` tự suy ra. Viết tay thì mỗi lần đổi `include` lại
  phải nhớ sửa hai chỗ, quên một chỗ là TypeScript không báo gì.
- Next.js 16: `params` trong route động là **Promise**, phải `await`. Trước đây
  không phải vậy.
- Bẫy tiếng Việt khi thay từ viết tắt: phải khớp **đúng chữ hoa**. Nếu thay
  không phân biệt hoa thường thì câu "ai cũng biết" bị đọc thành "ây ai cũng
  biết". Và `\b` của biểu thức chính quy không hiểu nguyên âm có dấu, nên phải
  tự liệt kê bảng chữ cái tiếng Việt.
