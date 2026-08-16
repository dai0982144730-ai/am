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
