/**
 * Dải nhắc khởi động lại máy chủ, hiện trên cùng mọi trang.
 *
 * Chỉ hiện khi bản Prisma trên đĩa mới hơn tiến trình đang chạy — tức là vừa
 * có bảng hoặc cột mới mà máy chủ chưa biết. Không có gì thì không hiện gì.
 *
 * VÌ SAO ĐÁNG LÀM MỘT DẢI RIÊNG: lỗi do chuyện này trông y hệt lỗi code sai,
 * và đã ba lần mất thời gian đi sửa nhầm chỗ. Một dòng nhắc đúng lúc rẻ hơn
 * nhiều so với nửa tiếng mò.
 */

import { kiemPhienBanPrisma } from "@/lib/db/kiemPhienBan";

export function NhacKhoiDongLai() {
  const kq = kiemPhienBanPrisma();
  if (!kq.daCu || !kq.loiNhac) return null;

  return (
    <div className="border-b border-amber-300 bg-amber-100 px-4 py-2 text-center text-xs leading-relaxed text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
      <strong>Cần khởi động lại máy chủ.</strong> {kq.loiNhac}
    </div>
  );
}
