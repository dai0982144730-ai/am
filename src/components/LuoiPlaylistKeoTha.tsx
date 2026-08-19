"use client";

/**
 * Lưới nội dung trong một playlist, kéo-thả đổi thứ tự được — giống cách
 * YouTube cho nhấn giữ rồi kéo một video sang chỗ khác.
 *
 * DÙNG DRAG-AND-DROP SẴN CỦA TRÌNH DUYỆT, không thêm thư viện: việc cần làm ở
 * đây chỉ là "nhấc một thẻ, thả vào chỗ khác trong cùng một lưới". Kéo thư
 * viện chuyên dụng về cho một màn hình duy nhất là đổi vài trăm KB lấy thứ vài
 * chục dòng làm được.
 *
 * ĐÃ BỎ HAI NÚT ▲▼ bên dưới mỗi thẻ (2026-08-19, chủ dự án yêu cầu). Chúng
 * từng được giữ lại làm đường dự phòng cho bàn phím và điện thoại, nhưng chủ
 * dự án dùng chuột trên máy tính và thấy chúng chỉ làm rối thẻ.
 *
 * Thứ tự mới ghi ngay trên Am VÀ ghi thẳng lên YouTube luôn — việc chủ nhà tự
 * tay làm thì không phải xin duyệt lại (xem `ghiThang.ts`).
 */

import { useState, useTransition } from "react";

import { TheNoiDungCard } from "@/components/TheNoiDung";
import type { TheNoiDung } from "@/lib/nghiepVu/layNoiDungTrangChu";
import { datLaiThuTu } from "@/lib/playlist/actions";

export function LuoiPlaylistKeoTha({
  playlistId,
  cacThe,
  choKeo,
}: {
  playlistId: string;
  cacThe: NonNullable<TheNoiDung>[];
  choKeo: boolean;
}) {
  const [thuTu, setThuTu] = useState(cacThe);
  const [dangKeo, setDangKeo] = useState<number | null>(null);
  const [dangNhamToi, setDangNhamToi] = useState<number | null>(null);
  const [thongDiep, setThongDiep] = useState<string | null>(null);
  const [, batDau] = useTransition();

  function tha(denIdx: number) {
    const tuIdx = dangKeo;
    setDangKeo(null);
    setDangNhamToi(null);
    if (tuIdx === null || tuIdx === denIdx) return;

    const moi = [...thuTu];
    const [bi] = moi.splice(tuIdx, 1);
    moi.splice(denIdx, 0, bi);
    setThuTu(moi);

    batDau(async () => {
      const kq = await datLaiThuTu(playlistId, moi.map((t) => t.id));
      // Thất bại thì trả lưới về đúng thứ tự máy chủ đang giữ, đừng để màn
      // hình nói một đằng database một nẻo.
      if (!kq.ok) setThuTu(cacThe);
      setThongDiep(kq.thongDiep);
    });
  }

  return (
    <>
      {thongDiep ? (
        <p className="mt-3 rounded-lg bg-neutral-100 px-3 py-2 text-sm dark:bg-neutral-900">
          {thongDiep}
        </p>
      ) : null}

      <div className="mt-6 grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
        {thuTu.map((the, idx) => (
          <div
            key={the.id}
            draggable={choKeo}
            onDragStart={() => setDangKeo(idx)}
            onDragEnd={() => {
              setDangKeo(null);
              setDangNhamToi(null);
            }}
            onDragOver={(e) => {
              if (!choKeo || dangKeo === null) return;
              e.preventDefault();
              setDangNhamToi(idx);
            }}
            onDrop={(e) => {
              e.preventDefault();
              tha(idx);
            }}
            className={`rounded-xl transition-opacity ${choKeo ? "cursor-grab active:cursor-grabbing" : ""} ${
              dangKeo === idx ? "opacity-40" : ""
            } ${
              dangNhamToi === idx && dangKeo !== null && dangKeo !== idx
                ? "ring-2 ring-cam-500"
                : ""
            }`}
          >
            <TheNoiDungCard
              muc={the}
              trongPlaylistId={choKeo ? playlistId : undefined}
            />
          </div>
        ))}
      </div>
    </>
  );
}
