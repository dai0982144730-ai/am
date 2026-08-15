# Nhật ký tiến độ

> Cập nhật cuối mỗi phiên làm việc. Máy còn lại dựa vào file này để biết đang ở đâu.

## Đang ở đâu

| Phase | Tình trạng |
|---|---|
| **0** — Nền tảng | ✅ xong |
| **1** — Quét YouTube (6/6 bước) | ✅ xong, đã chạy thật |
| **2** — Blog & diễn đàn AI | ✅ xong phần chữ; phần giọng đọc chờ khoá TTS |
| **3** — Nhánh nhạc | ✅ xong, chạy hoàn toàn bằng luật |
| **4** — Chấm chất lượng | ✅ xong trọn: hai vòng chấm + màn hình chỉnh trọng số |
| **4b** — Tìm kiếm & bộ lọc | ✅ xong, tìm được cả trong nhận xét của Claude |
| **4c** — Chuyên mục New | ✅ xong, gõ từ khoá là đêm tự tìm |
| **7a** — Thư viện cá nhân | ✅ xong, thư mục tự đặt tên + trạng thái đọc |
| **8** — Ghi chú khi xem | ✅ xong, gõ hoặc nói, Claude tự xếp ngăn |
| **7b** — Playlist YouTube | ✅ xong phần đề xuất & duyệt; ghi thật cần cấp thêm quyền |
| **Khoa học** | ✅ chuyên mục thứ 5 + 7 nguồn báo/diễn đàn khoa học |
| **Lịch sử xem** | ✅ mở ra là rời luồng chính, không bày lại |
| **Tông màu** | ✅ nền be, điểm nhấn cam, menu trái đậm hơn |
| **Tỉ lệ nguồn mới** | ✅ chỉnh riêng từng chuyên mục trong Cài đặt |
| **Tự tìm nguồn mới** | ✅ theo chủ đề rút từ thứ chấm điểm cao |
| **Điểm chất lượng** | ✅ Claude chấm số, trụ tín hiệu duy nhất dùng được cho blog |
| **5** — Trình phát & nhớ chỗ dở | ✅ xong, đồng bộ máy tính ↔ điện thoại |
| **10** — Bản tin hằng sáng | ✅ xong, Claude viết bằng giọng trò chuyện |
| **Tự chạy** | ✅ một lệnh làm đủ 8 bước, hẹn giờ 21:00 |
| **15** — Cổng API trợ lý | ✅ xong, đã chạy thật |
| Giao diện | Trang chủ, trang xem video, trang cài đặt — chạy với dữ liệu thật |
| Phân quyền | Khách xem được; cấu hình và việc gọi Claude cần đăng nhập |

Khung Next.js 16 + Tailwind 4, Prisma 7, database Neon với 38 bảng, pgvector đã
bật. Kho hiện có **hơn 840 nội dung** (820 video YouTube + 28 bài blog/diễn đàn),
trong đó ~110 đã được Claude đọc và xếp nhóm.

## Phase 1 — Quét YouTube: XONG

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

**Việc kế tiếp**: Phase 4b (bộ lọc và tìm kiếm với ba kiểu sắp xếp), Phase 5
(trình phát + theo dõi thói quen xem), hoặc lấy khoá TTS để khép nốt phần giọng
đọc của Phase 2.

**Về 760 nội dung chưa phân loại**: chủ dự án chốt không chạy hết — quá nhiều và
không cần cho việc dựng giao diện. Đã phân loại có chọn lọc ~90 video *có triển
vọng* thuộc bốn chuyên mục chính (`--uu-tien`), đủ để mỗi mục có dữ liệu thật.
Số còn lại phần lớn là tin thời sự và giải trí, đọc hết cũng chỉ ra "khác".

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

**Đã chạy thật**: khoảng 90 video. Phân bố 60 video đầu:

| Chuyên mục | Số mục |
|---|---|
| Khác | 29 |
| Triết học | 10 |
| Truyện | 6 |
| Nhạc | 5 |
| AI | 2 |

Đáng ghi nhận: ngay cả với video **đã lọc trước theo từ khoá** của bốn nhóm
chính, Claude vẫn xếp gần một nửa vào "khác". Ví dụ *"Kỳ Án Ác Quỷ Ma Cà Rồng
Sacramento"* nghe như truyện kinh dị nhưng là vụ án có thật → `other`, đúng lời
dặn "chuyện có thật không tính là truyện". Nó lọc nghiêm chứ không nhét bừa cho
đủ — đúng nguyên tắc "thà bỏ sót còn hơn lẫn tạp" trong bản thiết kế.

### Cạm bẫy thứ ba của Prisma — hạn *chờ để bắt đầu*

Sau khi đã nới hạn *chạy* lên 60 giây, vẫn gặp lỗi khác:
`Unable to start a transaction in the given time`. Hoá ra Prisma có **hai** mốc
thời gian riêng biệt, và mốc thứ hai mặc định chỉ **2 giây**:

| Tham số | Nghĩa | Mặc định |
|---|---|---|
| `timeout` | Thời gian *chạy* transaction | 5 giây |
| `maxWait` | Thời gian *chờ để bắt đầu* | **2 giây** |

Khi database đang bận, xin mở transaction cũng phải xếp hàng. Nay đặt
`maxWait: 30_000`.

### Neon thỉnh thoảng cắt kết nối — đã cho tự thử lại

Neon là database "tự ngủ khi rảnh", nên đôi khi cắt ngang kết nối đang nhàn rỗi.
Đã vấp: một mẻ 30 video chết ngay từ lệnh đếm đầu tiên với `Connection
terminated unexpectedly`; chạy lại ngay sau đó thì trôi bình thường. Với việc
chạy hàng giờ thì không thể để cả mẻ hỏng vì mạng chớp một cái, nên mọi lượt ghi
nay tự thử lại tối đa hai lần (chờ 2 rồi 5 giây) khi gặp lỗi *đứt kết nối* —
những lỗi khác vẫn ném ra ngay, không giấu.

## Phase 2 — Blog & diễn đàn AI: XONG phần chữ, còn phần giọng đọc

Đây là phần **bù độ trễ tin AI**: tin trên YouTube tiếng Việt chậm hơn nhiều so
với blog phương Tây, nên đọc thẳng nguồn gốc rồi thuật lại bằng tiếng Việt.

File: `src/lib/nguon/` (đọc feed, lấy toàn văn, quét), `src/lib/llm/thuatLai.ts`
(thuật lại). Chạy bằng `scripts/quet-blog.ts` và `scripts/thuat-lai.ts`.

### Nguyên tắc "thêm nguồn mới = thêm một adapter" đã được kiểm chứng

Bài viết dùng **chung `Source`/`ContentItem`** với video. Chữ trong bài lưu vào
đúng bảng `Transcript` mà video dùng, chỉ khác nhãn nguồn (`blog_article_text`).
Nhờ vậy **bước phân loại bằng Claude chạy y nguyên, không sửa một dòng nào** —
chạy thật trên 10 bài, 6 bài được xếp vào nhóm AI. Nguyên tắc số một của bản
thiết kế đứng vững.

### Khảo sát nguồn thật — kết quả khác dự đoán

| Nguồn | Tầng | Đọc feed | Lấy toàn văn |
|---|---|---|---|
| Simon Willison | chuyên gia | ✅ 30 mục | ✅ tốt nhất — feed đã gần đủ toàn văn |
| Hugging Face | hãng | ✅ 842 mục | ✅ 9–27 nghìn chữ |
| Google DeepMind | hãng | ✅ 100 mục | ✅ 8–10 nghìn chữ |
| Hacker News | diễn đàn | ✅ kèm **điểm số + số bình luận** | tuỳ trang đích |
| Lobste.rs | diễn đàn | ✅ 25 mục | tuỳ trang đích |
| OpenAI | hãng | ✅ 1.129 mục | ❌ **chặn truy cập tự động (403)** |

Hai bất ngờ: DeepMind và Hugging Face tưởng chỉ có tóm tắt, hoá ra **trang từng
bài** lấy được toàn văn (chỉ trang *danh sách* mới dựng bằng JavaScript). Còn
OpenAI thì chặn hẳn — không cố vượt rào, chuyển sang dùng tóm tắt trong feed,
đúng tinh thần "xử lý duyên dáng khi bị chặn" ở mục rủi ro.

**Anthropic không còn RSS công khai** — thử bốn đường dẫn đều 404.

Món hời ngoài dự kiến: **feed Hacker News kèm sẵn điểm số và số bình luận**, lưu
thẳng vào `ExternalDiscussion`. Đây đúng là thước đo thay thế mà bản thiết kế
cần cho blog — loại nội dung vốn "không có chỉ số công khai nào".

### Thuật lại tiếng Việt — phần cốt lõi

Dùng **Sonnet** chứ không phải Haiku: đây là việc viết lách thật sự, cần giữ
giọng văn tự nhiên. Khác hẳn việc xếp nhóm ở bước phân loại.

Ràng buộc quan trọng nhất là **bản quyền**: lời dặn nói thẳng "thuật lại bằng
lời văn riêng, không dịch nguyên văn" — đúng yêu cầu trong mục rủi ro. Và
"đầy đủ" chứ không phải tóm tắt: giữ đủ số liệu, tên riêng, ví dụ để đọc xong
không cần mở bài gốc.

**Đã chạy thật, chất lượng tốt**: bài 17.586 chữ tiếng Anh → 18.127 chữ tiếng
Việt. Bản thuật lại giữ nguyên thuật ngữ (dependency, smoke test, CLI), giữ tên
lệnh và tên package, diễn đạt bằng lời riêng — ví dụ dùng chữ *"ăn ké"* thay vì
dịch máy móc. Tự thêm dòng `Ghi chú:` khi bài gốc ngắn, đúng như đã dặn.

