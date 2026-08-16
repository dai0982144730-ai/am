/**
 * Đọc cường độ quét từ database.
 *
 * File này nạp prisma nên **chỉ chạy ở máy chủ**. Mọi thứ trình duyệt cũng cần
 * — dải giá trị, phép nhân định mức, câu mô tả — nằm ở `mucCuongDo.ts`; xem
 * lời giải thích ở đầu file đó.
 */

import { prisma } from "@/lib/db/prisma";

import { CUONG_DO_MAC_DINH, kepCuongDo } from "./mucCuongDo";

export * from "./mucCuongDo";

/** Đọc cường độ đang đặt. Chưa có cài đặt thì coi như mức mặc định. */
export async function docCuongDo(): Promise<number> {
  const caiDat = await prisma.userAssistantSettings.findUnique({
    where: { id: "singleton" },
    select: { cuongDoQuet: true },
  });
  return kepCuongDo(caiDat?.cuongDoQuet ?? CUONG_DO_MAC_DINH);
}
