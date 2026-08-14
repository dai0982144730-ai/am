"use client";

/**
 * Nút cất vào thư viện, đặt ngay dưới trình phát.
 *
 * Một cái nút, bấm lại là đổi ý — không cần hộp thoại xác nhận. Cất nhầm thì
 * bấm lần nữa là xong, chẳng mất gì.
 */

import { useState, useTransition } from "react";

import { batTatLuu } from "@/lib/thuVien/actions";

export function NutLuuThuVien({
  idNoiDung,
  dangLuuBanDau,
  laChu,
}: {
  idNoiDung: string;
  dangLuuBanDau: boolean;
  laChu: boolean;
}) {
  const [dangLuu, setDangLuu] = useState(dangLuuBanDau);
  const [thongDiep, setThongDiep] = useState<string | null>(null);
  const [dangChay, batDau] = useTransition();

  if (!laChu) return null;

  return (
    <div className="mt-3 flex items-center gap-3">
      <button
        type="button"
        disabled={dangChay}
        onClick={() =>
          batDau(async () => {
            const kq = await batTatLuu(idNoiDung);
            if (kq.dangLuu !== undefined) setDangLuu(kq.dangLuu);
            setThongDiep(kq.thongDiep);
          })
        }
        className={`rounded-lg border px-3 py-1.5 text-sm transition-colors disabled:opacity-40 ${
          dangLuu
            ? "border-cam-600 bg-cam-600 text-white dark:border-cam-500 dark:bg-cam-500 dark:text-white"
            : "border-neutral-300 hover:border-neutral-500 dark:border-neutral-700"
        }`}
      >
        {dangLuu ? "✓ Đã cất vào thư viện" : "Cất vào thư viện"}
      </button>
      {thongDiep ? (
        <span className="text-xs text-neutral-500 dark:text-neutral-400">
          {thongDiep}
        </span>
      ) : null}
    </div>
  );
}