Trên giao diện, bài đã thuật lại mang nhãn **ĐÃ THUẬT LẠI** ở góc ảnh.

### Ba lỗi vấp khi dựng

1. **Tiêu đề HTTP chỉ nhận ASCII.** Chuỗi tự giới thiệu viết "trợ lý đọc tin cá
   nhân" làm **cả sáu nguồn** hỏng với `Invalid character in header content`.
2. **Một trang khổng lồ làm chết cả mẻ.** Bài PDF 12MB khiến cheerio tràn bộ nhớ
   (`Maximum call stack size exceeded`), và vì lỗi ở tầng sâu nên script chết
   hẳn. Nay bỏ qua trang trên 3MB, và bọc từng bài trong lớp bắt lỗi riêng.
3. Không lấy được toàn văn thì dùng tóm tắt trong feed thay vì bỏ bài.

### Còn thiếu ở Phase 2

**Giọng đọc (TTS)** — cần `TTS_PROVIDER` và `TTS_API_KEY` mà `.env` chưa có.
Phần chữ đã xong nên khi có khoá chỉ việc đọc `NarrationAsset.scriptText` lên
thành audio.

## Phase 3 — Nhánh nhạc: XONG

Nguyên tắc số hai của bản thiết kế: nhạc đi nhánh riêng, **không lấy lời thoại,
không cho mô hình đọc sâu**. Lý do rất thực tế — đánh giá một bản nhạc bằng chữ
là vô nghĩa.

**Đã vấp thật, và đây là lỗi thứ tự đường ống**: 6/8 video nhạc trong kho **đã
bị lấy lời thoại**, cho ra 30–66 ký tự vô nghĩa. Nguyên nhân: bước lấy lời thoại
chạy *trước* bước phân loại, nên lúc đó chưa biết đâu là nhạc. Đã sửa bằng
`src/lib/music/nhanDienNhac.ts` — đoán sớm bằng luật ngay lúc quét, video có dấu
hiệu là nhạc thì bỏ qua luôn bước lấy lời thoại.

Lưu ý: bộ nhận diện đó **không phải bộ phân loại**. Nó chỉ trả lời một câu hỏi
hẹp — *"có đáng bỏ công lấy lời thoại không?"*. Claude vẫn quyết định chuyên mục.
Đoán nhầm thì cùng lắm thiếu lời thoại của một video, lấy bù sau được.

### Số nhịp: đọc, không đoán

`src/lib/music/docBpm.ts` chỉ đọc con số mà chính người đăng đã ghi, và **bắt
buộc phải có chữ "BPM" đứng cạnh** — "155 BPM Running Mix" thì lấy, "Top 155 bài
hát hay" thì không. Không có thì để trống.

Kết quả chạy thật trên 8 bản nhạc: **đọc được số nhịp 0/8** — vì không bản nào
ghi số nhịp trong tiêu đề. Đúng như thiết kế muốn: thà trống còn hơn đoán sai
làm hỏng buổi tập. **Đoán được thể loại 8/8** bằng luật từ khoá, không tốn một
lần gọi mô hình nào.

## Phase 4 — Chấm chất lượng: XONG phần lõi

`src/lib/scoring/chamDiem.ts` (phần tính toán đã có sẵn ở `normalize.ts` từ
Phase 0). Chạy bằng `npx tsx scripts/cham-diem.ts`.

**Quy tắc không được phá**: mọi tín hiệu đều chuẩn hoá thành thứ hạng phần trăm
**trong cùng một loại nguồn** trước khi vào công thức. 500.000 lượt xem YouTube
và 300 điểm Hacker News không cùng thang đo.

**Đã chạy thật**: 111 nội dung được chấm (101 video, 6 blog, 4 diễn đàn), điểm
từ 0,3 tới 6,7 trên thang 10. Trang chủ giờ xếp theo điểm này thay vì lượt xem,
và mỗi thẻ hiện điểm ở góc ảnh.

### Một quan sát quan trọng về kết quả

**Mười nội dung điểm cao nhất đều thuộc nhóm "Khác"** — tin thời sự giật gân về
sư Minh Tuệ, điểm 6,1–6,7. Trong khi bốn chuyên mục chính chỉ đạt 4,9–5,7.

Vì sao: engine hiện mới đo được tín hiệu **số học** (lượt xem, tỷ lệ bình luận).
Tin giật gân vốn có tương tác rất cao. Thứ đáng lẽ phân biệt được — `discussionQualityScore`
do Claude đọc bình luận thật — **chưa làm** (đó là vòng 2 của Phase 4).

Đây đúng là tình huống `plan.md` đã lường trước: *"video 2 triệu view nhưng bình
luận toàn emoji phải xếp dưới video 50 nghìn view có thảo luận thực chất"*. Hiện
chưa làm được điều đó.

**Không ảnh hưởng trải nghiệm ngay**, vì trang chủ chỉ hiện bốn chuyên mục chính
và nhóm "Khác" không lên trang. Nhưng khi làm bản tin hằng sáng (Phase 10) thì
phải xong vòng 2 trước, không thì trợ lý sẽ toàn gợi ý tin giật gân.

## Phase 4 vòng 2 — Claude đọc bình luận: XONG

File: `src/lib/youtube/layBinhLuan.ts` (lấy bình luận),
`src/lib/llm/chamBinhLuan.ts` (Claude chấm),
`src/lib/scoring/vongHaiBinhLuan.ts` (điều phối). Chạy bằng
`npx tsx scripts/doc-binh-luan.ts`.

Đây là mảnh ghép **phân biệt web này với việc chỉ sắp xếp theo lượt xem**, và nó
đã chứng minh giá trị ngay lần chạy đầu.

### Kết quả chạy thật — đúng như bản thiết kế dự đoán

Tám video **đang đứng đầu bảng** (điểm 6,1–6,7) được đọc bình luận. Điểm thảo
luận trung bình: **0,21 trên thang 1**. Nhận xét Claude đưa ra:

> *"Phần bình luận toàn là lời cầu nguyện, niệm Phật, khen chung chung và emoji
> — không ai bàn về nội dung"*
>
> *"Toàn bình luận khen chung chung, ủng hộ người làm nội dung mà không bàn chi
> tiết gì về nội dung thực"*

Cờ gắn được: **3 video bình luận toàn emoji**, **1 video bị người xem tố tiêu đề
sai nội dung**.

Sau khi tính lại, **cả tám video đó đều rơi khỏi tốp đầu**. Đúng nguyên văn điều
`plan.md` đặt ra: *"video 2 triệu view nhưng bình luận toàn emoji phải xếp dưới
video 50 nghìn view có thảo luận thực chất"*.

### Một hệ quả cần biết: video chưa đọc bình luận tạm được lợi

Khi trụ thảo luận không có dữ liệu, nó bị loại khỏi công thức và **trọng số 30%
của nó chia lại cho ba trụ còn lại**. Nghĩa là video *chưa* đọc bình luận có
điểm nhỉnh hơn video đã đọc mà thảo luận kém.

Nghe như bất công, nhưng thực ra là **cơ chế tự điều chỉnh hợp lý**: video nào
nổi lên tốp đầu thì vòng sau được đọc bình luận, thảo luận kém thì tụt xuống,
nhường chỗ cho cái khác nổi lên. Chạy hằng ngày thì tốp đầu dần chỉ còn nội dung
đã qua kiểm tra thật.

Không nên "cho điểm trung tính 0,5" khi chưa đọc — làm vậy là bịa ra dữ liệu
không có, và video kém sẽ được nâng lên oan.

### Kết quả chạy đủ 44 video

| Chỉ số | Con số |
|---|---|
| Điểm thảo luận trung bình | **0,27** trên thang 1 |
| Bình luận toàn emoji | **20 video** |
| Bị tố tiêu đề sai nội dung | **3 video** |
| Khen đúng chi tiết cụ thể | **5 video** |

Điểm cao nhất toàn kho giảm từ **6,7 xuống 5,7** sau khi trụ thảo luận vào cuộc.

Và engine phân biệt đúng hai chiều: video **"Vì sao AI Agent của anh em làm sai
hoài?"** đạt thảo luận **0,70** — cao gấp đôi tin thời sự (0,30–0,35). Nội dung
kỹ thuật kéo được thảo luận thực chất, tin giật gân thì không.

### Một lần sửa sai, đo lại, rồi hoàn tác

Thấy nhạc nổi lên tốp đầu dù bị loại khỏi vòng 2, đã thử cho nhạc **bộ trọng số
riêng** (phổ biến 0,45 · tương tác 0,35 · uy tín 0,2). Đo lại: **tệ hơn** — nhạc
leo từ hạng 2 lên **hạng 1**, vì dồn trọng số sang "phổ biến" khiến nó thiên về
lượt xem thuần.

Đã hoàn tác. Cách đúng là **để `compositeScore` tự chia lại** trọng số của trụ
thiếu theo tỷ lệ gốc giữa các trụ còn lại — nó vốn đã làm vậy sẵn, bộ trọng số
riêng chỉ phá đi.

Cũng đã kiểm tra giả thuyết "video ngắn được lợi vì tỷ lệ tương tác cao" —
**sai**: video 21 giây có tỷ lệ thích/xem 3,5%, *thấp hơn* video dài (4,2–7,9%).

### Chi phí rất rẻ

