# Nhật ký tiến độ

> Cập nhật cuối mỗi phiên làm việc. Máy còn lại dựa vào file này để biết đang ở đâu.

## Đang ở đâu

**Phase 0 — Nền tảng: XONG.** **Phase 15 — Cổng API trợ lý: XONG, đã chạy thật.**
**Phase 1 — đang làm, xong 2/6 bước.**

Khung Next.js 16 + Tailwind 4, Prisma 7, database Neon đã chạy thật với 38 bảng,
pgvector đã bật, logic chấm điểm chất lượng đã viết. `npm run dev` lên được trang.

## Phase 1 — Quét YouTube: đang làm

Chia thành sáu bước để dễ kiểm chứng từng chặng:

| Bước | Nội dung | Tình trạng |
|---|---|---|
| 1a | Đăng nhập Google, lưu token, chặn email lạ | ✅ xong, **đã đăng nhập thật** |
| 1b | Gọi YouTube API + đếm hạn mức + ngắt ở 80% | ✅ xong, đã chạy thật |
| 1c | Nhập kênh đã đăng ký / video đã thích / playlist | ✅ xong, **đã nhập 1.029 mục thật** |
| 1d | Quét video về thành `ContentItem` | ✅ xong, **kho có 820 video thật** |
| 1e | Lấy lời thoại video | ✅ xong, **779/820 video (95%)** |
| 1f | Phân loại bằng Claude | ✅ xong, **chạy thật qua gói Claude Pro, không cần khoá API** |

**Không còn chờ gì từ chủ dự án.** Khoá Anthropic API hoá ra không cần: đã
chuyển sang gọi Claude qua CLI dùng gói Claude Pro sẵn có — xem mục "Gọi Claude
qua CLI" bên dưới.

**Việc kế tiếp**: chạy phân loại cho 812 nội dung còn lại, rồi sang Phase 2.

### 1a — Đăng nhập Google

**Quyết định thiết kế: không dùng bộ bảng `User`/`Account`/`Session` của Auth.js.**
Đó là thiết kế cho web nhiều người dùng, trái với nguyên tắc "dùng riêng cho một
người" trong `CLAUDE.md`. Thay bằng:

- Phiên đăng nhập giữ trong cookie đã mã hoá (kiểu `jwt`), không cần bảng nào.
- Đúng **một bảng mới** `GoogleAccount` giữ **đúng một dòng** (`id = "chu_du_an"`)
  lưu token, để việc quét lúc 21:00 hằng đêm chạy được khi không ai mở trình duyệt.
- Biến `EMAIL_CHU_DU_AN` trong `.env` — chỉ email này đăng nhập được, ai khác bị
  từ chối. Bỏ trống thì chặn tất cả (thà không vào được còn hơn mở toang).

Chỉ xin quyền **đọc** (`youtube.readonly`). Quyền ghi playlist thật để Phase 7
xin riêng, người dùng thấy rõ mình đang cho phép cái gì.

File: `src/auth.ts`, `src/app/api/auth/[...nextauth]/route.ts`,
`src/app/dang-nhap/page.tsx`. Migration viết tay
`20260814050000_them_tai_khoan_google`.

**Đã kiểm chứng**: bấm nút đăng nhập → chuyển đúng sang `accounts.google.com`
với `access_type=offline`, `prompt=consent` (hai thứ bắt buộc để Google chịu cấp
refresh token), đúng scope `youtube.readonly`, đúng redirect URI, và có
`code_challenge` (Auth.js tự bật PKCE).

### Cạm bẫy: đăng nhập được nhưng không có quyền YouTube

**Đã vấp thật ngày 2026-08-14.** Đăng nhập thành công, token lưu vào database
đầy đủ, nhưng `scope` chỉ có `userinfo.profile`, `userinfo.email`, `openid` —
thiếu hẳn `youtube.readonly`. Gọi API thì nhận `403 Request had insufficient
authentication scopes`.

**Nguyên nhân**: Google **chỉ cấp những quyền đã khai sẵn trong màn hình xin
quyền của dự án trên Google Cloud**. Code có xin thêm cũng bị bỏ qua trong im
lặng — không hề báo lỗi lúc đăng nhập, mãi tới lúc gọi API mới lộ ra.

