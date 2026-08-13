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

## Cạm bẫy đã gặp — đọc trước khi chạy migration

**Prisma sẽ tự ý xoá thứ nó không hiểu.** Hai chỉ mục HNSW cho tìm kiếm ngữ nghĩa
(`ContentEmbedding_vector_idx`, `NoteEmbedding_vector_idx`) do pgvector quản lý,
Prisma không biết chúng tồn tại nên **mỗi lần `prisma migrate dev` nó đều định
xoá đi**.

Cách xử lý khi tạo migration mới:

1. Dùng `prisma migrate dev --create-only` để chỉ tạo file, chưa chạy
2. Mở file `migration.sql` vừa tạo, **xoá các dòng `DROP INDEX ..._vector_idx`**
3. Chạy `prisma migrate deploy` để áp dụng

Riêng cột `vector` thì đã an toàn — đã khai báo bằng `Unsupported("vector(1024)")`
trong schema nên Prisma giữ lại.

Kiểm tra nhanh tình trạng database bất cứ lúc nào:

```bash
npx tsx scripts/check-db.ts
```

## Next.js

Bản Next.js dùng ở đây có thể khác với những gì bạn quen. Trước khi viết code
liên quan tới routing, server actions hay cấu hình, đọc tài liệu trong
`node_modules/next/dist/docs/` thay vì dựa vào trí nhớ.
