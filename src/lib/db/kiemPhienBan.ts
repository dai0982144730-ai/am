/**
 * Bắt sớm chuyện "máy chủ đang giữ bản Prisma cũ".
 *
 * VÌ SAO CẦN: đã vấp ba lần, và lần nào cũng mất thời gian đoán. Lỗi hiện ra
 * trông y như code sai —
 *
 *     Unknown field `ttsSpeed` for select statement on model `UserAssistantSettings`
 *     Cannot read properties of undefined (reading 'findUnique')
 *
 * — trong khi cột vẫn nằm trong database và bản Prisma trên đĩa vẫn đủ trường.
 * Nguyên nhân thật: `next dev` giữ bản Prisma đã nạp từ lúc khởi động, còn
 * `prisma generate` chỉ ghi đè file trên đĩa. Hai thứ lệch nhau cho tới khi
 * khởi động lại.
 *
 * CÁCH PHÁT HIỆN: so **mốc sửa file** của bản Prisma trên đĩa với **lúc tiến
 * trình này khởi động**. File mới hơn tiến trình nghĩa là nó đã được sinh lại
 * sau khi máy chủ chạy — tức bộ nhớ đang giữ bản cũ.
 *
 * Đã thử cách so số migration đã chạy với số file migration: **không dùng
 * được**, vì sau khi chạy migration thì hai con số khớp nhau ngay, còn cái cũ
 * vẫn nằm trong bộ nhớ. Mốc thời gian mới là thứ phản ánh đúng.
 */

import { statSync } from "node:fs";
import path from "node:path";

/** Bản Prisma sinh ra nằm ở đâu. */
const FILE_PRISMA = path.join(
  process.cwd(),
  "src",
  "generated",
  "prisma",
  "client.ts",
);

export interface KetQuaKiem {
  /** Bộ nhớ có đang giữ bản cũ không */
  daCu: boolean;
  loiNhac: string | null;
}

/**
 * Bản Prisma trên đĩa có mới hơn tiến trình đang chạy không.
 *
 * Không ném lỗi bao giờ — đây là thứ để **nhắc**, không phải để chặn. Chặn thì
 * một trục trặc nhỏ ở đây làm chết cả web, mà bản thân nó chỉ là tiện ích.
 */
export function kiemPhienBanPrisma(): KetQuaKiem {
  try {
    const sinhLuc = statSync(FILE_PRISMA).mtimeMs;
    const khoiDongLuc = Date.now() - process.uptime() * 1000;

    // Chừa 5 giây: tiến trình khởi động và file được đọc không cùng một
    // khoảnh khắc, và đồng hồ hệ thống có sai số nhỏ
    const daCu = sinhLuc > khoiDongLuc + 5_000;

    return {
      daCu,
      loiNhac: daCu
        ? "Bản Prisma đã được sinh lại SAU khi máy chủ khởi động. Máy chủ vẫn " +
          "đang dùng bản cũ trong bộ nhớ, nên bảng hoặc cột vừa thêm sẽ báo " +
          '"Unknown field". Dừng máy chủ (Ctrl+C) rồi chạy lại "npm run dev".'
        : null,
    };
  } catch {
    // Không đọc được file — không phải việc của hàm này
    return { daCu: false, loiNhac: null };
  }
}
