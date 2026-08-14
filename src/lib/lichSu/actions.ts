"use server";

/**
 * Ghi lại việc đã mở một nội dung ra xem.
 *
 * KHÁC `tieuThu/actions.ts` Ở CHỖ NÀO: bên kia chỉ ghi khi thật sự **bấm phát**,
 * và dùng để hiểu gu. Bên này ghi mọi lần **mở ra**, kể cả bài viết không có
 * trình phát, kể cả bấm nhầm rồi thoát ngay — và dùng cho đúng một việc: lần
 * sau đừng bày lại nữa.
 *
 * Hai thứ phải tách nhau. Gộp lại thì hoặc mỗi cú bấm nhầm thành một lượt xem
 * làm sai hồ sơ gu, hoặc mở rồi thoát vẫn cứ hiện lại mãi.
 */

import { prisma } from "@/lib/db/prisma";
import { laChuDuAn } from "@/lib/quyen";

/**
 * Đánh dấu đã mở.
 *
 * Không ném lỗi ra ngoài: đây là việc chạy ngầm lúc người dùng vừa mở trang,
 * hỏng thì im lặng bỏ qua chứ không được làm hỏng việc xem.
 *
 * Khách không bị ghi gì — lịch sử là của chủ nhà, và nếu ghi cả lượt của người
 * lạ thì nội dung sẽ biến khỏi trang chủ của chủ nhà vì một người khác đã mở.
 */
export async function ghiDaMo(idNoiDung: string): Promise<void> {
  if (!(await laChuDuAn())) return;

  try {
    await prisma.watchHistory.upsert({
      where: { contentItemId: idNoiDung },
      create: { contentItemId: idNoiDung },
      update: { lastOpenedAt: new Date(), openCount: { increment: 1 } },
    });
  } catch {
    // Mất một dòng lịch sử không đáng để làm hỏng buổi xem
  }
}

export interface KetQua {
  ok: boolean;
  thongDiep: string;
}

/**
 * Bỏ một mục khỏi lịch sử — nó sẽ hiện lại ở luồng chính.
 *
 * Cần có, vì cơ chế "xem là ẩn" rất dễ nuốt nhầm: bấm vào rồi nhận ra chưa muốn
 * xem bây giờ, thế là mất hút. Không có nút này thì cách duy nhất lấy lại là đi
 * tìm trong lịch sử — được, nhưng phiền.
 */
export async function boKhoiLichSu(idNoiDung: string): Promise<KetQua> {
  if (!(await laChuDuAn())) {
    return { ok: false, thongDiep: "Cần đăng nhập." };
  }

  await prisma.watchHistory.deleteMany({ where: { contentItemId: idNoiDung } });

  return { ok: true, thongDiep: "Đã trả lại luồng chính." };
}

/** Xoá sạch lịch sử. Nội dung trong kho không mất gì. */
export async function xoaSachLichSu(): Promise<KetQua> {
  if (!(await laChuDuAn())) {
    return { ok: false, thongDiep: "Cần đăng nhập." };
  }

  const kq = await prisma.watchHistory.deleteMany({});

  return {
    ok: true,
    thongDiep: `Đã xoá ${kq.count} mục khỏi lịch sử. Chúng sẽ hiện lại ở trang chủ.`,
  };
}
