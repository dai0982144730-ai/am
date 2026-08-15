"use client";

/**
 * Chọn giọng đọc trong Cài đặt.
 *
 * NÓI RÕ HAI ĐIỀU NGƯỜI DÙNG HAY HIỂU NHẦM, ngay trên màn hình:
 *
 * 1. **Chọn giọng không nhân chi phí.** Mỗi lần đọc chỉ dùng một giọng, không
 *    phải tạo cả ba bản cho cùng một nội dung.
 * 2. **Đổi giọng không đọc lại thứ đã đọc.** Bản âm thanh cũ giữ giọng cũ.
 *
 * Chủ dự án hỏi thẳng điều thứ nhất, nên nó phải nằm trên giao diện chứ không
 * chỉ trong đầu người viết code.
 */

import { useState, useTransition } from "react";

import { chonGiongDoc } from "@/app/cai-dat/actions";
import type { GiongDoc } from "@/lib/tts/giong";

export function ChonGiongDoc({
  cacGiong,
  dangChon,
  laChu,
}: {
  cacGiong: GiongDoc[];
  dangChon: string;
  laChu: boolean;
}) {
  const [chon, setChon] = useState(dangChon);
  const [thongDiep, setThongDiep] = useState<string | null>(null);
  const [dangLuu, batDau] = useTransition();

  return (
    <div className="mt-4">
      <p className="text-sm font-medium">Giọng đọc</p>
      <p className="mt-1 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
        Mỗi lần đọc chỉ dùng <strong>một giọng</strong> — chọn giọng không làm
        tăng chi phí. Đổi giọng chỉ áp dụng cho những lần đọc sau; bản âm thanh
        đã tạo vẫn giữ giọng cũ.
      </p>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {cacGiong.map((g) => {
          const dangO = chon === g.ma;
          return (
            <button
              key={g.ma}
              type="button"
              disabled={!laChu || dangLuu}
              onClick={() => {
                const truoc = chon;
                setChon(g.ma);
                batDau(async () => {
                  const kq = await chonGiongDoc(g.ma);
                  if (!kq.ok) setChon(truoc);
                  setThongDiep(kq.thongDiep);
                });
              }}
              className={`rounded-xl border p-3 text-left transition-colors disabled:opacity-50 ${
                dangO
                  ? "border-cam-600 bg-cam-50 dark:border-cam-500 dark:bg-neutral-900"
                  : "border-neutral-200 hover:border-neutral-400 dark:border-neutral-800"
              }`}
            >
              <span className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium">{g.ten}</span>
                {dangO ? (
                  <span className="shrink-0 text-xs font-semibold text-cam-600 dark:text-cam-500">
                    đang dùng
                  </span>
                ) : null}
              </span>
              <span className="mt-1 block text-[11px] leading-snug text-neutral-500 dark:text-neutral-400">
                {g.moTa}
              </span>
            </button>
          );
        })}
      </div>

      {thongDiep ? (
        <p className="mt-2 text-xs leading-relaxed text-cam-700 dark:text-cam-300">
          {thongDiep}
        </p>
      ) : null}

      {!laChu ? (
        <p className="mt-2 text-xs text-neutral-400">Đăng nhập để đổi giọng.</p>
      ) : null}
    </div>
  );
}
