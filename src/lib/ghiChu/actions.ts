"use server";

/**
 * Ghi chú khi đang xem.
 *
 * ĐIỀU LÀM NÓ KHÁC MỘT ỨNG DỤNG GHI CHÚ THƯỜNG: mỗi ghi chú gắn đúng giây trong
 * clip. Nghe tới phút 23 thấy một ý hay, ghi lại; sau này bấm vào là nhảy thẳng
 * về phút 23 nghe lại đoạn đó. Ghi chú rời khỏi ngữ cảnh thì vài tháng sau đọc
 * lại chẳng hiểu mình định nói gì.
 *
 * VÌ SAO LƯU XONG LÀ XONG, KHÔNG GỌI CLAUDE NGAY: người dùng đang xem dở. Bắt
 * chờ mười lăm giây cho Claude gắn nhãn thì lần sau họ không ghi nữa. Việc gắn
 * nhãn để dành cho lượt chạy gộp — giống hệt cách phân loại nội dung đang làm.
 */

import { revalidatePath } from "next/cache";

import type { ActionItemStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db/prisma";
import { doiHoiChuDuAn } from "@/lib/quyen";

export interface KetQua {
  ok: boolean;
  thongDiep: string;
  idGhiChu?: string;
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
 * Lưu một ghi chú.
 *
 * @param bangGiongNoi `true` khi người dùng đọc thay vì gõ. Ghi lại vì hai kiểu
 *   này cho ra văn phong rất khác — đọc thì dài dòng và có từ đệm, gõ thì cụt.
 *   Sau này phần gắn nhãn cần biết để không hiểu nhầm.
 */
export async function luuGhiChu(
  idNoiDung: string,
  noiDung: string,
  giay: number | null,
  bangGiongNoi = false,
): Promise<KetQua> {
  const chan = await chanCua("ghi chú");
  if (chan) return chan;

  const sach = noiDung.trim();
  if (sach.length < 2) {
    return { ok: false, thongDiep: "Ghi chú trống." };
  }

  const ghiChu = await prisma.note.create({
    data: {
      contentItemId: idNoiDung,
      rawText: sach,
      timestampSeconds: giay !== null && giay > 0 ? Math.floor(giay) : null,
      inputType: bangGiongNoi ? "voice" : "text",
    },
    select: { id: true },
  });

  revalidatePath("/ghi-chu");
  revalidatePath(`/xem/${idNoiDung}`);

  return {
    ok: true,
    thongDiep:
      giay !== null && giay > 0
        ? `Đã ghi tại phút ${Math.floor(giay / 60)}:${String(Math.floor(giay % 60)).padStart(2, "0")}.`
        : "Đã ghi.",
    idGhiChu: ghiChu.id,
  };
}

/** Xoá một ghi chú. */
export async function xoaGhiChu(id: string): Promise<KetQua> {
  const chan = await chanCua("xoá ghi chú");
  if (chan) return chan;

  const ghiChu = await prisma.note.findUnique({
    where: { id },
    select: { contentItemId: true },
  });
  if (!ghiChu) return { ok: false, thongDiep: "Không tìm thấy ghi chú." };

  await prisma.note.delete({ where: { id } });

  revalidatePath("/ghi-chu");
  revalidatePath(`/xem/${ghiChu.contentItemId}`);
  return { ok: true, thongDiep: "Đã xoá." };
}

/**
 * Sửa lại nhãn Claude gắn.
 *
 * Lưu vào `userCorrectedTags` chứ **không đè lên `autoTags`**. Giữ cả hai mới
 * so được máy đoán gì và người sửa thành gì — đó là nguyên liệu để sau này cải
 * thiện phần gắn nhãn. Đè lên thì mất sạch dấu vết của việc máy đã sai chỗ nào.
 */
export async function suaNhan(id: string, nhan: string[]): Promise<KetQua> {
  const chan = await chanCua("sửa nhãn ghi chú");
  if (chan) return chan;

  await prisma.note.update({
    where: { id },
    data: { userCorrectedTags: nhan },
  });

  revalidatePath("/ghi-chu");
  return { ok: true, thongDiep: "Đã lưu nhãn." };
}

/** Đánh dấu một việc cần làm là xong, hoặc mở lại. */
export async function doiTrangThaiViec(
  id: string,
  trangThai: ActionItemStatus,
): Promise<KetQua> {
  const chan = await chanCua("đổi trạng thái việc cần làm");
  if (chan) return chan;

  await prisma.actionItem.update({
    where: { id },
    data: { status: trangThai },
  });

  revalidatePath("/ghi-chu");
  return {
    ok: true,
    thongDiep: trangThai === "done" ? "Đã xong." : "Đã mở lại.",
  };
}
