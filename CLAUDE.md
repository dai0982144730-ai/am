# Am — hướng dẫn cho Claude Code

Đọc file này đầu mỗi phiên để nắm bối cảnh. Dự án làm trên **một máy duy
nhất** (chốt lại 2026-08-17 — trước đó có giai đoạn ngắn định làm hai máy,
không còn đúng nữa). Vẫn ghi tiến độ vào `docs/PROGRESS.md` rồi commit + push
đều đặn — không phải để đồng bộ máy khác, mà để không mất ngữ cảnh giữa các
phiên làm việc.

## Dự án là gì

Trợ lý cá nhân tuyển chọn nội dung bằng Claude. Mỗi tối tự quét YouTube, blog,
diễn đàn, podcast, SoundCloud → đọc hiểu → chấm chất lượng → sáng hôm sau đưa ra
vài lựa chọn đáng xem nhất dưới dạng trò chuyện + audio ngắn.

Dùng riêng cho một người. Không phải sản phẩm nhiều người dùng — đừng thêm hệ
thống phân quyền, đăng ký tài khoản, hay multi-tenant.

## Tài liệu

| File | Nội dung |
|---|---|
| `docs/plan.md` | **Bản thiết kế chính thức.** Cấu trúc dữ liệu, cách chấm chất lượng theo từng nguồn, lộ trình. Cập nhật file này mỗi khi chủ dự án đổi ý muốn |
| `docs/PROGRESS.md` | **Nhật ký tiến độ.** Cập nhật cuối mỗi phiên: đã xong gì, đang dở gì, việc kế tiếp |
| `docs/demo-ui.html` | Demo giao diện (desktop + mobile), mở bằng trình duyệt |

## Quy ước làm việc

- **Ngôn ngữ**: mọi trao đổi, comment, commit message và nội dung giao diện đều
  bằng **tiếng Việt**. Chủ dự án không phải lập trình viên chuyên nghiệp — giải
  thích bằng lời dễ hiểu, tránh thuật ngữ khi không cần thiết.
- **Cuối phiên**: cập nhật `docs/PROGRESS.md` rồi commit + push. Máy còn lại phụ
  thuộc hoàn toàn vào file này để biết đang ở đâu.
- **Đầu phiên**: `git pull` trước khi làm bất cứ việc gì.
- **Khoá API**: chỉ nằm trong `.env` (đã bị gitignore chặn). Không bao giờ viết
  giá trị khoá vào code, vào tài liệu, hay vào commit. Code chỉ tham chiếu tên biến.

## Chủ dự án là ai, và cách làm việc với họ

Viết mục này 2026-08-16 sau khi hỏi thẳng chủ dự án, cộng với những gì rút ra
từ các phiên trước. Đọc mục này rồi thì không phải dò lại bằng cách thử.

### Bối cảnh

- **Không phải lập trình viên chuyên nghiệp.** Giải thích bằng lời thường, tránh
  thuật ngữ khi không cần. Nhưng **đừng nói trống không**: họ đọc số liệu rất
  kỹ và hay bắt được chỗ vô lý.
- **Làm trên một máy duy nhất** (chốt lại 2026-08-17), và **rất hay remote
  bằng điện thoại**. Câu trả lời phải đọc được trên màn hình nhỏ: bảng ngắn,
  không đoạn văn dài, đường dẫn bấm được.
- **Mảng chuyên môn thật của họ** là quản lý doanh nghiệp đầu tư, thiết kế, thi
  công và vận hành **dự án điện gió, thuỷ điện, điện mặt trời**. `am` chỉ là một
  trong các app; hướng chung là hệ thống AI và AI agent chạy trên web lẫn
  Android phục vụ mảng đó. Khi thiết kế thứ gì dùng lại được cho các app kia
  thì nói ra — `tiendo.scigroup.vn` và `phaply.scigroup.vn` là hai trang cùng họ.

### Bốn quy tắc họ đã nói thẳng

**1. Trình bày ý hiểu trước khi code.** Chủ dự án chốt bằng đúng câu *"cấm code
sửa chữa khi chưa trình bầy đúng"*. Với yêu cầu có nhiều hơn một cách hiểu:
viết lại ý hiểu, chờ gật, rồi mới sửa. Hiểu sai mà code xong là mất cả hai lần
công.

**2. Thấy vấn đề thì nói trước khi làm, kèm số liệu.** Không im lặng làm theo
rồi để họ phát hiện sau. Nêu vấn đề, đề xuất cách khác, đợi họ quyết. Họ chọn
đúng cách này khi được hỏi.

