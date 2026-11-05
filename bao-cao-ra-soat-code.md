# Báo cáo rà soát code — dự án Am

Rà soát ngày 2026-11-05, trên nhánh `claude/localhost-setup-662386` (cùng nội dung
với `main` ở commit `cf56420`). Rà thư mục `src`, tập trung vào: cổng đăng nhập,
các route API, server actions, gọi Claude CLI, ghi playlist lên YouTube, chấm
điểm, quét đêm. Không đọc hết 219 file; `src/generated` (Prisma sinh ra) bỏ qua.

**Gửi cho phiên làm việc trên GitHub.** Mỗi mục dưới đây là một lỗi, có chỗ xảy
ra (số dòng tính theo `main`), vì sao sai, và cách sửa đề nghị.

## Đã kiểm và ổn (không cần làm gì)

- Mọi server action ghi dữ liệu đều có chốt chặn đăng nhập (`doiHoiChuDuAn`).
  Chỉ hai hàm đọc không có: `layDuLieuMenuBaCham` và `timPodcastTheoTen`.
- Không có SQL thô (`$queryRaw`, `$executeRaw`) nào trong `src`.
- Chỗ duy nhất chèn HTML (`dangerouslySetInnerHTML` ở `layout.tsx`) là đoạn script
  màu giao diện, nội dung cố định.
- Commit mới nhất (`prompt: "consent select_account"` ở `src/auth.ts`) đúng.

## Danh sách lỗi, nặng đến nhẹ

### 1. Claude CLI: ghi stdin không bắt lỗi luồng — [src/lib/llm/claudeCli.ts:321](src/lib/llm/claudeCli.ts:321)

`con.stdin.write(...)` nằm trong `try/catch`, nhưng lỗi ghi (EPIPE khi CLI chết
ngay lúc khởi động) đến **bất đồng bộ** qua sự kiện `'error'` của luồng, nên
`try/catch` không bắt được. Không ai lắng nghe `'error'` → Node coi là lỗi chưa
xử lý và **sập cả `next dev` hoặc phiên quét đêm**. Dòng 141
(`spawn("taskkill", ...)`) cũng thiếu handler `'error'`.

**Sửa:** thêm `con.stdin.on("error", () => {})` trước khi ghi, và `.on("error", () => {})`
cho `spawn("taskkill")`. Phần `close` ở dưới đã báo lỗi thật.

### 2. Claude CLI: nhánh `.cmd` chạy qua shell mà không trích dẫn — [src/lib/llm/claudeCli.ts:239](src/lib/llm/claudeCli.ts:239)

Khi chỉ có `claude.cmd`, code dùng `shell: true`. Node nối các tham số bằng dấu
cách, không trích dẫn: lời dặn hệ thống nhiều chữ/nhiều dòng bị tách vụn, tham số
rỗng sau `--tools` biến mất, và nếu lời dặn có `& | "` thì thành lệnh shell.

**Sửa:** bỏ hẳn `shell: true`. Nếu đường dẫn là `.cmd`, tìm `cli.js` bên cạnh
(`node_modules/@anthropic-ai/claude-code/cli.js`) rồi chạy bằng `process.execPath`;
không thấy thì báo lỗi rõ ràng. Chưa thử trên máy chỉ có `.cmd` thật.

### 3. Route "rời trang": lỗi ghi phiên làm mất luôn "chỗ xem dở" — [src/app/api/tieu-thu/roi-trang/route.ts:52](src/app/api/tieu-thu/roi-trang/route.ts:52)

Ghi sự kiện `abandon` + cập nhật phiên nằm **trước** việc lưu `ResumePoint`, cùng
một `try`. Nếu `idPhien` không còn trong database (vd. vừa chuyển dữ liệu local
lên Neon), hoặc `thietBi` ngoài enum, hoặc `giayDaXem` không phải số → ném lỗi →
trả 500 → `ResumePoint.upsert` không bao giờ chạy. Mất đúng thứ route này sinh ra
để lưu.

**Sửa:** lưu `ResumePoint` trước; tách phần ghi nhật ký phiên sang khối `try` riêng
chỉ ghi log khi lỗi; chuẩn hoá đầu vào (`thietBi` chỉ nhận `mobile`/`desktop`, số
không hợp lệ về 0).

### 4. Sắp xếp playlist dùng vị trí cũ — [src/lib/playlist/ghiThang.ts:318](src/lib/playlist/ghiThang.ts:318) và [src/lib/playlist/apDung.ts](src/lib/playlist/apDung.ts) (vòng `playlistItems.update`)

