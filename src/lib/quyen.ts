/**
 * Phân quyền: ai xem được gì, ai làm được gì.
 *
 * Chủ dự án chốt (2026-08-14): **người lạ vẫn xem được nội dung**, nhưng không
 * đụng được vào hai nhóm việc:
 *
 *   1. **Cấu hình** — chỉnh trọng số chấm điểm, thêm nguồn, sửa cài đặt
 *   2. **Việc có gọi Claude** — phân loại, thuật lại, đọc bình luận
 *
 * Lý do tách đúng hai nhóm đó: nhóm một đổi cách cả hệ thống hoạt động, nhóm
 * hai tiêu hạn mức của gói Claude Pro mà chủ dự án đang trả tiền. Còn việc xem
 * thì không tốn gì và không hỏng gì.
 *
 * Đây KHÔNG phải hệ thống phân quyền nhiều vai trò — chỉ có đúng hai trạng
 * thái: là chủ dự án, hoặc là khách. `CLAUDE.md` nói rõ đừng dựng hệ thống tài
 * khoản cho app dùng riêng một người.
 */

import { auth } from "@/auth";

/** Lỗi ném ra khi khách cố làm việc chỉ chủ dự án được làm. */
export class ChuaDangNhap extends Error {
  constructor(viec: string) {
    super(
      `Cần đăng nhập mới ${viec} được. Việc này ${
        viec.includes("Claude") || viec.includes("phân loại")
          ? "tiêu hạn mức của gói Claude Pro"
          : "thay đổi cách cả hệ thống hoạt động"
      }, nên chỉ chủ dự án làm được.`,
    );
    this.name = "ChuaDangNhap";
  }
}

/** Người đang xem có phải chủ dự án không. */
export async function laChuDuAn(): Promise<boolean> {
  const phien = await auth();
  return Boolean(phien?.user?.email);
}

/**
 * Chặn cửa cho các việc chỉ chủ dự án được làm.
 *
 * Gọi ở đầu mọi server action và tuyến API có đụng tới cấu hình hoặc gọi
 * Claude. Ném lỗi khi chưa đăng nhập.
 *
 * @param viec Mô tả việc đang làm, dùng để viết thông báo dễ hiểu
 */
export async function doiHoiChuDuAn(viec: string): Promise<void> {
  if (!(await laChuDuAn())) throw new ChuaDangNhap(viec);
}

/** Email chủ dự án đang đăng nhập, hoặc `null` nếu là khách. */
export async function emailChuDuAn(): Promise<string | null> {
  const phien = await auth();
  return phien?.user?.email ?? null;
}