**3. Đo, đừng đoán.** Đây là thứ họ quý nhất ở các phiên vừa qua. Trước khi kết
luận thì chạy một script đếm thật trong database rồi dán con số ra. Đã có nhiều
lần con số lật ngược phán đoán ban đầu — ví dụ tưởng "Music ra 0 kết quả là
lỗi", đo mới biết cả 15 bản nhạc đều là Shorts 13–33 giây.

**4. Bớt cú bấm.** *"kh có nhu cầu chọn nhiều vì phải click chuốt 2 lần"*. Mọi
danh sách xổ ra chỉ chọn một giá trị, bấm phát là áp dụng và đóng luôn. Đừng
thêm nút "xác nhận" cho thứ đã rõ ý.

### Giọng viết họ muốn

Giống hệt cách các phiên gần đây đang làm, và họ xác nhận lại khi được hỏi:

- Có **bảng số liệu đo được**, không nói chung chung
- **Nói rõ chỗ chưa chắc** thay vì lấp liếm cho trôi
- Thừa nhận thẳng khi làm sai, sửa, rồi đi tiếp — không dài dòng xin lỗi
- Cuối mỗi việc nói rõ **cái gì xong, cái gì còn dở, cái gì bị chặn**

### Hai chuyện hay lo nhầm chỗ

**Đừng lo hộ chuyện lộ code**: *"tôi không sợ lộ code"* — họ chủ động mở tunnel
công khai để xem bằng điện thoại. Nhưng **khoá API thì vẫn tuyệt đối không**
(xem mục Quy ước làm việc).

**Ngược lại, phải lo chuyện tiếng Việt** — mục "Nguyên tắc quan trọng nhất" bên
dưới không phải khẩu hiệu. Trước khi tuyên bố một tính năng đã xong, kiểm xem
kết quả cuối cùng người dùng nhận được có phải tiếng Việt và có nghe/xem được
ngay trong app không.

## Nguyên tắc kỹ thuật cốt lõi

Ba điều này xuyên suốt thiết kế, đừng phá vỡ khi thêm tính năng:

1. **Mọi thứ xoay quanh `Source`/`ContentItem`**, không cứng theo "YouTube video".
   Thêm nguồn mới = thêm một adapter, không sửa schema.
2. **Music đi nhánh riêng**: không lấy transcript, không cho LLM đọc sâu. Đánh giá
   nhạc bằng chữ là vô nghĩa và tốn tiền vô ích.
3. **Mọi thao tác ghi ra thế giới thật đều phải qua "đề xuất → người dùng duyệt →
   áp dụng"**: ghi playlist YouTube thật, công nhận tác giả mới vào whitelist.
   Không bao giờ tự động.

Thêm một điều về chấm điểm: **chuẩn hoá percentile trong cùng loại nguồn**, không
bao giờ so trực tiếp lượt xem YouTube với điểm Hacker News.

## Nguyên tắc quan trọng nhất: NGHE và NHÌN, bằng TIẾNG VIỆT, TRONG app

Chủ dự án chốt ngày 2026-08-15, và đây là thứ phủ lên mọi quyết định khác:

1. **Am là app nghe và nhìn, không phải app đọc.**
2. **Chỉ tiếng Việt.** Chủ dự án không biết tiếng Anh. Nội dung tiếng Anh nguyên
   bản là *"vô tri, không có ý nghĩa gì hết"* — kể cả khi điểm chất lượng cao.
3. **Không bao giờ phải rời app.** Không đặt liên kết "mở bài gốc" ra ngoài làm
   cách xem chính. *"Nhu cầu kiểu đó tôi dùng Google."*

**Ngoại lệ duy nhất**: bài tiếng Anh mà Am đã đọc, dịch, kể lại bằng tiếng Việt
**kèm bản âm thanh tiếng Việt**. Khi đó nội dung chữ dài cũng được, vì có audio.

### "Vô tri" nghĩa là CHƯA XỬ LÝ, không phải ĐEM GIẤU

Đã hiểu sai một lần và phải sửa lại toàn bộ (2026-08-15). Tôi đọc câu "vô tri"
thành "vậy thì ẩn đi", rồi làm bộ lọc giấu sạch nội dung nước ngoài chưa có bản
đọc tiếng Việt. Hậu quả đo được: **28 bài blog và 8 bài diễn đàn biến mất sạch,
chuyên mục Music trống trơn, chuyên mục AI từ 28 còn 5**.

Chủ dự án phát hiện ra ngay và hỏi:

> *"AI có 28 mà hiện lên chỉ có 05 là sao? các bài từ blog, từ nguồn không phải
> youtube biến mất sạch??"*

Một clip hay bằng tiếng Anh **không phải thứ cần vứt đi — nó là thứ cần lồng
tiếng**. Ẩn đi là bỏ mất đúng phần nội dung tốt nhất mà chẳng giải quyết gì.