Vòng ghi thứ tự so `dong.viTri === viTri` với ảnh chụp đọc **một lần ở đầu**. Sau
mỗi lần PUT, YouTube dồn các dòng khác sang chỗ mới, nên ảnh chụp lỗi thời:
- Ghi thừa dòng đã đúng chỗ (mỗi lượt 50 đơn vị hạn mức; playlist 202 video có thể
  vượt 10.000/ngày), trái với comment "CHỈ ghi dòng thật sự lệch chỗ".
- Có thể bỏ sót dòng thật ra đang lệch (vd. thật `[A,B,C]`, muốn `[C,B,A]`: B bị bỏ
  qua vì vị trí cũ 1 trùng mong muốn).
- Dòng 339: ảnh chụp sau khi ghi được đặt thành `thuTuMuon` mà không xét video có
  trên YouTube nhưng Am không biết, hay video Am muốn mà YouTube thiếu → ảnh chụp
  sai, bộ so sánh đẻ đề xuất ảo.

**Sửa:** giữ một mảng mô phỏng `dangCo` (sắp theo `position`); với mỗi vị trí muốn,
tìm chỉ số hiện tại trong `dangCo`, nếu khác thì PUT rồi `splice` ra và chèn vào
đúng chỗ. Ảnh chụp sau cùng lấy từ `dangCo`. Đã thử 500 ca ngẫu nhiên ra đúng thứ
tự; chưa thử trên YouTube thật.

### 5. Đổi tên playlist có thể xoá mô tả — [src/lib/playlist/ghiThang.ts:237](src/lib/playlist/ghiThang.ts:237) và [src/lib/playlist/apDung.ts](src/lib/playlist/apDung.ts) (`apDungDoiTen`)

`playlists.update` (PUT) chỉ gửi `snippet: { title }`. Theo tài liệu YouTube Data
API, trường ghi được mà không gửi lại thì bị xoá giá trị cũ → mất `description`
và `defaultLanguage` của playlist thật, không khôi phục được. (Dựa trên tài liệu,
chưa thử tài khoản thật.)

**Sửa:** viết hàm dùng chung `doiTenPlaylistThat(idThat, tenMoi)`: đọc snippet hiện
tại bằng `playlists.list` (1 đơn vị), nếu không đọc được thì dừng (không ghi mù),
rồi PUT lại `title` mới kèm `description` và `defaultLanguage` cũ. Dùng ở cả hai chỗ.

### 6. Chấm điểm "phổ biến" trộn hai thang đo — [src/lib/scoring/chamDiem.ts:86](src/lib/scoring/chamDiem.ts:86)

`dungTapThamChieu` đẩy `xem / theoDoi` (số nhỏ, vài chục trở xuống) cho nguồn có
số người theo dõi, nhưng đẩy `xem` thô (hàng nghìn) cho nguồn không có, **vào cùng
một mảng**. Kênh YouTube ẩn số sub có lượt xem thô lớn hơn mọi tỷ lệ → percentile
~1 cho trụ "phổ biến", đồng thời kéo percentile các video khác xuống. Ngược nguyên
tắc "chuẩn hoá percentile trong cùng thang đo". Chưa đếm trong database có bao
nhiêu video bị ảnh hưởng.

**Sửa:** tách hai tập: `tyLeXemTrenNguoiTheoDoi` (chỉ nguồn có follower) và
`luotXemTho` (chỉ nguồn không có). `popularityScore` nhận thêm `peerRawViews` và
dùng nó khi thiếu follower. Giữ được hành vi cho blog/podcast (vốn toàn nguồn
không follower). **Sau khi sửa phải chạy lại `chamDiemHangLoat`** để điểm cũ khớp
điểm mới.

### 7. `toPercentile` sắp xếp lại cả tập mỗi lần gọi — [src/lib/scoring/normalize.ts:19](src/lib/scoring/normalize.ts:19)

Chấm điểm gọi hàm này 3–4 lần cho mỗi nội dung, mỗi lần `[...population].sort()`
trên tập đến 5.000 phần tử → hàng trăm triệu phép so sánh với ~2.000 nội dung,
chậm dần khi kho lớn. Thêm: `take: 5_000` ở `chamDiem.ts:69` không có `orderBy`
nên khi kho vượt 5.000, mỗi lần chấm có thể lấy một nhóm khác nhau.

**Sửa:** nhớ bản đã sắp xếp theo chính mảng (`WeakMap<number[], number[]>`, kiểm
thêm độ dài) và đếm bằng tìm nhị phân; thêm `orderBy: { publishedAt: { sort: "desc", nulls: "last" } }`.
Đã thử 2000 ca ngẫu nhiên, kết quả giống hệt bản cũ.

