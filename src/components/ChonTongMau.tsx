"use client";

/**
 * Chọn tông màu trong Cài đặt.
 *
 * Đổi là thấy ngay, không phải tải lại trang và không phải bấm lưu — đây là lựa
 * chọn nhìn bằng mắt, bắt bấm lưu rồi mới thấy kết quả thì vô lý.
 *
 * Lựa chọn nằm trong bộ nhớ máy chứ không nằm trong database, có chủ đích: nó
 * thuộc về **cái máy đang ngồi**, không thuộc về tài khoản. Chủ dự án làm việc
 * trên hai máy — máy ở nhà buổi tối muốn nền đen, máy văn phòng ban ngày có thể
 * muốn nền sáng. Lưu vào database thì hai máy giẫm chân nhau.
 */

import { useSyncExternalStore } from "react";

import {
  CAC_TONG,
  dangKyNgheTong,
  datTongMau,
  docTongTrenMayChu,
  docTongTrenTrinhDuyet,
} from "@/lib/giaoDien/tongMau";

export function ChonTongMau() {
  const dangChon = useSyncExternalStore(
    dangKyNgheTong,
    docTongTrenTrinhDuyet,
    docTongTrenMayChu,
  );

  return (
    <section className="mt-10">
      <h2 className="text-base font-semibold">Tông màu</h2>
      <p className="mt-2 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
        Lựa chọn này nằm trên <strong>máy đang dùng</strong>, không theo tài
        khoản — nên máy ở nhà và máy ở văn phòng đặt khác nhau được.
      </p>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {CAC_TONG.map((t) => {
          const dangO = dangChon === t.ma;
          return (
            <button
              key={t.ma}
              type="button"
              onClick={() => datTongMau(t.ma)}
              className={`rounded-xl border p-3 text-left transition-colors ${
                dangO
                  ? "border-cam-600 bg-cam-50 dark:border-cam-500 dark:bg-cam-50"
                  : "border-neutral-200 hover:border-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-700"
              }`}
            >
              <span className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium">{t.ten}</span>
                {dangO ? (
                  <span className="shrink-0 text-xs font-semibold text-cam-600 dark:text-cam-500">
                    đang dùng
                  </span>
                ) : null}
              </span>
              <span className="mt-1 block text-[11px] leading-snug text-neutral-500 dark:text-neutral-400">
                {t.moTa}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
