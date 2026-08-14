/**
 * Ghi nhật ký mọi lượt gọi Cổng API trợ lý.
 *
 * Mục đích: sau này nhìn lại biết chi phí Claude API đến từ trang nào, thiết bị
 * nào, endpoint nào — và endpoint nào chậm.
 *
 * Ghi hỏng thì không được làm hỏng cả request: nhật ký là thứ phụ, mất một dòng
 * log còn hơn trả lỗi cho người dùng chỉ vì database bận.
 */

import { prisma } from "@/lib/db/prisma";
import { dangKyGhiNhatKy, type ThongTinGoi } from "@/lib/troLyChung/phanHoi";

async function ghi(thongTin: ThongTinGoi): Promise<void> {
  try {
    await prisma.assistantApiLog.create({
      data: {
        endpoint: thongTin.endpoint,
        tokenLabel: thongTin.nhanToken,
        responseTimeMs: thongTin.thoiGianPhanHoiMs,
        statusCode: thongTin.maTrangThai,
        aiInputTokens: thongTin.tokenAiVao ?? null,
        aiOutputTokens: thongTin.tokenAiRa ?? null,
      },
    });
  } catch (loi) {
    console.error("[tro-ly] không ghi được nhật ký:", loi);
  }
}

/**
 * Gắn hàm ghi nhật ký vào vỏ chung.
 *
 * Gọi ở đầu mỗi file route. Gọi nhiều lần không sao — chỉ là gán lại cùng một hàm.
 */
export function batNhatKy(): void {
  dangKyGhiNhatKy(ghi);
}