**Cách sửa**, trong [console.cloud.google.com](https://console.cloud.google.com):

1. Chọn đúng project chứa OAuth client ID đang dùng
2. **APIs & Services** → **OAuth consent screen**
3. Mục **Data Access** (giao diện mới) hoặc tab **Scopes** (giao diện cũ)
4. **Add or Remove Scopes** → lọc `youtube.readonly` → tick dòng
   `.../auth/youtube.readonly` (mô tả: *"View your YouTube account"*)
5. **Update** → **Save**
6. Về trang chủ đăng xuất rồi đăng nhập lại

Ở bước 6 sẽ qua vài màn hình cảnh báo "ứng dụng chưa được xác minh" — bình
thường, vì app đang ở chế độ thử nghiệm và chỉ mình dùng. Bấm qua là được.

*Ghi chú thực tế (2026-08-14)*: giao diện Google hiện tại **không có ô tick
riêng** cho quyền YouTube. Quyền được liệt kê sẵn trong màn hình cấp quyền, chỉ
cần bấm "Tiếp tục" là coi như đồng ý. Tài liệu cũ của Google có nói tới checkbox
cho từng quyền, nhưng bản đang chạy thì không.

Code đã được sửa để bắt lỗi này ngay tại `layAccessToken()` và in ra đúng các
bước trên, thay vì để Google trả về mã 403 khó hiểu.

**Đã kiểm chứng sau khi sửa**: `scripts/kiem-ket-noi-youtube.ts` báo "Quyền
YouTube: CÓ", gọi `subscriptions.list` đọc được danh sách kênh đã đăng ký thật.

Kiểm tra bất cứ lúc nào:

```bash
npx tsx scripts/kiem-ket-noi-youtube.ts
```

### 1b — Gọi YouTube API + đếm hạn mức

Google cho 10.000 đơn vị/ngày. Giá lệnh chênh nhau rất xa: đọc danh sách 1 đơn
vị, còn **tìm kiếm 100 đơn vị** — đắt gấp trăm lần. Nên với kênh đã biết thì
luôn đọc thẳng danh sách video của kênh, không bao giờ dùng tìm kiếm.

File: `src/lib/youtube/hanMuc.ts` (đếm + ngắt), `tokenGoogle.ts` (tự làm mới
token), `goiApi.ts` (gọi API, dịch lỗi Google sang tiếng Việt).

Hai chi tiết dễ sai đã xử lý:
- **Ngày tính hạn mức theo múi giờ Thái Bình Dương**, không phải giờ Việt Nam —
  vì đó mới là lúc Google reset. Tính nhầm là tưởng còn trong khi đã hết.
- **Ghi hạn mức cả khi lệnh lỗi**, vì Google trừ theo lượt gọi chứ không theo
  lượt thành công.

**Đã kiểm chứng thật**: gọi `channels.list` lấy được kênh Anthropic (763.000
người đăng ký, 172 video), bộ đếm trong database tăng đúng 1 đơn vị. Dựng tình
huống đã dùng 8.501/10.000 → `search.list` bị chặn kèm lời giải thích, còn
`playlistItems.list` và `videos.list` vẫn cho gọi — đúng nguyên tắc "ngắt tìm
kiếm trước, giữ việc quét kênh quen". Bản ghi thử đã dọn sạch.

Script kiểm tra nhanh bất cứ lúc nào:

```bash
npx tsx scripts/thu-youtube.ts
```

### 1c — Nhập tín hiệu từ tài khoản

File: `src/lib/youtube/nhapTinHieu.ts`, chạy bằng
`npx tsx scripts/nhap-tin-hieu-youtube.ts`.

**Đã nhập thật ngày 2026-08-14**, tổng **1.029 mục**, chỉ tốn **46 đơn vị** hạn
mức (chưa tới 0,5% ngân sách ngày):

| Loại | Số lượng | Độ mạnh của tín hiệu |
|---|---|---|
| Video đã thích | 282 | Mạnh nhất — hành động chủ động khen một nội dung cụ thể |
| Video trong playlist tự lập | 523 (từ 27 playlist) | Đã chọn lọc có chủ đích |
| Kênh đã đăng ký | 224 | Yếu nhất — nhiều người đăng ký rồi để đó |

**Chạy lại an toàn**: lần chạy thứ hai thêm mới 0 mục, tổng vẫn 1.029 — dùng
`skipDuplicates` nên nhặt thêm cái mới mà không nhân đôi cái cũ. Chạy lại sau
vài tháng sẽ lấy được những gì đã thích thêm trong khoảng đó.

Hai chi tiết đã xử lý:
- **Video "Deleted video"/"Private video" bị loại**, không lưu — chúng vẫn nằm
  trong playlist nhưng không còn tên thật, lưu vào chỉ làm nhiễu dữ liệu gu.
- **Một playlist hỏng không làm chết cả lần nhập** — gom lỗi lại báo cuối cùng.

*Nhận xét về dữ liệu thu được*: gu khá tạp, nhiều video giải trí ngắn xen lẫn
mấy mảng rõ nét (AI, đạo & đời, chạy bộ đường dài). Nghĩa là tới Phase 9 khi
dựng `UserTasteProfile` sẽ phải cân nhắc lọc bớt nhiễu, chứ lấy thẳng tần suất
kênh làm trọng số thì mảng giải trí ngắn sẽ lấn át.

### 1d — Quét video mới từ các kênh

File: `src/lib/youtube/quetKenh.ts`, chạy bằng `npx tsx scripts/quet-youtube.ts`
(có `--kenh N` để chạy thử vài kênh, `--ngay N`, `--video N`).

**Chỗ tiết kiệm quan trọng nhất**: mỗi kênh YouTube có sẵn một playlist ngầm
chứa toàn bộ video của kênh (playlist "uploads"). Đọc playlist đó tốn **1 đơn
vị**, trong khi dùng lệnh tìm kiếm lấy đúng ngần ấy video tốn **100 đơn vị**.
Id playlist uploads lấy một lần rồi cất vào `Source.uploadsPlaylistId` dùng mãi.
Thêm một chỗ nữa: lấy chi tiết video gộp 50 id một lệnh, tốn 1 đơn vị thay vì 50.

**Đã chạy thật ngày 2026-08-14** trên toàn bộ 224 kênh:

| Chỉ số | Con số |
|---|---|
| Kênh dựng thành `Source` | 224 |
| Video đã xét | 2.215 |
| Video lưu vào kho (đăng trong 7 ngày) | 759 |
| Hạn mức tiêu tốn | **240 đơn vị** (2,4% ngân sách ngày) |
| Kênh lỗi | 1 — *FM - Bí Ẩn*, playlist không đọc được |

Tổng kho hiện có **820 video**: 137 video dưới 60 giây (shorts), 318 video trên
20 phút, 706 tiếng Việt / 88 tiếng Anh. Quét toàn bộ chỉ tốn 240 đơn vị nên
chạy hằng đêm rất thoải mái.

**Cạm bẫy gặp phải — livestream chưa phát**: lần chạy thử lưu nhầm một buổi phát
trực tiếp *sắp diễn ra*. Google trả về `duration: "P0D"`, 0 lượt xem,
`liveBroadcastContent: "upcoming"`. Video chưa diễn ra thì không có lời thoại để
lấy, không có lượt xem để chấm điểm — lưu vào chỉ làm rác kho. Nay lọc bỏ cả
`upcoming` lẫn `live`; lần quét sau, khi buổi phát đã xong, video được lấy về
bình thường.

**Xác nhận cơ chế tính hạn mức theo múi giờ Thái Bình Dương chạy đúng**: giữa
phiên làm việc, bộ đếm tự reset từ 117 về 0 — đúng lúc qua nửa đêm giờ Thái Bình
Dương (khoảng 14h giờ Việt Nam). Nếu tính theo giờ Việt Nam thì đã sai một ngày.

Một kênh hỏng không làm chết cả lần quét — với vài trăm kênh thì kênh bị khoá
hoặc playlist riêng tư là chuyện thường. Lỗi được gom lại báo cuối cùng.

### 1e — Lấy lời thoại video

File: `src/lib/youtube/loiThoai.ts`, chạy bằng `npx tsx scripts/lay-loi-thoai.ts`
(`--so N` để giới hạn).

**Bản thiết kế phải sửa lại ở đây.** `docs/plan.md` định dùng `youtubei.js` làm
chính, `youtube-transcript` làm dự phòng. Tới lúc làm thật (2026-08-14) thì
**`youtubei.js` không lấy được lời thoại nữa** — YouTube đã chặn endpoint
`get_transcript` với mọi loại client (thử cả WEB, ANDROID, IOS, TV,
WEB_EMBEDDED; tải thẳng URL phụ đề trả về HTTP 200 nhưng rỗng).
`youtube-transcript` thì vẫn chạy tốt, nên **đổi nó thành thư viện chính** và gỡ
`youtubei.js` khỏi dự án.

Đây đúng là rủi ro `docs/plan.md` đã lường trước: "thư viện transcript gãy khi
YouTube đổi API ngầm". Cách phòng vẫn giữ nguyên — lấy được thì lưu vĩnh viễn,
gọi thưa (nghỉ 1,2 giây giữa mỗi video), video không có phụ đề thì đánh dấu để
lần sau khỏi thử lại.

**Đã chạy xong toàn bộ kho** (2026-08-14):

| Chỉ số | Con số |
|---|---|
| Video có lời thoại | **779 / 820 (95%)** |
| Video không có phụ đề | 41 |
| Tổng chữ thu được | khoảng 19 triệu ký tự |
| Trung bình mỗi video | ~25.000 ký tự |
| Video dài nhất | 160.377 ký tự |

**Cạm bẫy đã vấp — Prisma bỏ cuộc sau 5 giây**: chạy tới video thứ 565 thì dừng
với lỗi `Transaction API error: transaction timeout 5000 ms, however 8567 ms
passed`. Nguyên nhân: ghi một bản lời thoại 74.000 ký tự lên Neon mất hơn 8
giây, mà Prisma mặc định chỉ chờ 5 giây rồi huỷ. Database nằm trên mạng chứ
không phải trên máy, nên bản ghi lớn chậm hơn nhiều so với lúc thử nghiệm.

Đã nới hạn lên 60 giây (`prisma.$transaction([...], { timeout: 60_000 })`) ở cả
ba chỗ ghi lớn. **Không mất dữ liệu nào** — kiểm tra lại thấy 0 video ở trạng
thái dở dang, transaction đã tự huỷ sạch đúng như thiết kế. Chạy lại 255 video
còn dở sau khi sửa: trôi hết, không lỗi nào.

### 1f — Phân loại bằng Claude

File: `src/lib/llm/khungPhanLoai.ts` (khuôn dữ liệu), `phanLoai.ts` (gọi Claude),
`luuPhanLoai.ts` (lớp dịch sang database). Chạy bằng
`npx tsx scripts/phan-loai.ts --so N`.

**Ba quyết định về chi phí** — đây là chỗ tốn tiền nhất hệ thống, mọi video quét
về đều phải đi qua:

1. **Dùng Haiku 4.5, không dùng Sonnet.** Việc ở bước này là xếp nhóm và điền vài
   trường, không phải phân tích sâu. Haiku rẻ hơn ba lần. Sonnet để dành cho bước
   chấm chất lượng ở Phase 4, khi chỉ còn vài chục ứng viên đứng đầu. Đổi được
   qua biến `MODEL_PHAN_LOAI` trong `.env` nếu muốn thử.
2. **Bản hướng dẫn được ghi nhớ tạm** (prompt caching). Phần hướng dẫn dài và
   giống hệt nhau ở mọi lần gọi, nên đánh dấu để Claude nhớ lại — chỉ tốn khoảng
   một phần mười so với đọc lại từ đầu.
3. **Cắt lời thoại còn 4.000 ký tự.** Để biết video thuộc chuyên mục nào thì mấy
   nghìn chữ đầu là đủ; gửi cả bản 127.000 chữ chỉ tốn tiền vô ích.

**Câu trả lời đi theo khuôn định sẵn** (structured outputs + Zod): kiểu dữ liệu
trong code và khuôn Claude phải tuân theo là *một*, không có chuyện sửa một chỗ
quên chỗ kia. Không phải dò tìm trong văn bản tự do, không sợ trả về thứ không
đọc được.

Script luôn in chi phí ước tính ở cuối, kèm ước tính cho phần còn lại của kho —
chạy `--so 5` xem kết quả trước rồi mới chạy cả kho.

### Gọi Claude qua CLI — không cần khoá API

**Quyết định của chủ dự án (2026-08-14)**: dùng gói **Claude Pro trả theo tháng**
thay vì khoá API tính tiền theo từng nghìn chữ. Cách làm học từ dự án `phaply`
(Web Pháp lý) của cùng chủ dự án — xem `phaply/lib/claude-cli.ts`.

File: `src/lib/llm/claudeCli.ts`. Chạy lệnh `claude --print` ở chế độ không
tương tác, đẩy câu hỏi qua đầu vào chuẩn, đọc câu trả lời dạng JSON.

Chọn đường gọi tự động: máy có Claude CLI thì dùng CLI, không thì quay sang khoá
API. Ép bằng `CACH_GOI_CLAUDE="cli"` hoặc `"api"` trong `.env`.

**Chỗ tiết kiệm lớn nhất — tắt hết công cụ.** Claude Code vốn là trợ lý lập
trình, mỗi lần chạy nạp sẵn bản mô tả mấy chục công cụ. Việc ở đây chỉ là đọc
hiểu và xếp nhóm, không cần công cụ nào. Đo thật, mỗi lần gọi:

| Cách gọi | Chữ nạp vào |
|---|---|
| Như `phaply` làm (`--append-system-prompt`) | 30.087 |
| Thay hẳn lời dặn (`--system-prompt`) | 23.689 |
| **Thêm `--tools ""`** | **1.817** — rẻ hơn **94%** |

**Điểm khác biệt phải bù**: đường API có chế độ *bắt buộc trả lời theo khuôn*,
Claude không thể trả sai khuôn được. Đường CLI không có. Nên phải đưa khuôn JSON
vào lời dặn, rồi tự kiểm tra lại bằng đúng khuôn Zod đó, sai thì hỏi lại một lần
kèm chỉ rõ sai ở đâu.

### Chọn model: đo thật thay vì đoán

Ban đầu chọn Haiku vì rẻ hơn ba lần. Nhưng qua CLI thì không tính tiền theo chữ
nữa, nên lý do đó mất. Đã đo trên tám video (`scripts/so-sanh-model.ts`):

| | Haiku 4.5 | Sonnet 5 |
|---|---|---|
| Bốn video dễ (đều nhóm "khác") | đúng 4/4 | đúng 4/4 |
| **Bốn video khó** (triết học, giảng pháp) | **sai khuôn 2/4** | đúng 4/4 |
| Thời gian mỗi video | ~9 giây | ~12 giây |

Haiku hỏng đúng chỗ cần nhất: với bài giảng Phật pháp, nó điền trường riêng của
nhóm AI vào, dù lời dặn đã ghi rõ "trường không thuộc chuyên mục thì để trống".
Nhận xét của Sonnet cũng sắc hơn hẳn — nó nhận ra *"không sa vào kiểu trích dẫn
khắc kỷ sáo rỗng thường thấy trên mạng"* và *"nội dung nghiêm túc, không mê
tín"*, đúng loại phân biệt tinh tế mà bản thiết kế đặt ra.

→ **Qua CLI dùng Sonnet 5** (mạnh hơn mà không tốn thêm), **qua API dùng Haiku**
(rẻ hơn ba lần, chấp nhận thỉnh thoảng sai khuôn vì đã có cơ chế hỏi lại).

### Hai cạm bẫy đã vấp khi dựng đường CLI

**1. Khoá API giả làm treo mọi thứ.** `.env` còn để nguyên
`ANTHROPIC_API_KEY="sk-ant-..."` (giá trị mẫu). Claude CLI thấy có khoá là dùng
khoá đó và **bỏ qua tài khoản Claude Pro đã đăng nhập** — đúng cái đang muốn
tránh. Khoá lại là giả nên treo im lặng 180 giây rồi mới báo lỗi. Thông báo thật
nằm khuất trong luồng lỗi: *"connectors are disabled because ANTHROPIC_API_KEY
… takes precedence over your claude.ai login"*. Nay `claudeCli.ts` xoá hẳn biến
này khỏi tiến trình con.

**2. Tiến trình mồ côi làm nghẽn máy.** `child.kill()` của Node trên Windows chỉ
giết tiến trình gốc, để lại đàn con chạy tiếp. Sau vài lần hết giờ, máy còn sáu
tiến trình `claude.exe` mồ côi mỗi cái vài trăm MB, và từ đó **mọi lần gọi mới
đều treo**. Mất khá lâu mới nhận ra thủ phạm không phải câu lệnh sai mà là máy
đã nghẽn. Nay dùng `taskkill /T /F` để giết cả cây tiến trình.

**Đã chạy thật**: 8 video, 8/8 thành công, không lỗi.

## Phase 15 — Cổng API trợ lý: XONG và ĐÃ XÁC NHẬN CHẠY THẬT (phần của `am`)

Sáu endpoint dưới `/api/v1/tro-ly/` đã viết xong, build sạch, và **ngày
2026-08-14 đã gọi thật cả sáu bằng token thật, kết nối database Neon thật** —
xem mục "Xác nhận chạy thật" bên dưới.
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

### Xác nhận chạy thật — 2026-08-14, máy văn phòng

Đây là bước nghiệm thu cuối của Phase 15, phiên trước bị ngắt quãng chưa làm được.
Đã chạy `npx prisma migrate deploy` (bảng `AssistantApiLog` có trên Neon), sinh
`TOKEN_TRO_LY` điền vào `.env`, chạy `npm run dev` rồi gọi thật cả sáu endpoint:

| Endpoint | Kết quả |
|---|---|
| `GET /suc-khoe` | 200, **`"database":"ok"`** — kết nối Neon thật thành công |
| `GET /cong-cu` | 200, trả đúng định dạng `tools` của Claude API |
| `POST /tim-kiem` | 200, `{"ketQua":[],"tongSo":0}` — kho rỗng, đúng như mong đợi |
| `GET /noi-dung/{id}` | 404 + mã `khong_tim_thay` với id không tồn tại |
| `POST /hoi` | 200, trả lời "kho chưa có nội dung nào liên quan" |
| `GET /tom-tat-hom-nay` | 200, `tongSo: 0`, `tuBanTinDaSoan: false` |

Xác thực: không token → 401 `thieu_token`; token bịa → 401 `token_sai`.

Bảng `AssistantApiLog` đã ghi đúng mọi lần gọi, **nhãn token được che**
(`9247a8…`) chứ không lưu nguyên giá trị.

**Vẫn còn chưa kiểm chứng được**: đường gọi Claude API thật trong `/hoi`. Kho
đang rỗng nên endpoint trả lời ngay mà không cần gọi Claude — nhánh code gọi
Anthropic chỉ chạy khi có nội dung để đọc, tức là sau Phase 1.

**Cạm bẫy gặp phải**: `src/generated/` không có trong Git (đúng thiết kế), nên
sau khi clone hoặc khi thư mục đó bị mất, `npm run dev` lên được trang chủ nhưng
mọi route API đều 500 với lỗi `Can't resolve '@/generated/prisma/client'`. Chạy
`npx prisma generate` là hết. Đổi `.env` cũng phải khởi động lại dev server thì
biến mới có hiệu lực.

## Cần chủ dự án chuẩn bị

| Việc | Trạng thái | Ghi chú |
|---|---|---|
| Database trên [Neon](https://neon.tech) | ✅ xong | Đã kết nối, đã tạo bảng |
| Khoá Anthropic API | ⚪ **không cần nữa** | Đã chuyển sang gọi Claude qua CLI dùng gói Claude Pro trả theo tháng |
| Khoá YouTube Data API v3 | ✅ xong | Đã điền, đã gọi thật thành công |
| Google OAuth (đăng nhập) | ✅ xong | Đã điền `GOOGLE_CLIENT_ID`/`SECRET`, `AUTH_SECRET`, `EMAIL_CHU_DU_AN` |
| **Đăng nhập Google một lần** | ⬜ **chưa** | Mở http://localhost:3000 bấm "Đăng nhập bằng Google". Không có bước này thì bước 1c trở đi không chạy được |
| Whitelist tác giả/nguồn ban đầu | ⬜ chưa | Tác giả truyện, giảng sư, blog AI uy tín bạn đã biết |
| Chạy `npx prisma migrate deploy` để tạo bảng `AssistantApiLog` | ✅ xong | Đã chạy trên máy văn phòng 2026-08-14 |
| Sinh `TOKEN_TRO_LY` điền vào `.env` | ✅ xong | Đã có trên máy văn phòng. **Máy ở nhà phải tự sinh riêng** (`.env` không lên Git) |
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

**Nghiệm thu Phase 15 — gọi thật cả sáu endpoint** *(phiên Claude Code desktop,
tiếp nối phiên trên web bị ngắt quãng)*
- Chạy `prisma migrate deploy`, sinh `TOKEN_TRO_LY`, khởi động lại dev server,
  gọi thật cả sáu endpoint bằng token thật với database Neon — chi tiết ở mục
  "Xác nhận chạy thật" phía trên. `"database":"ok"`.
- Kiểm tra bảng `AssistantApiLog` trên Neon: ghi đủ mọi lần gọi, nhãn token
  được che.

**Phase 1 — bước 1a, 1b, 1c**
- Dựng đăng nhập Google (`src/auth.ts`) với quyết định không dùng bộ bảng
  Auth.js, chỉ thêm một bảng `GoogleAccount` giữ đúng một dòng.
- Dựng lớp gọi YouTube API kèm bộ đếm hạn mức (`src/lib/youtube/`), đã chạy thật
  và kiểm chứng cơ chế ngắt ở 80% — chi tiết ở mục "Phase 1" phía trên.
- Vấp cạm bẫy thiếu quyền YouTube (đăng nhập được nhưng Google không cấp
  `youtube.readonly`), đã sửa và ghi lại cách xử lý.
- Nhập thật 1.029 tín hiệu từ tài khoản YouTube của chủ dự án.
- Quét thật 224 kênh, đưa 759 video mới vào kho (tổng 820), tốn 240 đơn vị hạn
  mức. Vấp và sửa cạm bẫy livestream chưa phát.

**Ghi chú kỹ thuật mới học được**
- Auth.js v5 trả về `handlers` (một object), không trả `GET`/`POST` rời. Trong
  route phải viết `const { GET, POST } = handlers`, không `export { GET, POST }
  from "@/auth"` được.
- Auth.js v5 đọc `AUTH_SECRET` (tên mới), nhưng vẫn chấp nhận `NEXTAUTH_SECRET`
  cũ. Trên localhost không cần `trustHost` vì `NODE_ENV !== "production"` đã tự
  bật.
- Google **chỉ cấp refresh token ở lần cấp quyền đầu tiên**. Những lần đăng nhập
  sau không gửi lại, nên khi lưu phải cẩn thận không ghi đè bằng rỗng — mất là
  phải vào myaccount.google.com/permissions gỡ quyền rồi làm lại từ đầu. Đã đặt
  `prompt=consent` để ép Google hỏi lại mỗi lần, giảm rủi ro này.
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
- Thiếu `src/generated/` thì trang chủ vẫn lên nhưng **mọi route API 500**. Chạy
  `npx prisma generate` là xong. Đây là hệ quả cố ý của việc không đưa code
  Prisma tự sinh lên Git.
- Script chạy bằng `npx tsx` phải tự `import "dotenv/config"` ở dòng đầu, khác
  với code trong Next.js được framework nạp `.env` sẵn. Và `tsx` ở dự án này
  biên dịch ra CommonJS nên **không dùng được `await` ở cấp cao nhất** — phải
  bọc trong `async function main()`.
- **Prisma mặc định chỉ cho một transaction chạy 5 giây.** Với database đặt trên
  mạng (Neon) và bản ghi lớn (lời thoại vài chục nghìn ký tự), ngần đó là không
  đủ. Truyền `{ timeout: 60_000 }` làm tham số thứ hai của `$transaction`. Điều
  an tâm: khi hết giờ, Prisma huỷ sạch chứ không để lại dữ liệu dở dang.
