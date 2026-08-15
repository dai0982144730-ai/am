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
import { prisma } from "@/lib/db/prisma";

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

/** Lịch sử chỉ giữ ngần này ngày — chủ dự án chốt 2026-08-15. */
export const SO_NGAY_GIU_LICH_SU = 7;

/**
 * Đọc lịch sử xem trong một tuần, tách sẵn thành "hôm nay" và "trước đó".
 *
 * ĐẶT Ở ĐÂY CHỨ KHÔNG ĐẶT TRONG TRANG, có lý do thật chứ không phải cho gọn:
 * gọi `Date.now()` ngay lúc vẽ trang là tác dụng phụ đặt sai chỗ, và ESLint
 * chặn thẳng — Next có thể vẽ lại một trang bất cứ lúc nào, kể cả lúc chỉ tải
 * trước, nên thứ phụ thuộc vào "bây giờ là mấy giờ" phải nằm ngoài phần vẽ.
 *
 * Ở đây chỉ LỌC ĐỂ HIỆN. Việc xoá thật nằm trong lượt quét đêm.
 */
export async function docLichSuMotTuan() {
  const moc = new Date(Date.now() - SO_NGAY_GIU_LICH_SU * 86_400_000);

  // Mốc "hôm nay" là 0 giờ sáng nay theo giờ máy, không phải "24 tiếng vừa
  // qua". Xem lúc 23h tối qua thì sáng nay phải nằm ở cột "trước đó" — đó mới
  // là cách người ta nghĩ về ngày.
  const dauHomNay = new Date();
  dauHomNay.setHours(0, 0, 0, 0);

  const cacMuc = await prisma.watchHistory.findMany({
    where: { lastOpenedAt: { gte: moc } },
    orderBy: { lastOpenedAt: "desc" },
    take: 200,
    select: {
      lastOpenedAt: true,
      openCount: true,
      contentItem: {
        select: {
          id: true,
          title: true,
          thumbnailUrl: true,
          durationSeconds: true,
          contentGroup: true,
          source: { select: { title: true } },
          score: { select: { compositeScore: true } },
          libraryItem: { select: { id: true } },
        },
      },
    },
  });

  return {
    tatCa: cacMuc,
    homNay: cacMuc.filter((m) => m.lastOpenedAt >= dauHomNay),
    truocDo: cacMuc.filter((m) => m.lastOpenedAt < dauHomNay),
  };
}
