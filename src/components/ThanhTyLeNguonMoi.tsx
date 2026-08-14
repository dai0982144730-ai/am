"use client";

/**
 * Thanh trượt đặt tỉ lệ nguồn mới cho từng chuyên mục.
 *
 * VÌ SAO PHẢI CÓ CHỮ GIẢI THÍCH DƯỚI MỖI THANH: con số 0–100 tự nó không nói
 * được hậu quả. Kéo lên 90% với mảng Truyện là mở cửa cho truyện AI viết hàng
 * loạt; kéo lên 90% với mảng AI thì hợp lý. Cùng một con số, hai kết quả khác
 * hẳn — nên mỗi chuyên mục có một câu nhắc riêng.
 *
 * Và nói rõ ngay trên đầu rằng đây là **trần chứ không phải chỉ tiêu**, kẻo
 * chủ nhà kéo lên 90% rồi thắc mắc sao tối qua chỉ thấy hai bài nguồn lạ.
 */

import { useState, useTransition } from "react";

import type { ContentGroup } from "@/generated/prisma/enums";
import { luuTyLeNguonMoi } from "@/app/cai-dat/actions";

export interface ChuyenMucTyLe {
  ma: ContentGroup;
  ten: string;
  goiY: string;
  tyLe: number;
}

function MotThanh({
  muc,
  laChu,
}: {
  muc: ChuyenMucTyLe;
  laChu: boolean;
}) {
  const [tyLe, setTyLe] = useState(muc.tyLe);
  const [thongDiep, setThongDiep] = useState<string | null>(null);
  const [dangLuu, batDau] = useTransition();

  return (
    <div className="py-4">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium">{muc.ten}</span>
        <span className="text-sm tabular-nums text-neutral-600 dark:text-neutral-300">
          <strong className="text-cam-600 dark:text-cam-500">{tyLe}%</strong>{" "}
          nguồn mới
        </span>
      </div>

      <input
        type="range"
        min={0}
        max={100}
        step={10}
        value={tyLe}
        disabled={!laChu || dangLuu}
        onChange={(e) => setTyLe(Number(e.target.value))}
        onPointerUp={() =>
          batDau(async () => {
            const kq = await luuTyLeNguonMoi(muc.ma, tyLe);
            setThongDiep(kq.thongDiep);
          })
        }
        onKeyUp={() =>
          batDau(async () => {
            const kq = await luuTyLeNguonMoi(muc.ma, tyLe);
            setThongDiep(kq.thongDiep);
          })
        }
        className="mt-2 w-full accent-cam-600 disabled:opacity-40 dark:accent-cam-500"
      />

      <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
        {muc.goiY}
      </p>
      {thongDiep ? (
        <p className="mt-1 text-xs text-cam-700 dark:text-cam-300">
          {thongDiep}
        </p>
      ) : null}
    </div>
  );
}

export function ThanhTyLeNguonMoi({
  cacMuc,
  laChu,
}: {
  cacMuc: ChuyenMucTyLe[];
  laChu: boolean;
}) {
  return (
    <section className="mt-10">
      <h2 className="text-base font-semibold">Bao nhiêu phần là nguồn mới</h2>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
        Mặc định trợ lý chỉ lấy nội dung từ những kênh và trang bạn đã theo dõi
        — an toàn nhưng dễ thành nhai lại. Kéo thanh lên để nó dành chỗ cho
        nguồn chưa theo dõi.
      </p>

      <div className="mt-3 rounded-xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <p className="text-xs leading-relaxed text-neutral-600 dark:text-neutral-300">
          <strong>Đây là mức trần, không phải chỉ tiêu.</strong> Đặt 90% nghĩa
          là <em>tối đa</em> 90% chỗ dành cho nguồn mới. Tối nào chỉ có vài bài
          từ nguồn lạ đủ hay thì đưa bấy nhiêu, phần còn lại trả về cho nguồn
          quen — chứ không lấp cho đủ số. Lấp cho đủ là cách chắc chắn nhất để
          bạn nhận về bài rác.
        </p>
        <p className="mt-2 text-xs leading-relaxed text-neutral-600 dark:text-neutral-300">
          Bài từ nguồn lạ còn phải qua cửa chặt hơn: điểm của nó không được thua
          điểm trung vị của nhóm nguồn quen cùng chuyên mục. Và mỗi nguồn lạ chỉ
          được một suất, kẻo một kênh chăm đăng chiếm sạch.
        </p>
      </div>

      {!laChu ? (
        <p className="mt-3 rounded-lg border border-dashed border-neutral-300 p-4 text-center text-xs text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
          Đăng nhập để chỉnh.
        </p>
      ) : null}

      <div className="mt-2 divide-y divide-neutral-200 dark:divide-neutral-800">
        {cacMuc.map((m) => (
          <MotThanh key={m.ma} muc={m} laChu={laChu} />
        ))}
      </div>

      <p className="mt-3 text-xs text-neutral-400 dark:text-neutral-500">
        Thẻ đến từ nguồn chưa theo dõi được gắn nhãn{" "}
        <span className="rounded bg-cam-100 px-1.5 py-0.5 text-[10px] font-medium text-cam-700 dark:bg-cam-700/30 dark:text-cam-300">
          nguồn mới
        </span>{" "}
        để bạn liếc một cái là biết nên soi kỹ hay tin ngay.
      </p>
    </section>
  );
}
