# Am

Trợ lý cá nhân tuyển chọn và gợi ý nội dung, chạy bằng Claude.

Mỗi tối hệ thống tự quét YouTube, blog, diễn đàn, podcast và SoundCloud, đọc hiểu
nội dung, chấm điểm chất lượng, rồi sáng hôm sau đưa cho bạn vài lựa chọn đáng xem
nhất — kèm bản tin dạng trò chuyện và audio ngắn, thay vì một danh sách dài vô tận.

Đây là ứng dụng dùng riêng cho một người, không phải sản phẩm nhiều người dùng.

## Năm chuyên mục

| Chuyên mục | Nội dung |
|---|---|
| **AI** | Tin Claude và AI nói chung, AI agent cho doanh nghiệp, kinh nghiệm viết code bằng AI |
| **Triết học** | Tâm lý học (Stoic, hiện sinh, tâm lý học hiện đại) và Phật giáo Nguyên thuỷ |
| **Truyện** | Kinh dị, viễn tưởng, phiêu lưu — chỉ từ tác giả có tên tuổi |
| **Music** | Nhạc tập thể thao theo BPM, dance, piano, guitar rock, nhạc vàng |
| **New** | Chuyên mục mở — tự gõ chủ đề muốn tìm, thay đổi theo ngày |

## Vì sao cần

- **Chất lượng là bài toán khó nhất.** Lọc theo chủ đề thì dễ; khó là giữa hàng chục
  kết quả cùng chủ đề, cái nào thực sự hay. Mỗi loại nguồn lại có bộ chỉ số khác nhau —
  YouTube có lượt xem và bình luận, diễn đàn có upvote, còn blog và podcast gần như
  không có chỉ số công khai nào.
- **Truyện do AI viết hàng loạt** đang tràn ngập và rất khó phân biệt bằng mắt thường.
- **Tin AI tiếng Việt chậm hơn nguồn phương Tây** — nên hệ thống đọc thẳng blog gốc
  và thuật lại đầy đủ bằng audio tiếng Việt.

## Tài liệu

- [`docs/plan.md`](docs/plan.md) — bản thiết kế đầy đủ: cấu trúc dữ liệu, cách chấm
  điểm chất lượng theo từng nguồn, lộ trình triển khai
- [`docs/demo-ui.html`](docs/demo-ui.html) — demo giao diện, mở thẳng bằng trình duyệt
  (có nút chuyển giữa bản máy tính và bản điện thoại)

## Bắt đầu trên một máy mới

```bash
npm install
cp .env.example .env    # rồi mở .env và điền các khoá API
npx prisma migrate dev
npm run dev
```

Mở http://localhost:3000

> **Lưu ý:** file `.env` chứa khoá API và không nằm trong Git. Trên mỗi máy bạn phải
> tạo file này một lần. Cách an toàn nhất là vào console của Anthropic/Google tạo một
> khoá riêng cho từng máy, thay vì chép khoá qua lại.

## Làm việc trên hai máy

Dự án này được dùng trên cả PC ở nhà lẫn laptop ở công ty. Quy tắc duy nhất:

- **Bắt đầu làm** → `git pull`
- **Kết thúc** → `git add -A && git commit -m "..." && git push`

Cơ sở dữ liệu đặt trên mạng (Neon) nên cả hai máy dùng chung một kho dữ liệu — nội
dung quét được ở nhà vẫn thấy khi mở ở công ty.

## Công nghệ

Next.js (App Router) · Prisma · PostgreSQL + pgvector · Claude API · Tailwind CSS
