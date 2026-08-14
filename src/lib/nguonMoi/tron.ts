/**
 * Trộn nội dung từ nguồn quen và nguồn lạ theo tỉ lệ chủ nhà đặt.
 *
 * ĐÂY LÀ CHỖ THỰC THI CÁI NÚT TRONG CÀI ĐẶT. Đặt AI 90% thì hàng AI ở trang chủ
 * dành 90% số chỗ cho nguồn chưa theo dõi; đặt Khoa học 30% thì hàng đó chỉ
 * nhường 30%.
 *
 * ## Ba quy tắc chống rác, xếp theo mức quan trọng
 *
 * **1. Tỉ lệ là TRẦN, không phải chỉ tiêu.** Nếu tối nay chỉ có 1 bài từ nguồn
 * lạ vượt được chuẩn thì đưa 1 bài, phần còn lại trả về cho nguồn quen. Lấp cho
 * đủ số là cách chắc chắn nhất để chủ nhà nhận về rác — và chỉ cần vài đêm như
 * thế là họ thôi tin cả cái web.
 *
 * **2. Nguồn lạ phải qua cửa chặt hơn.** Với kênh đã theo dõi, việc chủ nhà bấm
 * đăng ký tự nó là một phần điểm uy tín. Nguồn lạ không có phần đó nên phải bù:
 * điểm của nó phải **không thua điểm trung vị của nhóm nguồn quen cùng chuyên
 * mục**. Không so với một ngưỡng cố định, vì điểm được chuẩn hoá theo thứ hạng
 * phần trăm nên ngưỡng cứng sẽ sai ngay khi kho thay đổi.
 *
 * **3. Mỗi nguồn lạ tối đa một suất.** Không có luật này thì một kênh chăm đăng
 * sẽ chiếm sạch phần dành cho nguồn mới, và "mở rộng" hoá ra chỉ là đổi từ nhai
 * lại kênh cũ sang nhai lại đúng một kênh mới.
 */

import type { ContentGroup, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

import { docTyLeMotChuyenMuc, soSuatChoNguonMoi } from "./tyLe";

/** Mỗi nguồn lạ được mấy suất trong một lần lấy. */
const SUAT_MOI_NGUON_LA = 1;

/**
 * Lấy nhiều hơn số cần khi truy vấn nguồn lạ.
 *
 * Vì hai bộ lọc phía sau — chặn theo điểm trung vị và chặn trùng nguồn — sẽ
 * gạt bớt kha khá. Lấy sát số cần thì gạt xong không còn gì.
 */
const LAY_DU_RA = 5;

export interface KetQuaTron<T> {
  cacMuc: T[];
  /** Trong đó bao nhiêu mục đến từ nguồn chưa theo dõi */
  soTuNguonLa: number;
  /** Đáng lẽ được mấy suất theo tỉ lệ đã đặt */
  suatDanhChoNguonLa: number;
}

/** Điểm trung vị của một danh sách đã có điểm. */
function trungVi(cacDiem: number[]): number | null {
  if (cacDiem.length === 0) return null;
  const sapXep = [...cacDiem].sort((a, b) => a - b);
  const giua = Math.floor(sapXep.length / 2);
  return sapXep.length % 2 === 0
    ? ((sapXep[giua - 1] ?? 0) + (sapXep[giua] ?? 0)) / 2
    : (sapXep[giua] ?? 0);
}

interface CoDiemVaNguon {
  id: string;
  score: { compositeScore: number | null } | null;
  source: { id: string; subscriptionStatus: string };
}

/**
 * Lấy nội dung một chuyên mục, đã trộn theo tỉ lệ.
 *
 * @param dieuKienChung Điều kiện lọc sẵn có của chuyên mục (đã gồm lọc lịch sử
 *   xem, lọc truyện AI, v.v.)
 * @param truongCanLay  Các trường cần lấy — truyền vào để hàm này dùng lại được
 *   cho cả trang chủ lẫn bản tin, vốn cần bộ trường khác nhau
 */
export async function layTronTheoTyLe<T extends CoDiemVaNguon>(
  nhom: ContentGroup,
  dieuKienChung: Prisma.ContentItemWhereInput,
  truongCanLay: Prisma.ContentItemSelect,
  soSuat: number,
): Promise<KetQuaTron<T>> {
  const tyLe = await docTyLeMotChuyenMuc(nhom);
  const suatChoLa = soSuatChoNguonMoi(soSuat, tyLe);

  const xepTheoDiem: Prisma.ContentItemOrderByWithRelationInput[] = [
    { score: { compositeScore: { sort: "desc", nulls: "last" } } },
    { publishedAt: "desc" },
  ];

  // ----- Nguồn quen -----
  const quen = (await prisma.contentItem.findMany({
    where: {
      AND: [dieuKienChung, { source: { subscriptionStatus: "subscribed" } }],
    },
    select: truongCanLay,
    orderBy: xepTheoDiem,
    take: soSuat,
  })) as unknown as T[];

  if (suatChoLa === 0) {
    return { cacMuc: quen, soTuNguonLa: 0, suatDanhChoNguonLa: 0 };
  }

  // ----- Cửa chặn: điểm trung vị của nhóm nguồn quen -----
  const diemQuen = quen
    .map((m) => m.score?.compositeScore)
    .filter((d): d is number => typeof d === "number");
  const cuaChan = trungVi(diemQuen);

  // ----- Nguồn lạ -----
  const la = (await prisma.contentItem.findMany({
    where: {
      AND: [
        dieuKienChung,
        { source: { subscriptionStatus: { not: "subscribed" } } },
        // Chưa chấm điểm thì chưa đủ căn cứ để chen vào chỗ của nguồn quen
        cuaChan !== null
          ? { score: { compositeScore: { gte: cuaChan } } }
          : { score: { isNot: null } },
      ],
    },
    select: truongCanLay,
    orderBy: xepTheoDiem,
    take: suatChoLa + LAY_DU_RA,
  })) as unknown as T[];

  // Mỗi nguồn lạ tối đa một suất
  const daLayTuNguon = new Map<string, number>();
  const laDaLoc: T[] = [];
  for (const muc of la) {
    const dem = daLayTuNguon.get(muc.source.id) ?? 0;
    if (dem >= SUAT_MOI_NGUON_LA) continue;
    daLayTuNguon.set(muc.source.id, dem + 1);
    laDaLoc.push(muc);
    if (laDaLoc.length >= suatChoLa) break;
  }

  // ----- Ghép lại -----
  //
  // Phần nguồn lạ thiếu bao nhiêu thì trả lại cho nguồn quen — đây chính là chỗ
  // "trần chứ không phải chỉ tiêu" thành hiện thực.
  const soLayTuQuen = soSuat - laDaLoc.length;
  const idLa = new Set(laDaLoc.map((m) => m.id));

  const ghep = [
    ...laDaLoc,
    ...quen.filter((m) => !idLa.has(m.id)).slice(0, soLayTuQuen),
  ];

  // Xếp lại theo điểm để hàng thẻ vẫn cái hay nhất trước, chứ không phải nguồn
  // lạ luôn đứng đầu chỉ vì nó là nguồn lạ
  ghep.sort(
    (a, b) => (b.score?.compositeScore ?? -1) - (a.score?.compositeScore ?? -1),
  );

  return {
    cacMuc: ghep,
    soTuNguonLa: laDaLoc.length,
    suatDanhChoNguonLa: suatChoLa,
  };
}