Một lần chạy 20 video: **20 đơn vị hạn mức YouTube** (0,2% ngân sách ngày) và 20
lần gọi Haiku. `commentThreads.list` chỉ tốn 1 đơn vị cho tối đa 100 bình luận.

Nhạc bị loại khỏi vòng 2: bình luận dưới video nhạc gần như luôn là "hay quá",
và bản thiết kế cũng nói nhạc không dùng điểm chất lượng nội dung.

### Còn thiếu ở Phase 4

Không còn thiếu gì — màn hình chỉnh trọng số đã làm xong, xem mục "Trang Cài
đặt" bên dưới.

## Phase 7a — Thư viện cá nhân: XONG

File: `src/lib/thuVien/actions.ts`, `trangThai.ts`,
`src/components/NutLuuThuVien.tsx`, `MucThuVien.tsx`,
`src/app/thu-vien/page.tsx`. Xem tại `/thu-vien`.

**Khác gì "đang xem dở"**: chỗ đang dở là máy tự ghi, phản ánh việc đã xảy ra.
Thư viện là chủ nhà chủ động chọn, phản ánh ý định. Một video xem dở mười phút
rồi bỏ hẳn vẫn nằm trong "đang xem dở"; chỉ thứ được cất vào thư viện mới là
thứ thật sự muốn quay lại.

**Thư mục là chữ tự do**, không có danh sách cố định. Ép vào một bộ thư mục có
sẵn thì sẽ luôn có thứ không biết bỏ vào đâu. Ô nhập có gợi ý từ những thư mục
đã dùng, nên vẫn gõ nhanh mà không bị gò.

**Sửa tại chỗ, không mở trang riêng.** Sắp xếp thư viện là việc làm theo mạch —
đổi thư mục ba bốn mục liền, đánh dấu xong vài cái. Bắt bấm vào từng mục rồi
quay ra thì làm hai lần là bỏ cuộc.

Khách không mở được trang này (đã thử — hiện lời mời đăng nhập). Khác với các
trang khác nơi khách vẫn xem được nội dung: thư viện không phải nội dung chung,
nó là đồ riêng của chủ nhà.

### Một cái bẫy của Next đã dính

File mang chỉ thị `"use server"` **chỉ được xuất ra hàm async**. Để một object
hằng số (`TRANG_THAI_DOC`) trong đó làm cả trang chết với lỗi 500:
*"A use server file can only export async functions, found object"*. Phải tách
ra file thường — nay nằm ở `trangThai.ts`.

Đây là cái bẫy chung, không riêng gì thư viện: đã gặp đúng kiểu này ở
`quanTam/giaTuKhoa.ts` (tách hằng số cho trình duyệt đọc được mà không kéo theo
prisma). Thêm hằng số vào file `"use server"` là hỏng ngay.

## Cảnh báo đỏ "hydration" — không phải lỗi của am

Next hiện lỗi đỏ mỗi lần mở trang, chỉ vào `<body>` trong `layout.tsx`. Nhìn
tên các thuộc tính bị lệch là rõ nguồn gốc:

`data-yd-metadata-content-site` · `data-yd-content-ready` · `bis_register` ·
`__processed_<uuid>__`

Không cái nào do am sinh ra — `layout.tsx` chỉ đặt `lang` và `className`. Đây
là **tiện ích mở rộng của trình duyệt** chèn thuộc tính vào trang trước khi
React kịp dựng. Chuỗi `bis_register` giải mã ra có
`"extensionId":"eppiocemhmnlbhjplcgkofciie…"`.

Cách xác nhận: mở trang trong cửa sổ ẩn danh (tiện ích bị tắt), cảnh báo biến
mất.

Đã dập bằng `suppressHydrationWarning` đặt ở **đúng hai thẻ `<html>` và
`<body>`**. Đây là cách React chính thức khuyên cho tình huống này, và nó chỉ
bỏ qua khác biệt về thuộc tính của riêng thẻ được đánh dấu — **không lan xuống
thẻ con**, nên lệch thật bên trong vẫn báo bình thường. Chỉ an toàn vì hai thẻ
đó không nhận dữ liệu động nào.

Đừng rắc `suppressHydrationWarning` ra chỗ khác để cho hết lỗi — làm vậy là bịt
miệng đúng thứ dùng để phát hiện lỗi thật.

## Tự đi tìm nguồn mới (2026-08-15)

File: `src/lib/khamPha/timNguonMoi.ts`, `locSoBo.ts`, `uyTinNguon.ts`,
`scripts/tim-nguon-moi.ts`. Là bước 2c của việc quét đêm.

**Cách tìm — đi theo gu đã bộc lộ, không tìm mò.** Lấy chủ đề Claude đã rút ra
từ những nội dung điểm cao rồi dùng làm từ khoá. Khác chuyên mục "New" ở chỗ
New là chủ nhà tự gõ; đây là máy suy ra từ thứ đã được chấm điểm cao.

**Ba chốt chặn, xếp theo thứ tự tiêu tiền từ rẻ tới đắt:**

1. Nguồn đã bị chê thì thôi lấy — miễn phí
2. Lọc sơ bộ bằng số liệu — miễn phí
3. Claude đọc và chấm — đắt, chỉ dành cho thứ qua hai cửa trên

Thứ tìm được **không vào thẳng trang chủ**: nó vào kho ở trạng thái chờ rồi đi
qua đúng dây chuyền như mọi nội dung khác. Không có đường tắt nào cho nguồn lạ.

### Phần học từ phản hồi (`uyTinNguon.ts`)

Tính **ngay lúc hỏi**, không dựng bảng riêng — mọi thứ cần thiết đã nằm trong
`ConsumptionSession`. Thêm một bảng điểm uy tín nữa thì phải lo giữ cho nó khớp
với sự thật; tính lại mỗi lần thì rẻ và không bao giờ lệch.

Hai tín hiệu, trọng số khác hẳn nhau. **Số sao** là lời nói thẳng: dưới 2,5 sao
qua từ 3 lượt chấm là thôi lấy. **Bỏ ngang** là lời nói ngầm, một mình chưa đủ
kết tội — mở ra rồi có việc phải đi cũng là bỏ ngang — nên chỉ tính khi nguồn
đó **chưa từng được chấm sao tử tế** và đã bỏ ngang từ 4 lần.

### Đã chạy thật

| | |
|---|---|
| Chủ đề đem đi tìm | 5 (rút từ nội dung chấm cao) |
| Tìm được | 50 kết quả |
| **Tầng lọc rẻ gạt** | **25** — quá ngắn, quá ít lượt xem, đang phát trực tiếp, tỉ lệ thích thấp, đủ số cho kênh đó |
| Thêm vào kho | 23 nội dung từ **21 kênh chưa từng gặp** |
| Hạn mức | 741 → 1246, đúng 5×101 |

Tầng lọc gạt đúng một nửa **trước khi tốn chữ nào của Claude**.

Chất lượng chủ đề hiện còn yếu ("grok bot", "đánh giá subscription") vì kho mới
có ít nội dung điểm cao, chủ đề nào cũng chỉ xuất hiện một lần. Luật ưu tiên
chủ đề lặp lại nhiều lần đã có sẵn, nó sẽ phát huy khi kho dày lên.

## Hai lỗi lộ ra khi kiểm phần trộn — đều đã sửa

### Lỗi 1: cửa chặn so nhầm loại nguồn

Bật Khoa học lên 90% mà vẫn ra **0 suất dùng được**. Đo ra ngay:

| | Điểm |
|---|---|
| Video YouTube khoa học (nguồn quen) | 5,9 · 4,4 · 1,4 |
| Bài blog khoa học (nguồn lạ) | tất cả đúng **2,5** |

Cửa chặn bắt nguồn lạ phải bằng điểm trung vị của nguồn quen — mà blog không có
lượt xem, lượt thích nào nên không đời nào đuổi kịp video. **Không một bài blog
nào lọt nổi.** Đây đúng cái sai mà nguyên tắc "chuẩn hoá trong cùng loại nguồn"
của bản thiết kế sinh ra để tránh, thế mà vẫn tái phạm ở chỗ khác.

Đã sửa: cửa chặn tính **theo từng loại nguồn** — blog so với blog, video so với
video. Sau khi sửa, Khoa học 90% ra đủ 3/3 suất.

### Lỗi 2: trụ "chất lượng nội dung" chưa bao giờ được điền

Lỗi trên chỉ là phần nổi. Đào tiếp thì thấy `chamDiem.ts` gán cứng
`contentQuality: null`. Trụ tín hiệu mà bản thiết kế dựng ra **đúng cho trường
hợp blog không có chỉ số công khai** thì chưa bao giờ có dữ liệu.

Hậu quả: bài blog chỉ còn trụ uy tín, ra một hằng số theo tầng nguồn — **9 bài
từ 5 báo khoa học khác nhau đều đúng 2,5 điểm.** Không xếp hạng được gì.

Đã sửa: thêm trường `contentQualityScore` (0–1), Claude chấm ngay khi phân loại
với thang mô tả rõ (0,2 hời hợt · 0,5 ổn · 0,8 có chiều sâu thật · 0,95 xuất
sắc hiếm gặp), và lời dặn nói thẳng rằng với blog thì đây là trụ duy nhất nên
đừng dồn hết vào quãng giữa.

Nội dung phân loại từ trước không có trường này. `scripts/bu-diem-chat-luong.ts`
bù dần, ưu tiên blog và diễn đàn — chỗ thiếu nó thì hỏng hẳn, còn video YouTube
vẫn còn ba trụ kia nên chỉ hơi kém chính xác.

Claude chấm có phân biệt thật, dải rộng từ 0,10 tới 0,72 trong một lượt 16 mục:

