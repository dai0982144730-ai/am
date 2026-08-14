/**
 * Giá của một từ khoá, tính bằng đơn vị hạn mức YouTube.
 *
 * VÌ SAO TÁCH RA MỘT FILE RIÊNG CHỈ ĐỂ CHỨA HAI CON SỐ: giao diện phía trình
 * duyệt cần đọc chúng để hiện bảng chi phí. Nếu để chung trong `quetTuKhoa.ts`
 * thì mỗi lần trình duyệt lấy hai con số này, nó kéo theo cả prisma và toàn bộ
 * lớp gọi YouTube vào gói tải về — thứ vừa nặng vừa không được phép chạy ở phía
 * người dùng.
 */

import { GIA_LENH } from "@/lib/youtube/giaLenh";

/** Giá một lần quét một từ khoá. */
export const GIA_MOT_TU_KHOA: number = GIA_LENH["search.list"];

/**
 * Quá ngần này từ khoá đang bật thì cảnh báo.
 *
 * 10 từ khoá = 1.000 đơn vị = 10% hạn mức ngày. Trên mức đó thì phần quét kênh
 * bắt đầu bị bóp, mà đó mới là việc chính.
 */
export const NGUONG_CANH_BAO_TU_KHOA = 10;
