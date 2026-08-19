"use client";

/**
 * Lưới kéo-thả để sắp xếp lại thứ tự — dùng chung cho danh sách playlist và
 * danh sách bài bên trong một playlist.
 *
 * ## Vì sao tự viết thay vì lấy thư viện
 *
 * Việc cần làm chỉ có: nhấc một ô lên, thả vào chỗ khác, báo thứ tự mới. HTML
 * có sẵn API kéo-thả cho đúng việc đó. Thêm một thư viện kéo-thả (dnd-kit,
 * react-beautiful-dnd) là thêm vài trăm KB tải về và một bộ khái niệm riêng
 * phải học, đổi lại vài hiệu ứng mà chủ dự án không đòi.
 *
 * ## Ba điều làm cho nó không khó chịu khi dùng
 *
 * 1. **Chỉ báo về máy chủ khi thứ tự THẬT SỰ đổi.** Nhấc lên rồi thả lại đúng
 *    chỗ cũ là chuyện xảy ra suốt; gọi máy chủ mỗi lần như vậy vừa phí vừa làm
 *    trang nháy.
 * 2. **Đổi ngay trên màn hình rồi mới gọi máy chủ.** Chờ máy chủ trả lời mới
 *    xê dịch thì cảm giác như bị lag, dù chỉ 50ms.
 * 3. **Hỏng thì trả lại như cũ.** Máy chủ từ chối mà màn hình vẫn giữ thứ tự
 *    mới thì lần sau tải lại trang, thứ tự nhảy về chỗ cũ không rõ vì sao.
 */

import { useState, useTransition, type ReactNode } from "react";

export function LuoiKeoTha({
  cacId,
  lop,
  ve,
  luu,
  batKeo = true,
}: {
  /** Id các mục, đúng thứ tự đang hiện */
  cacId: string[];
  /** Lớp CSS cho lưới bao ngoài */
  lop: string;
  /** Vẽ một mục. `dangNhac` = ô này đang được nhấc lên */
  ve: (id: string, dangNhac: boolean) => ReactNode;
  /** Gọi khi thứ tự đổi thật */
  luu: (thuTuMoi: string[]) => Promise<{ ok: boolean; thongDiep: string }>;
  /** Tắt kéo-thả (ví dụ khách chưa đăng nhập) */
  batKeo?: boolean;
}) {
  const [thuTu, setThuTu] = useState(cacId);
  const [dangNhac, setDangNhac] = useState<string | null>(null);
  const [thongDiep, setThongDiep] = useState<string | null>(null);
  const [, batDau] = useTransition();

  // Danh sách từ máy chủ đổi (thêm/bớt playlist) thì lấy theo nó, trừ lúc
  // đang kéo dở — xen vào giữa chừng là ô đang cầm bị giật khỏi tay.
  const khoaHienTai = cacId.join(",");
  const [khoaCu, setKhoaCu] = useState(khoaHienTai);
  if (khoaCu !== khoaHienTai && !dangNhac) {
    setKhoaCu(khoaHienTai);
    setThuTu(cacId);
  }

  function thaVao(idDich: string) {
    if (!dangNhac || dangNhac === idDich) return;

    const tu = thuTu.indexOf(dangNhac);
    const den = thuTu.indexOf(idDich);
    if (tu === -1 || den === -1) return;

    const moi = [...thuTu];
    moi.splice(tu, 1);
    moi.splice(den, 0, dangNhac);

    setThuTu(moi);
    setDangNhac(null);

    const cu = thuTu;
    batDau(async () => {
      const kq = await luu(moi);
      if (!kq.ok) {
        setThuTu(cu);
        setThongDiep(kq.thongDiep);
      }
    });
  }

  return (
    <>
      {thongDiep ? (
        <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {thongDiep}
        </p>
      ) : null}
      <ul className={lop}>
        {thuTu.map((id) => (
          <li
            key={id}
            draggable={batKeo}
            onDragStart={() => setDangNhac(id)}
            onDragEnd={() => setDangNhac(null)}
            // Không có `preventDefault` thì trình duyệt từ chối nhận thả
            onDragOver={(e) => {
              if (batKeo && dangNhac) e.preventDefault();
            }}
            onDrop={(e) => {
              e.preventDefault();
              thaVao(id);
            }}
            className={
              batKeo
                ? `cursor-grab active:cursor-grabbing ${dangNhac === id ? "opacity-40" : ""}`
                : undefined
            }
          >
            {ve(id, dangNhac === id)}
          </li>
        ))}
      </ul>
    </>
  );
}