### 8. Gọi YouTube/Google không có giới hạn thời gian chờ — [src/lib/youtube/goiApi.ts:132](src/lib/youtube/goiApi.ts:132), `goiApi.ts:184`, [src/lib/youtube/tokenGoogle.ts:139](src/lib/youtube/tokenGoogle.ts:139)

`fetch` không có `signal`. Mạng treo giữa chừng → chờ vô hạn → bước quét đêm đứng
im (`JobRun` kẹt `running`; tuyến cron chạm `maxDuration` 800 giây). Ở
`tokenGoogle.ts`, `phanHoi.json()` còn ném `SyntaxError` thô nếu Google trả HTML.

**Sửa:** `signal: AbortSignal.timeout(30_000)` cho cả ba chỗ; ở `tokenGoogle.ts`
dùng `phanHoi.json().catch(() => ({}))` để rơi xuống nhánh báo lỗi tiếng Việt.

### 9. CLAUDE.md và chú thích còn quy tắc cũ về "duyệt" — [CLAUDE.md:104](CLAUDE.md:104), [src/lib/youtube/goiApi.ts:162](src/lib/youtube/goiApi.ts:162)

Nguyên tắc số 3 nói mọi thao tác ghi ra thế giới thật phải qua "đề xuất → duyệt →
áp dụng", nhưng từ 2026-08-18 chủ dự án chốt: cú bấm của chính chủ nhà ghi thẳng
lên YouTube (`ghiThang.ts`). Chú thích `ghiYouTube` vẫn ghi "Chỉ được gọi từ
`playlist/apDung.ts`" dù `ghiThang.ts` gọi 5 chỗ. Phiên sau đọc CLAUDE.md sẽ tưởng
code vi phạm, hoặc "sửa" lại cho tuân thủ.

**Sửa:** cập nhật nguyên tắc 3: việc **trợ lý tự nghĩ ra** phải duyệt; việc **chính
chủ nhà bấm** ghi thẳng (ngoại lệ chốt 2026-08-18, code ở `ghiThang.ts`). Sửa chú
thích `ghiYouTube` nêu cả hai nơi được gọi. `docs/plan.md` mục kiểm thử số 10 vẫn
đúng cho phần trợ lý đề xuất; có thể thêm một dòng về luồng ghi thẳng.

### 10. Cổng API trợ lý: token sai không bị giới hạn, so sánh lộ độ dài — [src/lib/troLyChung/xacThucTokenTroLy.ts:112](src/lib/troLyChung/xacThucTokenTroLy.ts:112), [src/app/api/cron/quet-dem/route.ts:37](src/app/api/cron/quet-dem/route.ts:37)

Giới hạn tần suất chỉ áp dụng sau khi token đã đúng, nên đoán token sai được vô
hạn lần. `soSanhAnToan` trả về sớm khi độ dài khác nhau (lộ độ dài token đúng).
Tuyến cron so khoá bằng `!==` thường. Rủi ro thấp nếu token ngẫu nhiên và dài,
nhưng API `/api/v1/tro-ly/*` có thể đang mở ra internet qua tunnel.

**Sửa:** so sánh băm SHA-256 của hai chuỗi bằng `crypto.timingSafeEqual` (băm luôn
32 byte); đếm cả lần token sai (tối đa 20 lần/phút theo `x-forwarded-for` /
`x-real-ip`, dọn bộ đếm khi quá 1.000 khoá); export `soSanhAnToan` và dùng cho
tuyến cron.

## Việc nhỏ chưa đưa vào danh sách trên

- `tokenGoogle.ts`: nhiều lời gọi chạy song song đều tự làm mới token (thừa nhưng vô hại).
- `ghiThang.ts`: `themLenYouTube` không kiểm video đã có trong playlist trước khi
  chèn, bấm hai lần có thể thành trùng trên YouTube.
- `ghiThang.ts`: `baoDamCoThat` có thể tạo hai playlist thật nếu hai lệnh thêm
  chạy đồng thời cho cùng một thư mục chưa có bản thật.
- `quetDem.ts`: khoá chạy lại theo ngày dùng giờ UTC (`toISOString().slice(0,10)`).

## Lưu ý khi làm

- Chủ dự án không phải lập trình viên: giải thích bằng lời thường, có số liệu.
- Sửa xong chạy `npx tsc --noEmit`. Mục 4, 5 nên bấm thử trên một playlist nháp.
- Mục 6 xong phải chạy lại chấm điểm hàng loạt.
- Không đụng `.env`; không viết giá trị khoá vào code hay tài liệu.