*(Ghi chú về chính tài liệu này: bản đầu của mục này có một câu dài đặt trong
ngoặc kép như thể chủ dự án nói, nhưng chủ dự án chưa từng nói câu đó — tôi tự
suy ra ý rồi viết thành lời trích dẫn. Đã thay bằng nguyên văn. Trong file này
chỉ đặt vào ngoặc kép những câu chủ dự án nói thật, vì các phiên sau sẽ đọc nó
như bằng chứng về ý muốn của chủ nhà.)*

Hệ quả bắt buộc khi viết code:

- **KHÔNG lọc nội dung theo ngôn ngữ ở tầng hiển thị.** Thay vào đó đưa nó vào
  hàng đợi lồng tiếng.
- **Nhạc không bao giờ xét ngôn ngữ.** Nghe nhạc là nghe giai điệu; mà nhạc lại
  không cho LLM đọc sâu nên kết luận ngôn ngữ chỉ dựa vào tiêu đề, tức đoán mò.
- Tiêu đề tiếng Anh phải dịch trước khi hiện (`ContentClassification.titleVi`),
  ở **cả thẻ lẫn trang xem**. `npx tsx scripts/dich-tieu-de.ts`
- Đừng thêm nút nào dẫn người dùng ra khỏi app để tiêu thụ nội dung.
- **Số trên chip lọc phải đếm y hệt cách danh sách lọc.** Đã vấp: chip ghi
  "AI 28" mà bấm vào ra 5 nội dung.

## Database chạy ngay trên máy, không ở trên mạng nữa

Từ 2026-08-15, database là **PostgreSQL 18.4 bản rời chạy trên chính máy này**,
không còn ở Neon. Đo thật: một truy vấn rỗng từ **224 ms xuống 0,3 ms**, một
trang danh sách từ 525 ms xuống 47 ms.

**Máy chủ database không tự chạy khi bật máy** — đây là bản giải nén chứ không
phải bản cài đặt (có chủ đích: không đụng quyền admin, muốn gỡ thì xoá thư mục).
Mở web mà mọi trang đều lỗi kết nối thì gần như chắc chắn là quên bật nó:

```bash
scripts/chay-database.cmd
```

| Thứ | Chỗ |
|---|---|
| Bản Postgres | `C:\Users\Admin\pgsql-goc\pgsql\bin` |
| Dữ liệu | `C:\Users\Admin\am-database` |
| Nhật ký | `C:\Users\Admin\am-database\nhat-ky.log` |

Địa chỉ Neon vẫn nằm trong `.env` dưới dạng ghi chú — muốn quay lại chỉ việc đổi
chỗ dấu `#`, **code không phải sửa một dòng nào**.

**pgvector đã cài xong — 2026-08-17.** Visual Studio Build Tools 2022 (workload
C++) cài qua winget, rồi dựng pgvector 0.8.6 từ mã nguồn chính thức — không có
bản cài sẵn cho Windows, cũng không có trong catalog StackBuilder (đã kiểm).
`scripts/check-db.ts` xác nhận: extension bật, đủ cột `vector` ở
`ContentEmbedding`/`NoteEmbedding`, đủ hai chỉ mục HNSW.

Hai chỉ mục HNSW **cố ý nằm ngoài migration**: Prisma không hiểu loại chỉ mục
này nên mỗi lần `migrate dev` nó đều định xoá đi. Để trong một script chạy lại
được bất cứ lúc nào thì không có gì để xoá nhầm — `scripts/bat-pgvector.ts`,
chạy lại an toàn bất cứ khi nào nghi ngờ (vd. sau khi phục hồi database từ bản
sao lưu chưa có pgvector).

Còn cần: Phase 9 (personalization) phải tự sinh embedding cho nội dung/ghi chú
(qua Voyage AI) rồi ghi vào cột `vector` — cột và chỉ mục đã sẵn sàng, nhưng
chưa có dòng dữ liệu nào (0 embedding tính tới 2026-08-17). Việc tạo migration
mới từ nay đã an toàn hơn: `scripts/cai-pgvector.ps1` chỉ cần chạy lại nếu cài
lại Postgres từ đầu, không phải chạy mỗi lần.

## Cạm bẫy đã gặp — đọc trước khi chạy migration

### Trên máy này, `prisma migrate dev` VẪN KHÔNG DÙNG ĐƯỢC. Viết migration bằng tay.

Lệnh đó dựng một **database bóng** rồi diễn lại toàn bộ migration từ đầu để dò
sai lệch. Từ khi cài pgvector (2026-08-17) lỗi `extension "vector" is not
available` đã hết — pgvector nằm ở cấp Postgres, database bóng mới tạo cũng
dùng được luôn. Nhưng `migrate dev` **vẫn chết**, giờ chuyển sang lỗi khác khi
diễn lại migration cũ:

