# Am — hướng dẫn cho Claude Code

Đọc file này đầu mỗi phiên để nắm bối cảnh. Dự án được làm trên **hai máy**
(PC ở nhà và máy ở văn phòng) thông qua GitHub, nên trạng thái công việc phải
luôn được ghi lại trong repo chứ không nằm trong trí nhớ của một phiên.

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

**pgvector chưa có trên bản này.** Bản Windows không kèm sẵn, mà hiện cũng chưa
dùng tới: hai bảng embedding đều 0 dòng và không code nào đụng tới. Tới Phase 9
(cá nhân hoá) mới phải lo — khi đó cần cài pgvector rồi tạo lại hai cột `vector`
cùng hai chỉ mục HNSW. `scripts/check-db.ts` biết phân biệt "chưa cài pgvector"
với "cài rồi mà mất chỉ mục", nên đừng hoảng khi thấy nó báo chưa có.

## Cạm bẫy đã gặp — đọc trước khi chạy migration

### Trên máy này, `prisma migrate dev` KHÔNG DÙNG ĐƯỢC. Viết migration bằng tay.

Lệnh đó dựng một **database bóng** rồi diễn lại toàn bộ migration từ đầu để dò
sai lệch. Bản Postgres rời trên máy này không có pgvector, database bóng cũng
vậy, nên nó chết ngay ở bản `20260813163633_them_pgvector`:

```
Error: extension "vector" is not available
```

Đừng đi sửa lịch sử migration — nó vẫn sạch (14 bản, 14 file, không bản nào lỗi).
Vấn đề nằm ở database bóng, không phải database thật.

Cách làm migration mới:

1. Sửa `prisma/schema.prisma`
2. Tự tạo thư mục `prisma/migrations/<YYYYMMDDHHMMSS>_<ten>/migration.sql`
3. Tự viết SQL vào đó
4. `npx prisma migrate deploy` rồi `npx prisma generate`

Xem hai bản gần nhất làm mẫu: `..._them_linh_vuc_khoa_hoc`,
`..._ty_le_thich_va_binh_luan`.

### Hai chỉ mục HNSW: Prisma sẽ tự ý xoá thứ nó không hiểu

`ContentEmbedding_vector_idx` và `NoteEmbedding_vector_idx` do pgvector quản lý,
Prisma không biết chúng tồn tại nên mỗi lần sinh migration nó đều định xoá đi.
Viết tay thì không dính, nhưng nếu có lúc nào chạy được `migrate dev` (ví dụ trên
máy có pgvector) thì **nhớ xoá các dòng `DROP INDEX ..._vector_idx`** trước khi áp.

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