| Điểm | Nội dung |
|---|---|
| 0,72 | *"CÁCH CHỌN NGƯỜI CÓ ĐỨC ĐỂ KẾT GIAO – Nhìn 5 Điều Này"* |
| 0,50 | *"LBMA dự báo sốc: Vàng cuối năm quanh 4.500 USD"* |
| 0,25 | *"Gan nhiễm mỡ nên ăn gì?"* |
| 0,10 | *"MHN Phản Tố Chuyên Án Măng Đen… Dũng Mẹt Tuyên Bố"* |

### Một cái bẫy của Postgres, vấp ngay lượt chạy đầu

Bản đầu của script bù dùng `orderBy: { source: { type: "asc" } }`, tưởng sẽ đưa
`blog_feed` lên trước `youtube_channel` theo bảng chữ cái. **Postgres sắp xếp
kiểu enum theo thứ tự KHAI BÁO trong schema**, mà `youtube_channel` khai đầu
tiên — nên lượt chạy đầu bù cho 16 video YouTube và không đụng tới bài blog
nào, đúng thứ cần bù nhất. Không báo lỗi gì cả, chỉ lặng lẽ làm sai việc.

Đã sửa: lấy blog và diễn đàn thành một lượt truy vấn riêng, không xếp thứ tự
rồi cắt. Cứ phải dựa vào thứ tự enum là sớm muộn cũng sai.

### Kết quả sau khi bù đúng nhóm

Bài blog khoa học **hết cảnh hoà nhau ở 2,5 điểm**:

| Điểm | Chất lượng | Bài |
|---|---|---|
| 4,9 | 0,85 | Why Aging May Be a Program, Not a Breakdown |
| 4,5 | 0,75 | Scientists detect a nuclear reactor's ghostly afterglow |
| 4,5 | 0,75 | Introducing OlmoEarth embeddings |
| 4,1 | 0,65 | World's first superconducting quantum heat engine |
| 3,7 | 0,55 | Neptune's tiny moons may be the wreckage |
| 3,3 | 0,45 | Predict Antenna Coupling on Electrically Large Platforms |
| 3,1 | 0,40 | JWST spots a bizarre "black hole star" |

Thứ tự này đọc vào thấy hợp lý: bài có giả thuyết mới kèm hướng can thiệp đứng
đầu, bài quảng cáo whitepaper và tin thiên văn ngắm cho vui xuống cuối.

Với Khoa học để 90%, hàng thẻ giờ lấy đúng ba bài đầu bảng — trước khi sửa thì
lấy nhầm hai bài cuối bảng, vì tất cả cùng 2,5 điểm nên thứ tự là ngẫu nhiên.

**Một chỗ chưa hoàn hảo, ghi lại để sau xem**: nguồn diễn đàn (`forum_community`)
có trọng số `contentQuality` bằng 0 nên điểm chất lượng mới không ảnh hưởng gì
tới chúng — bài Hacker News được chấm 0,82 vẫn xếp dưới bài blog 0,75. Hiện
chấp nhận được vì diễn đàn đã có trụ "thảo luận" (điểm và số bình luận) làm
thước đo thay thế, đúng thiết kế. Nếu sau này thấy xếp sai thì chỗ cần sửa là
`DEFAULT_WEIGHTS.forum_community` trong `scoring/normalize.ts`.

## Quyền sửa playlist — đã bật, chờ chủ dự án làm hai bước

Đã thêm `.../auth/youtube` vào `QUYEN_XIN` trong `auth.ts`. Xin trong code là
chưa đủ, còn hai bước phải làm tay, nay viết thẳng lên trang `/playlist`:

1. `console.cloud.google.com` → APIs & Services → OAuth consent screen → Data
   Access → Add or Remove Scopes → lọc `youtube`, tick dòng `.../auth/youtube`
   (**không** phải dòng có đuôi `.readonly`) → Update → Save
2. Đăng xuất khỏi Am rồi đăng nhập lại

**Một lỗi thật bắt được khi làm việc này**: phép kiểm quyền dùng `includes()`
trên chuỗi scope, mà `.../auth/youtube.readonly` **chứa nguyên** chuỗi
`.../auth/youtube`. Tài khoản chỉ có quyền đọc vẫn bị báo là có quyền ghi, nên
cảnh báo vàng không bao giờ hiện — người dùng bấm rồi mới gặp lỗi khó hiểu của
Google. Nay tách chuỗi rồi so từng phần (`coQuyenSuaPlaylist`).

## Tỉ lệ nguồn mới, đặt riêng từng chuyên mục (2026-08-15)

File: `src/lib/nguonMoi/tyLe.ts` (đọc & mặc định), `tron.ts` (trộn),
`src/components/ThanhTyLeNguonMoi.tsx`, thao tác `luuTyLeNguonMoi` trong
`app/cai-dat/actions.ts`. Chỉnh tại `/cai-dat`.

Chủ dự án chốt cách này thay cho một con số chung cho cả web: **mỗi chuyên mục
một thanh trượt.** Ví dụ chính chủ nhà đưa ra: AI để 90%, khoa học 30%.

Đúng hơn hẳn một con số chung, vì nhu cầu mở rộng khác nhau theo chủ đề. Mảng
AI đổi từng tuần nên đáng ra ngoài vùng quen thật nhiều; mảng khoa học thì nguồn
tốt vốn ít và ổn định, mở rộng nhiều chỉ tổ rước tin giật gân. Mảng truyện rủi
ro nhất — nguồn lạ đầy truyện AI viết hàng loạt, để 0% cũng hợp lý.

`other` và `new_search` cố ý **không có** thanh trượt: `other` là sọt chứa thứ
không thuộc đâu, chẳng ai muốn mở rộng nó; còn `new_search` thì toàn bộ đã là
nguồn mới theo đúng định nghĩa.

### Ba quy tắc chống rác, đã cài vào `tron.ts`

**1. Tỉ lệ là TRẦN, không phải chỉ tiêu.** Đặt 90% mà tối nay chỉ 1 bài nguồn
lạ vượt chuẩn thì đưa 1 bài, phần còn lại trả về cho nguồn quen. Lấp cho đủ số
là cách chắc chắn nhất để chủ nhà nhận về rác — và chỉ vài đêm như thế là họ
thôi tin cả cái web. Câu này viết thẳng lên giao diện Cài đặt, kẻo kéo lên 90%
rồi thắc mắc sao tối qua chỉ thấy hai bài.

**2. Nguồn lạ phải qua cửa chặt hơn.** Điểm của nó không được thua **điểm trung
vị của nhóm nguồn quen cùng chuyên mục**. Không dùng ngưỡng cố định, vì điểm
được chuẩn hoá theo thứ hạng phần trăm nên ngưỡng cứng sẽ sai ngay khi kho đổi.

**3. Mỗi nguồn lạ tối đa một suất.** Thiếu luật này thì một kênh chăm đăng
chiếm sạch phần dành cho nguồn mới, và "mở rộng" hoá ra chỉ là đổi từ nhai lại
kênh cũ sang nhai lại đúng một kênh mới.

Thẻ từ nguồn chưa theo dõi được gắn nhãn cam **"nguồn mới"** để liếc một cái là
biết nên soi kỹ hay tin ngay.

### Đã kiểm phần chia suất

Chạy thử `layNoiDungTrangChu` với hai cấu hình:

| Cấu hình | AI | Triết học | Khoa học | Truyện | Music |
|---|---|---|---|---|---|
| Mặc định 30% | 1 suất | 1 | 1 | 1 | 1 |
| AI 90% · KH 30% · Truyện 0% | **3 suất** | 1 | 1 | **0 suất** | 1 |

Chia suất chạy đúng. Làm tròn xuống có chủ đích: 4 thẻ với tỉ lệ 90% ra 3 suất
chứ không phải 4, để chuyên mục nào cũng còn ít nhất một suất cho nguồn quen.
Đặt đúng 100% mới lấy hết — lúc đó là chủ nhà cố ý.

### Đã chạy thật đầu-cuối

Sau khi cho 9 video nguồn lạ (tìm được từ từ khoá "AI agent") chạy qua dây
chuyền, một bài được chấm **7,5 điểm**. Kết quả hàng AI ở trang chủ:

| Tỉ lệ AI | Suất dành cho nguồn lạ | Thực dùng | Hàng thẻ |
|---|---|---|---|
| 0% | 0 | 0 | 4 thẻ đều nguồn quen |
| 90% | 3 | **1** | 1 thẻ "nguồn mới" 7,5 điểm dẫn đầu + 3 thẻ nguồn quen |

Đây chính là **quy tắc "trần chứ không phải chỉ tiêu" chạy sống**: dành 3 suất
nhưng chỉ 1 bài nguồn lạ vượt được cửa, nên **2 suất kia trả về cho nguồn quen**
thay vì lấp bằng bài kém. Và bài lọt vào đứng đầu hàng vì nó thật sự điểm cao
nhất, không phải vì nó là nguồn lạ.

### Một lỗi lộ ra trong lúc kiểm: trang New rỗng dần

Lúc mới quét về, nội dung tìm theo từ khoá được gán tạm `contentGroup =
new_search`. Nhưng phân loại xong **Claude ghi đè bằng chuyên mục thật** ("ai",
"khoa_hoc"…). Trang `/quan-tam` lại lọc theo `contentGroup`, nên nó **rỗng dần
đúng theo tốc độ phân loại** — càng chạy càng mất bài. Đếm được ngay: 8 bài
theo cách cũ, 9 bài theo cách đúng.

