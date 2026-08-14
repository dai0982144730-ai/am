/**
 * Bộ lọc "chưa lướt qua" — dùng chung cho trang chủ, Khám phá và New.
 *
 * VẤN ĐỀ CẦN GIẢI: lướt YouTube mãi không hết là vì thứ đã xem vẫn cứ hiện lại.
 * Ở đây, **bấm vào xem là nội dung rời khỏi luồng chính ngay**, chuyển sang
 * Lịch sử. Lần sau lướt là danh sách toàn thứ mới, và nó thật sự vơi đi.
 *
 * NGOẠI LỆ: thứ đã cất vào thư viện thì vẫn hiện. Cất vào thư viện là nói "tôi
 * còn muốn quay lại cái này" — giấu nó đi thì hoá ra phạt người dùng vì đã chủ
 * động đánh dấu.
 *
 * ĐỂ MỘT CHỖ, KHÔNG CHÉP LẠI Ở TỪNG TRANG. Ba trang cùng phải lọc như nhau;
 * chép ba lần thì sớm muộn có một trang quên, và người dùng gặp lại đúng video
 * vừa xem ở một chỗ nào đó mà không hiểu vì sao.
 */

import type { Prisma } from "@/generated/prisma/client";

/**
 * Bọc một điều kiện sẵn có thêm điều kiện "chưa lướt qua".
 *
 * VÌ SAO LÀ HÀM CHỨ KHÔNG PHẢI HẰNG SỐ ĐỂ TRẢI RA: điều kiện này cần một `OR`,
 * mà `timVaLoc.ts` cũng đã dùng `OR` cho ô tìm kiếm. Trải thẳng vào thì cái sau
 * đè mất cái trước, và bộ lọc âm thầm biến mất — kiểu lỗi không báo gì, chỉ
 * lặng lẽ cho ra kết quả sai. Gói cả hai vào `AND` thì không bao giờ đụng nhau.
 */
export function chuaLuotQua(
  dieuKien: Prisma.ContentItemWhereInput,
): Prisma.ContentItemWhereInput {
  return {
    AND: [
      dieuKien,
      { OR: [{ watchHistory: { is: null } }, { libraryItem: { isNot: null } }] },
    ],
  };
}
