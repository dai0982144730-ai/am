/**
 * Ba trạng thái đọc của một mục trong thư viện.
 *
 * VÌ SAO NẰM RIÊNG: file `actions.ts` mang chỉ thị `"use server"`, mà Next chỉ
 * cho phép file đó **xuất ra hàm async**. Xuất một object hằng số từ đó làm cả
 * trang chết với lỗi 500 — đã dính một lần.
 *
 * Giữ đúng chuỗi đã có sẵn trong database (`readStatus` mặc định `"unread"`),
 * chỉ dịch sang tiếng Việt ở lớp hiển thị.
 */

export const TRANG_THAI_DOC = {
  unread: "Chưa xem",
  in_progress: "Đang xem",
  done: "Xong rồi",
} as const;

export type TrangThaiDoc = keyof typeof TRANG_THAI_DOC;