Đã sửa: trang New và chip "New" bám vào **quan hệ tới `AdHocInterest`**, tức là
"bài này có được nhờ chủ nhà gõ từ khoá kia" — thứ bền, không bị phân loại ghi
đè. Một video AI tìm ra từ từ khoá "AI agent" giờ nằm cả ở hàng AI lẫn ở New,
đúng cả hai.

### Một điểm cần chủ dự án chốt

**Cả 13 nguồn blog/diễn đàn đều đang đánh dấu `subscribed`** — `quetBlog.ts`
gán cứng như vậy. Nghĩa là IEEE Spectrum, Nature, Ars Technica… đều được coi là
"nguồn quen" dù chủ dự án chưa từng chọn chúng; chính máy thêm vào.

Chưa tự sửa. Coi chúng là "quen" thì hợp lý ở chỗ đây là danh sách khởi đầu
đóng vai xương sống cho hai chuyên mục AI và Khoa học — tính là "lạ" thì cả 13
phải tranh nhau cái suất nhỏ của phần nguồn mới, và hai chuyên mục đó gần như
rỗng. Nhưng nếu chủ dự án muốn tự duyệt từng nguồn thì đổi được.

## Chuyên mục thứ năm: Khoa học (2026-08-15)

Chủ dự án đặt thêm: **khoa học và công nghệ ứng dụng đa lĩnh vực, nhưng phải là
thứ áp dụng được vào đời sống, không phải lý thuyết thuần tuý.**

### Ranh giới — chỗ khó nhất của chuyên mục này

