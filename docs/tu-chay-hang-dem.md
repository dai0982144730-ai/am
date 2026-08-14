# Để máy tự quét mỗi tối

Trước đây mỗi tối phải mở terminal gõ sáu lệnh riêng lẻ, đúng thứ tự. Giờ chỉ
còn **một lệnh**, và có thể hẹn giờ để máy tự chạy.

## Chạy tay một lần

```bash
npx tsx scripts/quet-dem.ts
```

Lệnh này tự làm đủ bảy bước theo đúng thứ tự:

1. Quét video mới từ các kênh YouTube đã đăng ký
2. Quét bài mới từ blog và diễn đàn AI
3. Lấy lời thoại cho video mới
4. Nhờ Claude phân loại vào chuyên mục
5. Thuật lại bài nước ngoài sang tiếng Việt
6. Chấm điểm chất lượng (vòng 1, bằng số liệu)
7. Claude đọc bình luận nhóm đứng đầu (vòng 2), rồi chấm lại

**Một bước hỏng không làm chết cả đêm.** Mạng chập chờn, YouTube đổi API, hết
hạn mức — đều là chuyện thường. Bước nào hỏng thì ghi lại, các bước sau vẫn chạy
tiếp với dữ liệu đang có.

Mất khoảng **20–40 phút** tuỳ số nội dung mới.

## Hẹn giờ cho máy tự chạy lúc 21:00

Mở **PowerShell với quyền quản trị** rồi chạy:

```powershell
schtasks /create /tn "Am - quet dem" /tr "C:\Users\Admin\am\scripts\quet-dem.cmd" /sc daily /st 21:00 /f
```

Xong. Từ tối mai máy tự chạy, sáng dậy đã có nội dung mới.

Kiểm tra lịch đã đặt:

```powershell
schtasks /query /tn "Am - quet dem"
```

Chạy thử ngay không cần chờ tới 21:00:

```powershell
schtasks /run /tn "Am - quet dem"
```

Bỏ lịch:

```powershell
schtasks /delete /tn "Am - quet dem" /f
```

### Máy phải bật mới chạy được

Task Scheduler chỉ chạy khi máy đang bật (hoặc đang ngủ, nếu bật tuỳ chọn đánh
thức). Máy tắt hẳn lúc 21:00 thì đêm đó bỏ qua — nhưng không mất gì: đêm sau nó
quét bù, vì mọi bước đều bỏ qua thứ đã làm rồi.

## Xem lại đêm qua chạy thế nào

Nhật ký ghi vào `logs/quet-dem-<ngày>.txt`.

Hoặc xem trong database — mỗi đêm một dòng ở bảng `JobRun`:

```bash
npx tsx scripts/check-db.ts
```

Ba trạng thái:

| Trạng thái | Nghĩa |
|---|---|
| `success` | Cả bảy bước đều xong |
| `partial` | Vài bước hỏng, phần còn lại vẫn chạy — kho vẫn đầy thêm |
| `failed` | Hỏng hẳn |

Chạy hai lần trong cùng một ngày **không tạo hai bản ghi** — dùng khoá theo ngày
nên chạy lại an toàn.

## Khi triển khai lên máy chủ

Trên máy chủ thì không dùng Task Scheduler được. Lúc đó gọi tuyến
`POST /api/v1/../api/cron/quet-dem` bằng dịch vụ hẹn giờ bên ngoài (Vercel Cron,
cron-job.org…), kèm khoá bí mật:

```bash
curl -X POST https://<địa-chỉ-web>/api/cron/quet-dem \
  -H "Authorization: Bearer <giá trị KHOA_CRON trong .env>"
```

Sinh khoá bằng:

```bash
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```

rồi điền vào dòng `KHOA_CRON` trong `.env`. Chưa đặt thì tuyến này bị khoá hẳn,
trả về mã 503 — an toàn hơn là để mở.

## Chỉnh lượng việc mỗi đêm

Các giới hạn nằm ở đầu file `src/lib/vanHanh/quetDem.ts`:

| Giới hạn | Mặc định | Ý nghĩa |
|---|---|---|
| `videoMoiKenh` | 8 | Số video xét mỗi kênh |
| `soNgayGanDay` | 3 | Chỉ lấy nội dung đăng trong ngần này ngày |
| `soLoiThoai` | 120 | Số video lấy lời thoại |
| `soPhanLoai` | 80 | Số nội dung nhờ Claude phân loại |
| `soThuatLai` | 5 | Số bài viết thuật lại sang tiếng Việt |
| `soDocBinhLuan` | 20 | Số ứng viên đứng đầu được đọc bình luận |

Đặt vừa phải có chủ đích: quét hết mọi thứ trong một đêm sẽ chạm hạn mức YouTube
(10.000 đơn vị/ngày) và hạn mức gói Claude Pro. Phần chưa xử lý hết sẽ được làm
nốt vào đêm sau — kho vẫn đầy dần, chỉ là từ tốn.
