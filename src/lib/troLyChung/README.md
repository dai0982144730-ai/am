# Bộ dùng chung cho Cổng API trợ lý

> **Thư mục này được chép nguyên sang cả ba trang** (`am`, `tiendo`, `phaply`).
> Sửa ở một trang thì phải chép sang hai trang còn lại.

## Vì sao chép tay chứ không làm thư viện npm

Đã cân nhắc ba cách, chọn cách đơn giản nhất:

| Cách | Vì sao không chọn |
|---|---|
| Gộp cả ba trang vào một repo (monorepo) | Chủ dự án đã chốt ba trang **tách rời**. Gộp lại là đảo lộn cả ba dự án đang chạy để lấy một lợi ích nhỏ. |
| Đóng gói thành package npm nội bộ | Phải dựng nơi chứa package riêng, phải đánh phiên bản, mỗi lần sửa một dòng là phải phát hành lại rồi cập nhật ở ba nơi. Nặng hơn cả vấn đề nó giải quyết. |
| **Chép thư mục này giữa ba repo** ✅ | Không cần hạ tầng gì. Đổi lại phải nhớ chép — nhưng thư mục này rất ít thay đổi (nó chỉ là hợp đồng giao tiếp, mà hợp đồng thì cả điểm là phải ổn định). |

Nếu sau này ba trang gộp về một repo thì chuyển thành thư mục dùng chung thật,
lúc đó không phải sửa một dòng code nào — chỉ đổi đường dẫn `import`.

## Có gì trong này

| File | Việc |
|---|---|
| `kieuDuLieu.ts` | Định nghĩa khung câu trả lời chuẩn. **Đây là hợp đồng với app Android** |
| `xacThucTokenTroLy.ts` | Kiểm tra `Authorization: Bearer`, giới hạn tần suất gọi |
| `phanHoi.ts` | Vỏ chung cho mọi tuyến: xác thực → đo giờ → bắt lỗi → ghi nhật ký |
| `chuanHoaDeDoc.ts` | Bỏ markdown, thay URL, đọc viết tắt và số thành lời |
| `vietTat.ts` | Bảng từ viết tắt. **Mỗi trang có bảng riêng của mình** |
| `docSo.ts` | Đọc số thành chữ tiếng Việt (mười lăm, hai mươi mốt, hai mươi tư…) |

## Chép sang trang khác cần đổi gì

Chỉ hai chỗ:

1. **`kieuDuLieu.ts`** — đổi `TEN_TRANG` thành `"tiendo"` hoặc `"phaply"`.
2. **`vietTat.ts`** — thay `VIET_TAT_AM` bằng bảng viết tắt của trang đó.
   `VIET_TAT_CHUNG` giữ nguyên. Ví dụ `tiendo` cần `EPC`, `GPMB`, `PPA`; `phaply`
   cần thêm cách đọc số hiệu văn bản (`15/2021/NĐ-CP`).

Bốn file còn lại chép nguyên xi, không sửa gì.

## Quy ước quan trọng — tên công cụ phải khác nhau giữa ba trang

App Android gom danh sách công cụ của cả ba trang thành một danh sách duy nhất
rồi đưa cho Claude. Hai công cụ trùng tên là hỏng: Claude sẽ không biết gọi cái
của trang nào.

Nên mọi tên công cụ đều mở đầu bằng tên trang:

```
am_timKiem        tiendo_timKiem        phaply_timKiem
am_layNoiDung     tiendo_layNoiDung     phaply_layNoiDung
am_tomTatHomNay   tiendo_canhBao        phaply_vanBanMoi
```
