"use server";

/**
 * Thao tác ghi của trang Vận hành.
 *
 * Chặn cửa bằng `doiHoiChuDuAn` ngay dòng đầu như mọi server action khác — đây
 * là chốt chặn thật, không phải chỉ giấu nút trên giao diện.
 */

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db/prisma";
import { doiHoiChuDuAn } from "@/lib/quyen";
import { kepCuongDo } from "@/lib/vanHanh/cuongDo";
import {
  CAC_CHUYEN_MUC,
  chuanHoaTyLe,
  SO_LAN_TOI_DA,
  SUAT_MAC_DINH,
  type MaChuyenMuc,
  type MaNhomNguon,
} from "@/lib/vanHanh/suatPhanLoai";

/** Đặt cường độ quét đêm, 0–200 phần trăm. */
export async function datCuongDoQuet(cuongDo: number): Promise<void> {
  await doiHoiChuDuAn("đổi cường độ quét");

  // Kẹp lại ở máy chủ chứ không tin con số gửi lên. Thanh trượt chỉ sinh ra giá
  // trị hợp lệ, nhưng lời gọi thì ai cũng gửi được — và một số âm hay một số
  // khổng lồ lọt vào đây là mỗi đêm quét gấp trăm lần, cạn hạn mức trong một
  // tiếng.
  const giaTri = kepCuongDo(cuongDo);

  await prisma.userAssistantSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", cuongDoQuet: giaTri },
    update: { cuongDoQuet: giaTri },
  });

  revalidatePath("/van-hanh");
}

/**
 * Đặt suất phân loại: số bài mỗi chuyên mục và tỷ lệ theo loại nguồn.
 *
 * Kẹp lại ở máy chủ chứ không tin con số gửi lên — giao diện chỉ sinh ra giá
 * trị hợp lệ, nhưng lời gọi thì ai cũng gửi được, và một số khổng lồ lọt vào
 * đây là một đêm gọi Claude hàng nghìn lần.
 */
export async function datSuatPhanLoai(
  chuyenMuc: Record<string, number>,
  tyLeNguon: Partial<Record<MaNhomNguon, number>>,
): Promise<void> {
  await doiHoiChuDuAn("đổi suất phân loại");

  const suat: Record<string, number> = {};
  for (const m of CAC_CHUYEN_MUC) {
    const tran = SUAT_MAC_DINH[m as MaChuyenMuc] * SO_LAN_TOI_DA;
    const n = Number(chuyenMuc[m]);
    suat[m] = Number.isFinite(n) ? Math.max(0, Math.min(tran, Math.round(n))) : SUAT_MAC_DINH[m as MaChuyenMuc];
  }

  // Tính lại ba phần trăm ở máy chủ nữa, không dựa vào việc giao diện đã tính
  // đúng. Đây là chỗ bảo đảm tổng luôn bằng 100.
  const tyLe = chuanHoaTyLe(tyLeNguon);

  await prisma.userAssistantSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", suatChuyenMuc: suat, tyLeNguon: tyLe },
    update: { suatChuyenMuc: suat, tyLeNguon: tyLe },
  });

  revalidatePath("/van-hanh");
}