```
Error: column "likeRatio" of relation "ContentItem" is a generated column
HINT: Use ALTER TABLE ... ALTER COLUMN ... DROP EXPRESSION instead.
```

Nguyên nhân: một bản migration cũ viết `ALTER COLUMN ... DROP DEFAULT` cho cột
`GENERATED ALWAYS AS ... STORED` (xem mục "Hai cột SINH TỰ ĐỘNG" bên dưới) —
cú pháp đó không hợp lệ khi Postgres diễn lại nghiêm ngặt trên database bóng,
dù trên database thật câu đó chưa từng chạy hỏng. Đã thử 2026-08-17: chạy
`migrate dev --create-only` thật để kiểm, xoá migration test ngay sau đó,
không giữ lại.

Đừng đi sửa lịch sử migration — nó vẫn sạch. Vấn đề nằm ở database bóng, không
phải database thật.

Cách làm migration mới, không đổi:

1. Sửa `prisma/schema.prisma`
2. Tự tạo thư mục `prisma/migrations/<YYYYMMDDHHMMSS>_<ten>/migration.sql`
3. Tự viết SQL vào đó
4. `npx prisma migrate deploy` rồi `npx prisma generate`

Xem hai bản gần nhất làm mẫu: `..._them_linh_vuc_khoa_hoc`,
`..._ty_le_thich_va_binh_luan`.

### Hai chỉ mục HNSW: Prisma sẽ tự ý xoá thứ nó không hiểu

`ContentEmbedding_vector_idx` và `NoteEmbedding_vector_idx` do pgvector quản lý,
Prisma không biết chúng tồn tại nên mỗi lần sinh migration nó đều định xoá đi —
**giờ pgvector đã cài, `migrate diff`/`migrate dev` THẤY được hai chỉ mục này
nên chắc chắn sẽ đề nghị xoá**, cần cảnh giác hơn trước chứ không phải bớt đi.
Viết tay thì không dính. Nếu lỡ chạy `migrate dev`/`migrate diff` thì **luôn
xoá các dòng `DROP INDEX ..._vector_idx`** trước khi áp bất cứ file nào nó sinh
ra.

Riêng cột `vector` thì đã an toàn — khai báo bằng `Unsupported("vector(1024)")`
nên Prisma giữ lại.

### Hai cột SINH TỰ ĐỘNG: đọc được, sắp xếp được, TUYỆT ĐỐI KHÔNG GHI

`ContentItem.likeRatio` và `ContentItem.commentRatio` là cột
`GENERATED ALWAYS AS ... STORED` trong PostgreSQL — database tự tính lại mỗi khi
lượt xem hay lượt thích đổi. Prisma không có cách diễn đạt điều đó nên chúng khai
trong schema như `Float?` bình thường.

Hệ quả: Prisma chỉ gửi những trường bạn truyền vào, nên đọc và `orderBy` thì an
toàn; ghi vào thì Postgres báo lỗi ngay. **Đừng bao giờ đặt hai trường này trong
`create` hay `update`.**

### Đổi cấu trúc database thì PHẢI khởi động lại máy chủ chạy thử

Đã vấp hai lần và cả hai lần đều mất thời gian đoán mò. Triệu chứng:

```
Cannot read properties of undefined (reading 'findUnique')
Unknown field `titleVi` for select statement on model `ContentClassification`
```

Nhìn thì tưởng code sai, nhưng cột vẫn có trong database và bản Prisma sinh ra
vẫn đủ trường. Nguyên nhân: `next dev` **giữ bản Prisma cũ trong bộ nhớ** từ lúc
khởi động, `prisma generate` ghi đè file trên đĩa cũng không lay chuyển được nó.

Cách sửa: vào terminal đang chạy, `Ctrl+C` rồi `npm run dev`.

Cách nhận ra ngay: nếu lỗi nhắc tới một bảng hoặc một cột **vừa mới thêm** thì
gần như chắc chắn là chuyện này, không phải code sai.

Kiểm tra tình trạng database bất cứ lúc nào:

```bash
npx tsx scripts/check-db.ts
```

Bấm thử mọi nút lọc của trang Khám phá, xem nút nào ra 0 kết quả:

```bash
npx tsx scripts/thu-bo-loc.ts
```

## Next.js

Bản Next.js dùng ở đây có thể khác với những gì bạn quen. Trước khi viết code
liên quan tới routing, server actions hay cấu hình, đọc tài liệu trong
`node_modules/next/dist/docs/` thay vì dựa vào trí nhớ.
