"use client";

/**
 * Đánh dấu "đã mở" ngay khi trang xem hiện ra. Không vẽ gì cả.
 *
 * VÌ SAO PHẢI LÀ MỘT THÀNH PHẦN RIÊNG THAY VÌ GHI THẲNG TRONG TRANG: trang xem
 * dựng ở server, mà ghi vào database ngay lúc dựng trang thì Next có thể dựng
 * lại nhiều lần và đếm sai. Đẩy việc ghi sang phía trình duyệt, chạy đúng một
 * lần sau khi trang đã hiện, là cách chắc chắn hơn.
 *
 * Ghi ngầm, không báo gì. Người dùng vừa mở video ra xem — không cần một dòng
 * thông báo nói rằng họ vừa mở video ra xem.
 */

import { useEffect } from "react";

import { ghiDaMo } from "@/lib/lichSu/actions";

export function GhiNhoDaMo({
  idNoiDung,
  laChu,
}: {
  idNoiDung: string;
  laChu: boolean;
}) {
  useEffect(() => {
    if (!laChu) return;
    void ghiDaMo(idNoiDung);
  }, [idNoiDung, laChu]);

  return null;
}
