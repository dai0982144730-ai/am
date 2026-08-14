"use server";

/**
 * Thư viện cá nhân — thứ chủ nhà tự tay cất lại để xem sau.
 *
 * KHÁC VỚI "ĐANG XEM DỞ" Ở CHỖ NÀO: chỗ đang dở là máy tự ghi, phản ánh việc đã
 * xảy ra. Thư viện là chủ nhà chủ động chọn, phản ánh ý định. Một video xem dở
 * mười phút rồi bỏ hẳn vẫn nằm trong "đang xem dở"; chỉ thứ được cất vào thư
 * viện mới là thứ thật sự muốn quay lại.
 *
 * Chỉ chủ dự án dùng được — thư viện là của riêng một người, và web này làm
 * riêng cho một người.
 */

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db/prisma";
import { doiHoiChuDuAn } from "@/lib/quyen";

// Bảng tên trạng thái nằm ở file riêng — file này mang `"use server"` nên chỉ
// được xuất ra hàm async, xem lời giải thích trong `trangThai.ts`
import { TRANG_THAI_DOC, type TrangThaiDoc } from "./trangThai";

export interface KetQua {
  ok: boolean;
  thongDiep: string;
  /** Sau thao tác thì nội dung này còn trong thư viện không */
  dangLuu?: boolean;
}

async function chanCua(viec: string): Promise<KetQua | null> {
  try {
    await doiHoiChuDuAn(viec);
    return null;
  } catch (e) {
    return {
      ok: false,
      thongDiep: e instanceof Error ? e.message : "Không có quyền.",
    };
  }
}

/**
 * Cất vào thư viện, hoặc bỏ ra nếu đang có.
 *
 * Gộp hai việc vào một hàm vì trên giao diện chúng là cùng một cái nút — bấm
 * lần nữa là đổi ý.
 */
export async function batTatLuu(idNoiDung: string): Promise<KetQua> {
  const chan = await chanCua("cất nội dung vào thư viện");
  if (chan) return chan;

  const dangCo = await prisma.libraryItem.findUnique({
    where: { contentItemId: idNoiDung },
    select: { id: true },
  });

  if (dangCo) {
    await prisma.libraryItem.delete({ where: { id: dangCo.id } });
    revalidatePath("/thu-vien");
    revalidatePath(`/xem/${idNoiDung}`);
    return { ok: true, thongDiep: "Đã bỏ khỏi thư viện.", dangLuu: false };
  }

  await prisma.libraryItem.create({ data: { contentItemId: idNoiDung } });
  revalidatePath("/thu-vien");
  revalidatePath(`/xem/${idNoiDung}`);
  return { ok: true, thongDiep: "Đã cất vào thư viện.", dangLuu: true };
}

/**
 * Đổi thư mục.
 *
 * Thư mục là chữ tự do, không có danh sách cố định — chủ nhà tự nghĩ ra tên
 * hợp với cách mình sắp xếp. Ép vào một bộ thư mục có sẵn thì sẽ luôn có thứ
 * không biết bỏ vào đâu.
 */
export async function doiThuMuc(
  idNoiDung: string,
  thuMuc: string,
): Promise<KetQua> {
  const chan = await chanCua("đổi thư mục trong thư viện");
  if (chan) return chan;

  const sach = thuMuc.trim();

  await prisma.libraryItem.update({
    where: { contentItemId: idNoiDung },
    data: { folder: sach || null },
  });

  revalidatePath("/thu-vien");
  return {
    ok: true,
    thongDiep: sach ? `Đã chuyển vào "${sach}".` : "Đã bỏ khỏi thư mục.",
  };
}

/** Đổi trạng thái đọc. */
export async function doiTrangThaiDoc(
  idNoiDung: string,
  trangThai: TrangThaiDoc,
): Promise<KetQua> {
  const chan = await chanCua("đổi trạng thái trong thư viện");
  if (chan) return chan;

  await prisma.libraryItem.update({
    where: { contentItemId: idNoiDung },
    data: { readStatus: trangThai },
  });

  revalidatePath("/thu-vien");
  return { ok: true, thongDiep: `Đã đánh dấu "${TRANG_THAI_DOC[trangThai]}".` };
}

/** Lưu ghi chú riêng cho một mục trong thư viện. */
export async function luuGhiChuRieng(
  idNoiDung: string,
  ghiChu: string,
): Promise<KetQua> {
  const chan = await chanCua("ghi chú trong thư viện");
  if (chan) return chan;

  await prisma.libraryItem.update({
    where: { contentItemId: idNoiDung },
    data: { personalNote: ghiChu.trim() || null },
  });

  revalidatePath("/thu-vien");
  return { ok: true, thongDiep: "Đã lưu ghi chú." };
}