Lời dẫn phân loại (`llm/phanLoai.ts`, đã lên `v2`) nói rõ hai chiều:

  - **Vào**: giải thích nguyên lý rồi chỉ ra nó đang dùng ở đâu; công nghệ mới
    kèm việc nó thay đổi được chuyện gì; nghiên cứu kèm hệ quả thực tế.
  - **Không vào**: lý thuyết thuần tuý (nghịch lý lượng tử kể cho vui); tin
    công nghệ tiêu dùng kiểu ra mắt điện thoại; tin giật gân ("NASA vừa phát
    hiện điều gây sốc").

Câu hỏi để tự kiểm, viết thẳng vào lời dẫn: **xem xong có biết thêm thứ gì dùng
được không?** Chỉ biết thêm một sự thật thú vị thì là 'other'.

Nội dung AI vẫn ở nhóm `ai`, không chuyển sang `khoa_hoc` — chủ dự án theo dõi
AI riêng và kỹ hơn.

### Bảy nguồn mới — vì YouTube một mình không đủ

Chủ dự án nói đúng: thứ đáng đọc về khoa học ứng dụng phần lớn nằm ở báo chuyên
ngành và diễn đàn kỹ thuật, còn YouTube tiếng Việt mảng này chủ yếu là tin giật
gân. Đã thử tải thật từng feed ngày 2026-08-15:

| Nguồn | Số bài | Tầng uy tín | Ghi chú |
|---|---|---|---|
| IEEE Spectrum | 30 | expert | Hợp gu nhất — hội kỹ sư, bài nào cũng gắn ứng dụng thật |
| Ars Technica Science | 20 | expert | Viết sâu, không giật gân |
| Quanta Magazine | 5 | expert | Thưa nhưng chất; thiên lý thuyết nên nhiều bài sẽ rơi vào "khác" — đúng |
| ScienceDaily | 60 | aggregator | Nhiều nhất, nhưng là tổng hợp thông cáo báo chí nên hay thổi phồng → xếp tầng thấp để bị trừ điểm |
| Nature | 76 | official | Uy tín cao nhất, nhưng phần lớn nghiên cứu thuần |
| Hacker News (≥150 điểm) | 20 | forum | Đám đông lọc giúp một lượt |
| Lobste.rs /t/science | 25 | forum | Cộng đồng nhỏ, thiên kỹ thuật, ít rác |

`phys.org` bị loại — trả về mã **451**, chặn truy cập theo vùng.

Ngưỡng Hacker News đặt **150 điểm**, cao hơn feed AI (100), vì tin khoa học trên
HN nhiều hơn hẳn và phần lớn là thứ đọc cho vui.

Thêm trường `nhomGoiY` cho mỗi nguồn — trước đây `quetBlog.ts` gán cứng
`contentGroupHint: "ai"` cho mọi thứ. Đây chỉ là **gợi ý**: Claude vẫn đọc từng
bài rồi tự xếp, vì một trang khoa học vẫn có bài không thuộc khoa học ứng dụng.

Toàn bộ nguồn này tiếng Anh nên đi qua bước thuật lại sang tiếng Việt trước khi
tới tai người nghe. Phần đọc thành tiếng vẫn chờ khoá TTS.

### Đã chạy thật (2026-08-15)

Quét 13 nguồn, xét 71 bài, **thêm 39 bài mới**, 35 lấy được toàn văn.

Nature báo lỗi **406** trong lần quét đó nhưng chạy lại riêng thì được 75 bài —
là bị chặn tạm vì gọi liên tiếp quá nhanh, không phải chặn hẳn. Cơ chế "một
nguồn hỏng không làm chết cả lần quét" đã lo đúng việc của nó: 12 nguồn kia vẫn
xong, và Nature sẽ được lấy ở lần quét sau.

Bốn bài khoa học đầu tiên được phân loại đều vào đúng `khoa_hoc`, kèm nhận xét
cho thấy Claude bám đúng tiêu chí "ứng dụng được":

> *"Giải thích rõ nguyên lý máy nhiệt lượng tử siêu dẫn và chỉ ra ứng dụng cụ
> thể: giảm số lượng cáp vi sóng đắt đỏ trong máy tính lượng tử lớn — **đúng
> chuẩn khoa học ứng dụng chứ không chỉ là tin giật gân**."*

> *"…nêu rõ ứng dụng thực tế: dùng detector antineutrino để giám sát lò phản
> ứng hạt nhân ngay cả khi đã tắt máy, phục vụ an toàn và thanh sát hạt nhân."*

Chuyên mục này cũng bắt được nội dung YouTube tiếng Việt, không chỉ báo nước
ngoài — một video mổ tái tạo dây chằng của kênh Khớp Việt Official vào đúng
nhóm, và nhận xét nói thẳng là *"lời bình rời rạc… chỉ phù hợp với người đã có
nền tảng chuyên môn"*.

### Ranh giới loại bỏ — đã kiểm, và nó chạy đúng

Đây mới là phần đáng kiểm nhất: bài **lý thuyết thuần tuý** có bị đẩy sang nhóm
"khác" không, hay Claude cứ thấy nguồn khoa học là xếp vào khoa học?

Sau khi phân loại 13 bài từ bảy nguồn đó: **9 vào `khoa_hoc`, 2 sang `ai`, 2
sang `other`.** Hai ca bị loại đúng như thiết kế mong đợi:

> **"Have physicists finally discovered glueballs?"** (Ars Technica) → `other`
> *"Tin khoa học thuần lý thuyết về khám phá glueball trong vật lý hạt, không
> đề cập ứng dụng thực tế nào — thú vị với người quan tâm vật lý cơ bản nhưng
> không thuộc nhóm khoa_hoc theo tiêu chí ứng dụng."*

> **"NASA's Perseverance rover watches Earth vanish from Mars"** (ScienceDaily)
> → `other` — *"chỉ là một sự kiện quan sát thiên văn đẹp mắt chứ không nói tới
> ứng dụng thực tế nào — thuộc dạng tin khoa học giật gân/tò mò"*

Ca thứ hai đúng y hệt kiểu ví dụ đã viết vào lời dẫn ("NASA vừa phát hiện điều
gây sốc"). Một phát hiện vật lý hạt tầm cỡ vẫn bị loại vì không dùng được vào
việc gì — đúng thứ chủ dự án yêu cầu.

Hai bài sang `ai` cũng đúng luật đã đặt: nội dung về AI thì ở nhóm `ai`, không
chuyển sang `khoa_hoc` dù AI cũng là công nghệ.

### Ghi chú vận hành

Hàng đợi phân loại xếp theo **ngày đăng mới nhất trước**, nên bài khoa học mới
không bị 760 video tồn đọng chặn đường. Muốn chạy riêng phần bài viết (bỏ qua
video) thì dùng cờ có sẵn:

```bash
npx tsx scripts/phan-loai.ts 30 --bai-viet
```

## Lịch sử xem — mở ra là rời luồng chính (2026-08-15)

File: `src/lib/lichSu/actions.ts`, `loc.ts`,
`src/components/GhiNhoDaMo.tsx`, `MucLichSu.tsx`, `src/app/lich-su/page.tsx`.

Bấm vào xem là nội dung **chuyển sang Lịch sử và biến khỏi Trang chủ, Khám phá,
New ngay**. Lần sau lướt là toàn thứ mới, và danh sách thật sự vơi đi — khác
YouTube, nơi thứ đã xem cứ hiện lại mãi.

**Ngoại lệ**: thứ đã cất vào thư viện vẫn ở lại luồng chính. Cất vào thư viện là
nói "tôi còn muốn quay lại cái này"; giấu đi thì hoá ra phạt người dùng vì đã
chủ động đánh dấu.

### Ba chỗ phải nghĩ

**Bảng riêng, không dùng lại `ConsumptionSession`.** Phiên xem chỉ tạo khi thật
sự bấm phát và dùng để hiểu gu; `WatchHistory` ghi mọi lần **mở**, kể cả bài
viết không có trình phát, kể cả bấm nhầm rồi thoát. Gộp một bảng thì hỏng cả
hai: hoặc mỗi cú bấm nhầm thành một lượt xem làm sai hồ sơ gu, hoặc mở rồi
thoát vẫn cứ hiện lại mãi.

**Bộ lọc phải ghép bằng `AND`, không trải thẳng.** Điều kiện "chưa lướt qua"
cần một `OR`, mà `timVaLoc.ts` cũng đã dùng `OR` cho ô tìm kiếm — trải thẳng
vào thì cái sau đè mất cái trước và bộ lọc âm thầm biến mất. Kiểu lỗi không báo
gì, chỉ lặng lẽ cho ra kết quả sai. Nên `chuaLuotQua()` là một hàm bọc, không
phải hằng số.

**Ô tìm kiếm thì KHÔNG giấu thứ đã xem.** Gõ vào ô tìm thường là để lần lại
đúng cái vừa xem hôm qua. Chỉ lúc lướt không mục đích mới giấu.

Có nút **"Trả lại trang chủ"** cho từng mục, vì cơ chế này rất dễ nuốt nhầm:
bấm vào rồi nhận ra chưa muốn xem bây giờ, thế là mất hút.

## Tông màu: nền be, điểm nhấn cam (2026-08-15)

Thay vì sửa hàng trăm chỗ trong code giao diện, **vẽ đè lên bảng màu `neutral`
của Tailwind** bằng một dải be ấm ngay trong `globals.css`. Mọi `bg-neutral-50`,
`border-neutral-200`… đang rải khắp các trang tự đổi theo. Đổi tông lần sau cũng
chỉ sửa đúng file đó.

Dải be chọn hơi ngả vàng đỏ chứ không xám trung tính, để đặt cạnh màu cam thì
cùng một họ, không lệch thành hai gam rời nhau.

| Chỗ | Màu |
|---|---|
| Nền vùng nội dung | `#FDFBF7` |
| Nền menu trái và thanh trên | `#F2EBDF` — đậm hơn một bậc |
| Điểm nhấn (nút chính, chip đang chọn, chữ "Am") | `#C2551A` |

Ba màu ngoài dải be: cam (nhấn), vàng hổ phách (cảnh báo), đỏ (đang thu âm).
Thêm nữa thì giao diện bắt đầu ồn.

## Phase 7b — Playlist YouTube: XONG phần đề xuất, ghi thật chờ cấp quyền

File: `src/lib/playlist/dongBo.ts` (đọc), `deXuat.ts` (Claude đề xuất),
`apDung.ts` (**chỗ duy nhất ghi thật**), `actions.ts`,
`src/components/BangPlaylist.tsx`, `src/app/playlist/page.tsx`,
`scripts/de-xuat-playlist.ts`.

### Một chỗ lệch với bản thiết kế — đã chọn theo CLAUDE.md

`plan.md` (nguyên tắc 3) từng nói thêm video và tạo playlist mới thì **cho tự
động** vì gỡ ra dễ; chỉ di chuyển và gỡ bỏ mới chờ duyệt.

`CLAUDE.md` thì nói **"Không bao giờ tự động"** với mọi thao tác ghi ra thế
giới thật. Chú thích trong `schema.prisma` cũng vậy: *"Trợ lý CHỈ đề xuất."*

Đã làm theo `CLAUDE.md`: **mọi thao tác ghi đều chờ duyệt.** Lý do thực tế:
"gỡ ra dễ" chỉ đúng khi biết là nó đã thêm vào. Trợ lý tự thêm mười video vào
playlist lúc 21:00 thì sáng hôm sau mở YouTube ra thấy playlist lạ hoắc, phải
đi tìm xem cái nào là của mình.

### Duyệt và ghi là hai nút khác nhau

Bấm **"Duyệt"** chỉ ghi lại ý định — chưa có gì thay đổi trên YouTube. Phải bấm
tiếp **"Ghi lên YouTube"** mới thật sự chạm vào tài khoản. Gộp lại một nút thì
một cú bấm nhầm là xong chuyện, mà đây là thứ duy nhất trong cả web này chạm
được ra thế giới thật.

`apDung.ts` cố ý viết ngắn và khó gọi nhầm: chỉ nhận id của một đề xuất **đang
ở trạng thái đã duyệt**, mỗi lần làm đúng một việc, không có chế độ hàng loạt.
Trong file đó **không có hàm nào gọi `playlists.delete`, và đừng thêm vào** —
thêm video hay tạo playlist thì gỡ ra được, xoá cả playlist thì không.

Playlist do trợ lý tạo luôn để **riêng tư**. Playlist máy tạo mà công khai thì
hoá ra trợ lý tự đăng thứ gì đó lên trang cá nhân của chủ nhà.

### Chưa ghi thật được — thiếu quyền, và đó là cố ý

Tài khoản hiện chỉ cấp `youtube.readonly`. Ghi playlist cần thêm
`https://www.googleapis.com/auth/youtube` (đã khai sẵn ở
`tokenGoogle.ts` là `QUYEN_SUA_PLAYLIST`, **chưa bật** trong `auth.ts`).

Muốn bật, ba bước, và bước giữa phải làm bằng tay:

1. Thêm `QUYEN_SUA_PLAYLIST` vào `QUYEN_XIN` trong `src/auth.ts`
2. Vào Google Cloud → màn hình xin quyền của dự án → khai thêm quyền đó.
   **Google chỉ cấp những quyền đã khai sẵn ở đây**, code có xin thêm cũng bị
   bỏ qua — đây là cái bẫy đã vấp một lần hồi Phase 1
3. Đăng xuất rồi đăng nhập lại

Trang `/playlist` tự biết đang thiếu quyền và hiện cảnh báo vàng trước, thay vì
để người dùng bấm rồi mới gặp lỗi khó hiểu của Google.

### Đã chạy thật (2026-08-15)

Đọc về **27 playlist thật**. Có sẵn mấy cái khớp hẳn với bốn chuyên mục:
`0 AI` (57 video), `Truyện`, `1 NHẠC BPM`, `2 GUITAR`.

**Lần chạy đầu lộ ra một lỗi thiết kế.** Khâu chọn ứng viên lọc theo điểm ≥ 6
trên toàn kho, và cả ba ứng viên lọt ra đều là video chính trị/tôn giáo nhóm
"khác", trong khi 12 video AI đã phân loại thì trượt vì điểm thấp hơn. Đây
đúng cái bẫy mà bản tin hằng sáng đã tránh: điểm được chuẩn hoá **trong cùng
loại nguồn**, nên video chuyên môn ít lượt xem luôn thua video thời sự nhiều
view. Đã sửa: chỉ lấy bốn chuyên mục chính (cộng thứ đã cất thư viện), bỏ hẳn
nhóm "khác".

Sau khi sửa — xét 10 video, **đề xuất 3, bỏ qua 7**:

| Video | Đề xuất | Lý do Claude viết |
|---|---|---|
| Trần Quốc Huy — AI Agent làm sai | `0 AI` | *"đúng trọng tâm playlist AI, nội dung có chiều sâu thực tế"* |
| Tổ điều tra bí ẩn — Hồng môn yến 2 | `Truyện` | *"khớp thẳng… Điểm chất lượng khá thấp (4.9/10) do văn phong rập khuôn nên chủ nhà có thể cân nhắc khi duyệt"* |
| HỒN MẸ GIỮ ĐẤT | `Truyện` | *"Điểm chỉ 4.8/10 và tình tiết mòn nên nếu muốn có thể cân nhắc bỏ qua"* |

Đáng chú ý: nó **tự nói ra điểm yếu của thứ chính nó đề xuất**, chứ không cố
bán. Và bỏ qua 7/10 — không đề xuất bừa.

**Ba playlist đang bật cho trợ lý sắp xếp** (`0 AI`, `Truyện`, `1 NHẠC BPM`) và
**ba đề xuất đang chờ duyệt**. Chưa có gì được ghi lên YouTube. Không muốn thì
vào `/playlist` bấm tắt hoặc bấm "Bỏ".

## Phase 8 — Ghi chú khi xem: XONG

File: `src/lib/ghiChu/actions.ts`, `ganNhan.ts`,
`src/lib/tieuThu/viTriHienTai.ts`, `src/components/ONhapGhiChu.tsx`,
`DanhSachGhiChu.tsx`, `OViecCanLam.tsx`, `src/app/ghi-chu/page.tsx`,
`scripts/gan-nhan-ghi-chu.ts`.

**Điều làm nó khác một ứng dụng ghi chú thường**: mỗi ghi chú gắn đúng giây
trong clip. Nghe tới phút 23 thấy ý hay, ghi lại; sau này bấm vào mốc giờ là
video nhảy thẳng về phút 23. Ghi chú rời khỏi ngữ cảnh thì vài tháng sau đọc
lại chẳng hiểu mình định nói gì.

Ô ghi chú và trình phát là hai thành phần nằm cạnh nhau trong một trang server,
không truyền state cho nhau được. Cách giải: trình phát **gửi vào một chỗ chung
hai cái hàm** — một để hỏi giờ, một để tua; ô ghi chú gọi khi cần
(`viTriHienTai.ts`).

**Gõ hoặc nói.** Phần nhận giọng dùng thẳng bộ nhận dạng có sẵn trong trình
duyệt: không gửi âm thanh đi đâu, không tốn tiền, không cần chỗ lưu file. Bản
thiết kế nói rõ chỗ này quan trọng — nghe podcast lúc lái xe mà phải dừng lại
gõ thì không ai ghi chú cả.

**Lưu xong là xong, không gọi Claude ngay.** Người dùng đang xem dở; bắt chờ
mười lăm giây cho Claude gắn nhãn thì lần sau họ không ghi nữa. Việc gắn nhãn
để dành cho lượt chạy gộp, giống hệt cách phân loại nội dung.

### Claude gắn nhãn — đã chạy thật (2026-08-15)

Thử với hai ghi chú viết cụt như người ta vẫn viết khi đang xem:

| Ghi chú | Claude gắn |
|---|---|
| *"chỗ này hay, thử áp dụng vào am xem sao"* | nhãn: tiêu chí đầu ra · định nghĩa đạt/không đạt · bản chất LLM — ngăn **"Xây dựng AI Agent"** — **việc cần làm** |
| *"ý này ngược với cái mình vẫn nghĩ"* | nhãn: rollback · kiểm duyệt agent · rủi ro tự động hoá — ngăn **"Quản lý AI Agent trong doanh nghiệp"** — freeform |

Việc cần làm nó tách ra: *"Thử áp dụng vào dự án Am: định nghĩa rõ tiêu chí đầu
ra thế nào là đạt/không đạt cho các bước xử lý bằng AI, thay vì chỉ mô tả các
bước cần làm."*

Không câu nào trong hai ghi chú nói được nội dung gì. **Nhãn cụ thể được là nhờ
Claude đọc đoạn lời thoại quanh mốc thời gian** — đây chính là chỗ ăn thua của
thiết kế này.

Và câu thứ hai **không** bị đánh dấu là việc cần làm, đúng như lời dặn: nghĩ về
một chuyện không phải là việc cần làm. Đánh dấu bừa thì danh sách việc đầy thứ
không phải việc, và chủ nhà sẽ thôi nhìn nó.

Dữ liệu thử đã dọn sạch sau khi kiểm.

### Ba chỗ đáng nhớ

**Cắt lời thoại quanh mốc bằng ước lượng tỉ lệ.** Lời thoại lưu thành một khối
chữ liền, không có mốc giờ từng câu. Ghi chú ở phút 23 của video 46 phút thì
lấy đoạn khoảng giữa bài. Thô, nhưng mục đích chỉ là cho Claude biết đang bàn
chuyện gì.

**Nhãn người dùng sửa lưu riêng, không đè lên nhãn máy.** Giữ cả hai mới so
được máy đoán gì và người sửa thành gì — nguyên liệu để sau này cải thiện. Đè
lên thì mất sạch dấu vết máy đã sai chỗ nào.

**Lọc cột JSON rỗng phải dùng `Prisma.DbNull`, không phải `null`.** Prisma phân
biệt "ô trống trong database" với "giá trị JSON null được ghi vào". Dùng nhầm
thì lọc không ra gì cả.

## Phase 4c — Chuyên mục "New": XONG

File: `src/lib/quanTam/quetTuKhoa.ts`, `actions.ts`, `giaTuKhoa.ts`,
`src/components/BangTuKhoa.tsx`, `src/app/quan-tam/page.tsx`,
`scripts/quet-tu-khoa.ts`. Xem tại `/quan-tam`.

Bốn chuyên mục kia chỉ thấy được nội dung từ kênh đã theo dõi — tức là chỉ thấy
thứ mình đã biết mà đăng ký. Phần này đi tìm ngoài vùng đó: hôm nay tự dưng quan
tâm gì thì gõ vào, tối máy tự tìm, sáng mai có trong bản tin.

### Vì sao giao diện phải nói thẳng giá tiền

Lệnh tìm kiếm của YouTube **đắt gấp 100 lần** mọi lệnh khác — 100 đơn vị một
lần, trong khi lấy chi tiết 50 video chỉ tốn 1. Cả ngày có 10.000 đơn vị. Mỗi từ
khoá đang bật ăn 1% ngân sách ngày, và phần bị bóp lại chính là việc quét kênh.

Giấu con số đó đi thì người dùng bật thoải mái, rồi một hôm ngồi nhìn lần quét
đêm chết giữa chừng mà không hiểu vì sao. Nên bảng chi phí nằm **trên cùng
trang, trước cả ô nhập**, và quá 10 từ khoá thì hiện cảnh báo vàng.

Cùng lý do đó, bước tìm từ khoá được xếp **sau** bước quét kênh trong việc chạy
đêm: hết hạn mức thì thứ mất đi phải là phần tuỳ hứng, không phải các kênh đã
theo dõi.

### Đã chạy thật (2026-08-15)

Thêm từ khoá **"AI agent"** rồi chạy `npx tsx scripts/quet-tu-khoa.ts`:

| | |
|---|---|
| Tìm thấy | 10 video |
| Thêm mới vào kho | 9 (1 cái đã có sẵn) |
| Hạn mức | 536 → 637, đúng **101 đơn vị** như tính toán |

Trang `/quan-tam` hiện đúng: *"1 từ khoá đang bật = 100 đơn vị hạn mức mỗi đêm,
tức 1.0% ngân sách ngày"*, kèm 9 thẻ kết quả.

**Từ khoá "AI agent" đang được bật.** Nó sẽ tự quét mỗi đêm cho tới khi tắt.
Không cần nữa thì vào `/quan-tam` bấm nút "Đang tự quét" một cái là xong.

### Hai chỗ nhỏ nhưng đáng nhớ

**Gỡ từ khoá không xoá nội dung đã tìm được.** Quan hệ chỉ được gỡ ra
(`SetNull`). "Thôi không tìm nữa" khác với "xoá những gì đã tìm được".

**Kênh gặp qua tìm kiếm được đánh dấu `not_subscribed`**, và gặp lại kênh đã có
thì không đụng gì tới nó. Nếu không cẩn thận chỗ này, một kênh đã theo dõi nhiều
năm mà tình cờ xuất hiện trong kết quả tìm kiếm sẽ bị hạ xuống thành "không theo
dõi" — mà uy tín nguồn thì có trọng số trong công thức chấm điểm.

## Phase 5 — Trình phát, nhớ chỗ đang dở, đánh giá: XONG

File: `src/lib/tieuThu/actions.ts` (ghi), `docTienDo.ts` (đọc),
`src/components/TrinhPhatYouTube.tsx`, `DanhGiaCamXuc.tsx`, `DangXemDo.tsx`,
`src/app/api/tieu-thu/roi-trang/route.ts`.

**Vì sao phải bỏ thẻ iframe thường**: iframe trơn thì trang không hỏi được video
đang phát tới đâu, mà biết vị trí chính là toàn bộ mục đích của phần này. Phải
nạp thư viện IFrame API của YouTube mới hỏi được.

### Ba quyết định đáng ghi lại

**Chỉ mở phiên xem khi thật sự bấm phát**, không phải lúc tải trang. Mở trang
rồi đóng ngay không phải là một lần xem — tạo phiên từ lúc tải thì mỗi cái bấm
nhầm cũng thành một bản ghi, và về sau phần học gu đọc phải toàn phiên rỗng,
tưởng chủ nhà mở nhiều mà chẳng xem gì.

**Có một tuyến API riêng chỉ để ghi lúc đóng tab** (`/api/tieu-thu/roi-trang`).
Lúc trang sắp đóng, trình duyệt huỷ mọi lời gọi mạng đang dở, kể cả server
action — chỉ `navigator.sendBeacon` là được cam kết gửi đi, mà beacon cần một
địa chỉ HTTP thật. Không có nó thì xem tới phút 47 rồi tắt máy, hôm sau mở điện
thoại lại thấy phút 45.

**Khách không để lại dấu vết nào.** Không phải giấu nút trên giao diện — chặn
thật ở server. Gọi thẳng tuyến beacon khi chưa đăng nhập thì nhận **HTTP 401**
(đã thử). Lý do: ghi cả lượt xem của người lạ thì hồ sơ gu bị pha loãng bởi
người khác, mà web này làm riêng cho một người.

### Tag cảm xúc khác nhau theo chuyên mục

Hỏi một bản nhạc có "hữu ích" không thì vô nghĩa, hỏi bài về AI có "thư giãn"
không cũng vậy. Danh sách chung cho mọi thứ sẽ khiến phần lớn lựa chọn thành
nhiễu. Nên: AI được hỏi *"áp dụng được ngay / lý thuyết suông / đã biết rồi"*,
truyện được hỏi *"sợ / cuốn / giọng đọc hay / nghe như AI đọc"*, nhạc được hỏi
*"thư giãn / tăng năng lượng / hợp lúc làm việc / nghe lại được"*.

### Đã kiểm tới đâu

Chạy `npx tsx scripts/thu-tieu-thu.ts` — diễn lại đúng kịch bản bản thiết kế
đòi, cả bốn cảnh đều đúng:

| Cảnh | Kết quả |
|---|---|
| Xem trên máy tính, bỏ dở phút 8 | ghi 4 sự kiện: play, pause, play, abandon |
| Mở trên điện thoại | tiếp từ giây 480, biết máy dừng lần trước là desktop |
| Nghe hết trên điện thoại | chỗ đang dở **tự xoá** — không ai muốn mở lại thấy "tiếp từ phút 58" của video đã xem hết |
| Mở lại lần nữa | máy biết đã xem xong 1 lần trước (`replayCount`) |

Script **tự dọn sạch dữ liệu nó tạo ra**. Bắt buộc phải vậy: nó ghi "đã xem
hết, chấm 4 sao" lên một video thật mà chủ nhà chưa hề xem — để lại thì phần học
gu sau này tưởng đó là thứ chủ nhà thích. Dữ liệu thử lẫn vào dữ liệu thật còn
tệ hơn không thử.

Phần khách nhìn thấy: đã mở bằng trình duyệt trong ứng dụng (không có phiên đăng
nhập). Trình phát hiện ra bình thường, **không có nút sao nào, không có tag
nào**, không có lời gọi ghi nào bắn đi, và có lời mời đăng nhập.

**Chưa kiểm được bằng mắt**: phần giao diện khi đã đăng nhập — hàng "Đang xem
dở" ở trang chủ, chấm sao, lời nhắc "đang tiếp tục từ…". Trình duyệt trong ứng
dụng không đăng nhập được, và không nên tự thao tác đăng nhập hộ. Lớp dữ liệu
bên dưới thì đã chứng minh chạy đúng bằng script trên. Chủ dự án mở
`localhost:3000` trên trình duyệt đang đăng nhập là thấy ngay.

## Tự chạy hằng đêm — XONG

Trước đây mỗi tối phải gõ **sáu lệnh riêng lẻ đúng thứ tự**. Giờ còn một:

```bash
npx tsx scripts/quet-dem.ts
```

Hướng dẫn hẹn giờ lúc 21:00 nằm ở **`docs/tu-chay-hang-dem.md`**.

Tám bước, thứ tự không đảo được vì bước sau ăn kết quả bước trước: quét YouTube
→ quét blog → lấy lời thoại → phân loại → thuật lại → chấm điểm → đọc bình luận
→ **viết bản tin cho sáng mai**.

**Một bước hỏng không làm chết cả đêm.** Mỗi bước tự bắt lỗi, ghi lại, các bước
sau vẫn chạy tiếp. Đã thêm trạng thái `partial` vào `JobRun` để phân biệt "hỏng
vài bước nhưng kho vẫn đầy thêm" với "hỏng hẳn" — gộp hai thứ lại thì mỗi sáng
nhìn nhật ký tưởng đêm qua công cốc.

### Đã chạy thật trọn vẹn (2026-08-15, 00:33)

| Bước | Kết quả | Thời gian |
|---|---|---|
| Quét YouTube | 224 kênh, **+133 video** | 208s |
| Quét blog | 6 nguồn, +4 bài | 26s |
| Lấy lời thoại | 117/120 | 351s |
| Phân loại | 80/80 | 1.085s |
| Thuật lại | 5 bài | 305s |
| Chấm điểm | 191 nội dung, 0,3–7,1 | 52s |
| Đọc bình luận | 19 video | 190s |

**Cả bảy bước đều xong, 37 phút.** Kho từ 848 lên **985 nội dung**.

## Phase 10 — Bản tin hằng sáng: XONG phần chữ

File: `src/lib/troLy/chonNoiDung.ts` (chắt lọc), `vietBanTin.ts` (Claude viết),
`taoBanTin.ts` (lưu). Xem tại `/ban-tin`.

**Vấn đề cần giải**: mỗi đêm quét ra hơn trăm nội dung. Đưa cả danh sách ra là
vô dụng — đúng thứ người dùng đang gặp với YouTube.

**Cách chọn**: tối đa 2 mục nổi bật mỗi chuyên mục + 4 mục "xem thêm nếu rảnh".
Và **bỏ hẳn nhóm "khác"** khỏi bản tin — kho hằng đêm phần lớn là tin thời sự và
giải trí, để chúng vào thì bản tin thành tin giật gân, đúng thứ cần tránh.

**Claude được đưa nhận xét chính nó đã viết khi phân loại**, kèm điểm chất lượng
và điểm thảo luận. Đủ căn cứ để nói có trọng lượng chứ không khen suông.

### Bản tin thật nó viết

> *"Đáng chú ý nhất là video của Trần Quốc Huy về AI Agent — cái này không phải
> kiểu lý thuyết chung chung, mà tác giả chia sẻ thẳng cách viết tiêu chí đạt/
> không đạt cho agent dựa trên kinh nghiệm thật… Có thêm video về dùng Claude để
> phân tích crypto, nhưng **nên xem như cách đặt câu hỏi cho AI hơn là tin theo
> con số lãi 10% trong 10 ngày họ demo — dễ gây ảo tưởng**."*
>
> *"Truyện đêm khuya… cả hai đều ổn để nghe giải trí nhưng **tình tiết khá mòn,
> không có gì bất ngờ**. Còn lại toàn video dance trend, **bỏ qua được**."*

Đây đúng là "trợ lý biết chắt lọc" — nó **cảnh báo** và **bảo bỏ qua**, chứ
không khen đều tất cả.

Còn thiếu: phần đọc thành tiếng, cần khoá TTS.

## Phase 4b — Tìm kiếm và bộ lọc: XONG

Trang `/kham-pha`: ô tìm kiếm, chip lọc theo chuyên mục kèm số đếm, bốn bộ lọc
nhanh, ba kiểu sắp xếp, phân trang. Mọi lựa chọn ghi vào địa chỉ trang nên bấm
quay lại về đúng bộ lọc cũ.

**Điểm đáng giá nhất**: tìm kiếm quét cả **nhận xét và chủ đề Claude rút ra**,
không chỉ tiêu đề. Gõ *"nhân quả"* ra hai video mà tiêu đề **không hề có chữ
đó** — *"Phước Báu của mình nằm ở CÁCH MÌNH SỐNG"* và *"Bốc Mộ Chồng Lấy Xương
Người Chửa"*. Đây là thứ ô tìm kiếm của YouTube không làm được.

Không gọi Claude trên đường đi của người dùng — gõ tìm là thấy kết quả ngay.

Hai kiểu sắp xếp đầu ("phù hợp nhất" và "chất lượng cao nhất") hiện cho kết quả
giống nhau, vì hệ số cá nhân hoá là việc của Phase 9. Vẫn tách sẵn để lúc đó chỉ
phải sửa một chỗ.

## Phân quyền — khách xem được, không làm được

**Chủ dự án chốt (2026-08-14)**: người lạ vào web vẫn xem được nội dung bình
thường, nhưng không đụng được vào hai nhóm việc:

| Nhóm | Ví dụ | Vì sao chặn |
|---|---|---|
| **Cấu hình** | chỉnh trọng số chấm điểm, thêm nguồn, duyệt tác giả | đổi cách cả hệ thống hoạt động |
| **Việc gọi Claude** | phân loại, thuật lại, đọc bình luận | tiêu hạn mức gói Claude Pro đang trả tiền |

File: `src/lib/quyen.ts`. Chỉ có **đúng hai trạng thái** — chủ dự án hoặc khách.
Không dựng hệ thống nhiều vai trò, đúng dặn dò trong `CLAUDE.md`.

**Chốt chặn nằm ở phía máy chủ, không phải chỉ giấu nút.** Mọi server action đều
gọi `doiHoiChuDuAn()` ngay dòng đầu, nên gọi thẳng vào cũng bị chặn.

**Đã kiểm chứng thật** ở chế độ khách: 25 thanh trượt trọng số đều bị khoá,
không có nút Lưu, hiện cảnh báo "đang xem với tư cách khách". Trong khi vẫn xem
được đủ 16 thẻ nội dung, bốn chuyên mục, trang xem video kèm nhận xét của Claude.

Thanh trên cùng nay có nút **Đăng xuất** (trước đó chỉ hiện email), và khi chưa
đăng nhập thì có dòng "Đang xem với tư cách khách" cạnh nút Đăng nhập.

## Trang Cài đặt — hoàn tất nốt Phase 4

`src/app/cai-dat/page.tsx` + `src/components/ThanhTrongSo.tsx`. Đây là mảnh cuối
còn thiếu của Phase 4.

Năm loại nguồn, mỗi loại một thẻ với năm thanh trượt. Người dùng cứ kéo thoải
mái, **không phải tự tính cho tròn 100%** — phần chuẩn hoá về tổng bằng 1 làm ở
phía máy chủ, nhưng phần trăm thực tế vẫn hiện ngay cạnh để thấy mình đang cho
trụ nào nặng hơn.

Khách vẫn xem được trang này để biết hệ thống chấm điểm ra sao — minh bạch thì
tốt hơn giấu đi. Chỉ là không kéo được.

## Giao diện — đã có trang chủ thật

Trang chủ (`src/app/page.tsx`) chạy với dữ liệu thật trong kho, bám theo bản
demo `docs/demo-ui.html`: thanh trên, cột điều hướng trái, thẻ ảnh 16:9 kèm
thời lượng và lượt xem, mỗi chuyên mục một hàng.

File: `src/components/KhungTrang.tsx` (khung chung), `src/components/TheNoiDung.tsx`
(thẻ), `src/lib/nghiepVu/layNoiDungTrangChu.ts` (truy vấn).

Vài điểm đáng ghi:

- **Nhãn góc ảnh đổi theo chuyên mục** — truyện hiện thể loại, nhạc hiện số
  nhịp, AI hiện chủ đề con. Liếc qua là biết, không phải đọc tiêu đề.
- **Hai bộ lọc của bản thiết kế áp dụng ngay ở tầng truy vấn**: truyện nghi do
  AI viết bị loại hẳn (bộ lọc cứng duy nhất trong hệ thống), nội dung có dấu
  hiệu mê tín bị đẩy khỏi mục triết học.
- **Mục chưa làm vẫn hiện nhưng làm mờ**, rê chuột thấy dự kiến làm ở phase nào
  — để thấy web sẽ đi tới đâu thay vì bấm vào gặp trang trống.
- Xếp tạm theo lượt xem. Khi có `ContentScore` (Phase 4) thì chỉ phải đổi mỗi
  phần `orderBy`.

**Đã kiểm chứng**: không lỗi console, ở 375px không tràn ngang và cột trái tự ẩn.

Chưa làm: chip lọc theo chuyên mục, bản tin trợ lý (Phase 10), trình phát
(Phase 5), và chín trang còn lại trong bản demo.

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
