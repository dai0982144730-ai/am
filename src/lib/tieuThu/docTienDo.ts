/**
 * Đọc tình trạng xem — dùng cho các trang phía server.
 *
 * Tách khỏi `actions.ts` vì file kia là `"use server"`: mọi hàm xuất ra từ đó
 * đều thành một điểm gọi từ trình duyệt vào được. Hàm chỉ để đọc thì không có
 * lý do gì phải phơi ra như vậy.
 *
 * Khách xem thì mọi thứ đều trả về rỗng — họ không có lịch sử, và cũng không
 * được nhìn thấy lịch sử của chủ nhà.
 */

import { prisma } from "@/lib/db/prisma";
import { laChuDuAn } from "@/lib/quyen";

export interface TinhTrangXem {
  /** Giây đang dở, `0` nghĩa là chưa xem hoặc đã xem xong */
  viTriDangDo: number;
  /** Số lần đã xem hết */
  soLanDaXem: number;
  /** Số sao đã chấm lần gần nhất */
  saoDaCham: number | null;
  /** Tag cảm xúc đã gắn lần gần nhất */
  tagCamXuc: string[];
}

const RONG: TinhTrangXem = {
  viTriDangDo: 0,
  soLanDaXem: 0,
  saoDaCham: null,
  tagCamXuc: [],
};

/** Tình trạng xem của một nội dung. */
export async function docTinhTrangXem(
  idNoiDung: string,
): Promise<TinhTrangXem> {
  if (!(await laChuDuAn())) return RONG;

  const [choDangDo, soLanDaXem, danhGiaGanNhat] = await Promise.all([
    prisma.resumePoint.findUnique({
      where: { contentItemId: idNoiDung },
      select: { positionSeconds: true },
    }),
    prisma.consumptionSession.count({
      where: { contentItemId: idNoiDung, completed: true },
    }),
    prisma.consumptionSession.findFirst({
      where: {
        contentItemId: idNoiDung,
        OR: [{ explicitRating: { not: null } }, { emotionTags: { isEmpty: false } }],
      },
      orderBy: { startedAt: "desc" },
      select: { explicitRating: true, emotionTags: true },
    }),
  ]);

  return {
    viTriDangDo: choDangDo?.positionSeconds ?? 0,
    soLanDaXem,
    saoDaCham: danhGiaGanNhat?.explicitRating ?? null,
    tagCamXuc: danhGiaGanNhat?.emotionTags ?? [],
  };
}

export interface MucDangDo {
  id: string;
  title: string;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  contentGroup: string;
  viTriGiay: number;
  /** Phần trăm đã đi qua, để vẽ thanh tiến độ */
  phanTram: number;
  capNhatLuc: Date;
  tenNguon: string;
}

/**
 * Danh sách đang xem dở, mới nhất trước.
 *
 * Đây là thứ làm cho việc đồng bộ hai máy có ích thật: mở web lên trên điện
 * thoại là thấy ngay cái đang bỏ dở trên máy tính, không phải đi tìm lại.
 */
export async function docDangXemDo(soMuc = 6): Promise<MucDangDo[]> {
  if (!(await laChuDuAn())) return [];

  const cacCho = await prisma.resumePoint.findMany({
    orderBy: { updatedAt: "desc" },
    take: soMuc,
    select: {
      positionSeconds: true,
      updatedAt: true,
      contentItem: {
        select: {
          id: true,
          title: true,
          thumbnailUrl: true,
          durationSeconds: true,
          contentGroup: true,
          source: { select: { title: true } },
        },
      },
    },
  });

  return cacCho.map((cho) => ({
    id: cho.contentItem.id,
    title: cho.contentItem.title,
    thumbnailUrl: cho.contentItem.thumbnailUrl,
    durationSeconds: cho.contentItem.durationSeconds,
    contentGroup: cho.contentItem.contentGroup,
    tenNguon: cho.contentItem.source.title,
    viTriGiay: cho.positionSeconds,
    phanTram: cho.contentItem.durationSeconds
      ? Math.min(100, (cho.positionSeconds / cho.contentItem.durationSeconds) * 100)
      : 0,
    capNhatLuc: cho.updatedAt,
  }));
}
