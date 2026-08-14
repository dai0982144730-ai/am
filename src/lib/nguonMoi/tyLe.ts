/**
 * Tỉ lệ nguồn mới của từng chuyên mục — đọc và mặc định.
 *
 * VÌ SAO ĐẶT RIÊNG TỪNG CHUYÊN MỤC: nhu cầu mở rộng khác nhau hẳn theo chủ đề.
 * Mảng AI đổi từng tuần nên đáng ra ngoài vùng đã theo dõi thật nhiều; mảng
 * khoa học thì nguồn tốt vốn ít và ổn định, mở rộng nhiều chỉ tổ rước tin giật
 * gân về. Một con số chung cho cả web thì luôn sai ở đâu đó.
 */

import type { ContentGroup } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db/prisma";

/**
 * Chuyên mục nào có nút chỉnh tỉ lệ.
 *
 * `other` không có mặt: đó là sọt chứa mọi thứ không thuộc đâu, chẳng ai muốn
 * mở rộng nó. `new_search` cũng không: chuyên mục ấy **toàn bộ** là nguồn mới
 * theo đúng định nghĩa — chủ nhà gõ từ khoá để tìm ra ngoài vùng quen.
 */
export const CHUYEN_MUC_CHINH_DUOC: {
  ma: ContentGroup;
  ten: string;
  goiY: string;
}[] = [
  {
    ma: "ai",
    ten: "AI",
    goiY: "Mảng đổi nhanh nhất, nguồn hay mọc lên liên tục — để cao thì hợp",
  },
  {
    ma: "khoa_hoc",
    ten: "Khoa học",
    goiY: "Nguồn tốt vốn ít và ổn định; mở rộng nhiều dễ rước tin giật gân",
  },
  {
    ma: "triet_hoc",
    ten: "Triết học",
    goiY: "Giọng giảng hợp tai là thứ rất riêng, đổi nguồn nhiều thường hụt",
  },
  {
    ma: "truyen",
    ten: "Truyện",
    goiY: "Rủi ro cao nhất — truyện do AI viết hàng loạt tràn lan ở nguồn lạ",
  },
  {
    ma: "music",
    ten: "Music",
    goiY: "Nghe thử một bài là biết ngay, sai cũng chẳng mất gì — để cao được",
  },
];

/** Chưa đặt gì thì dùng số này. */
export const TY_LE_MAC_DINH = 30;

export type TyLeTheoChuyenMuc = Record<string, number>;

/** Đọc tỉ lệ của mọi chuyên mục, thiếu thì điền mặc định. */
export async function docTyLeNguonMoi(): Promise<TyLeTheoChuyenMuc> {
  const daLuu = await prisma.categoryDiscoverySetting.findMany({
    select: { contentGroup: true, newSourceRatio: true },
  });

  const theoMa = new Map(daLuu.map((d) => [d.contentGroup, d.newSourceRatio]));

  return Object.fromEntries(
    CHUYEN_MUC_CHINH_DUOC.map((m) => [
      m.ma,
      theoMa.get(m.ma) ?? TY_LE_MAC_DINH,
    ]),
  );
}

/** Tỉ lệ của một chuyên mục. */
export async function docTyLeMotChuyenMuc(
  nhom: ContentGroup,
): Promise<number> {
  const daLuu = await prisma.categoryDiscoverySetting.findUnique({
    where: { contentGroup: nhom },
    select: { newSourceRatio: true },
  });
  return daLuu?.newSourceRatio ?? TY_LE_MAC_DINH;
}

/**
 * Bao nhiêu suất trong `tongSuat` được dành cho nguồn mới.
 *
 * Làm tròn xuống có chủ đích: 3 suất với tỉ lệ 90% ra 2 suất nguồn mới chứ
 * không phải 3, để chuyên mục nào cũng còn ít nhất một suất cho nguồn quen.
 * Đặt 100% thì mới lấy hết — lúc đó là chủ nhà cố ý.
 */
export function soSuatChoNguonMoi(tongSuat: number, tyLe: number): number {
  if (tyLe >= 100) return tongSuat;
  return Math.floor((tongSuat * tyLe) / 100);
}
