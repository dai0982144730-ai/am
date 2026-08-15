"use client";

/**
 * Trình phát bản tiếng Việt, kèm điều khiển tốc độ riêng.
 *
 * ## Vì sao dùng thẻ `<audio>` của trình duyệt
 *
 * Nó đã có sẵn tua, thanh tiến độ, và quan trọng nhất là **hiện lên màn hình
 * khoá điện thoại** — nghe lúc đi đường không phải mở máy ra bấm. Tự dựng lại
 * thì mất hết những thứ đó mà chẳng được gì hơn.
 *
 * ## Vì sao vẫn phải thêm nút tốc độ riêng
 *
 * Menu tốc độ có sẵn của Chrome chạy từ 0,25× tới 2× với bước nhảy 0,25 — dải
 * đó vô dụng ở đây. Dưới 1× thì giọng máy vốn đã chậm càng lê thê; trên 1,5×
 * thì tiếng Việt có dấu díu vào nhau, nghe mệt hơn là tiết kiệm được thời gian.
 *
 * Chủ dự án chốt dải **1,0× đến 1,5×, bước nhảy 0,1**. Menu của Chrome vẫn còn
 * đó và không xoá được — nhưng nút của Am nằm ngay cạnh, dễ bấm hơn, và đặt
 * đúng tốc độ mặc định lấy từ Cài đặt.
 */

import { useEffect, useRef, useState } from "react";

/** Dải tốc độ chủ dự án chốt. */
export const TOC_DO_MIN = 1.0;
export const TOC_DO_MAX = 1.5;
export const TOC_DO_BUOC = 0.1;

/** Các mức tốc độ chọn được: 100%, 110%… 150%. */
export const CAC_MUC_TOC_DO: number[] = Array.from(
  { length: Math.round((TOC_DO_MAX - TOC_DO_MIN) / TOC_DO_BUOC) + 1 },
  (_, i) => Number((TOC_DO_MIN + i * TOC_DO_BUOC).toFixed(1)),
);

export function docTocDo(x: number): string {
  return `${Math.round(x * 100)}%`;
}

export function TrinhPhatAmThanh({
  duongDan,
  giong,
  tocDoMacDinh = 1,
  nhan = "Nghe bản tiếng Việt",
  ghiChu,
}: {
  duongDan: string;
  giong?: string | null;
  /** Tốc độ lấy từ Cài đặt */
  tocDoMacDinh?: number;
  nhan?: string;
  ghiChu?: string;
}) {
  const may = useRef<HTMLAudioElement>(null);
  const [tocDo, setTocDo] = useState(tocDoMacDinh);

  // Đặt tốc độ vào thẻ audio. Phải làm ở đây chứ không đặt được bằng thuộc
  // tính HTML — `playbackRate` chỉ tồn tại ở phía JavaScript.
  useEffect(() => {
    if (may.current) may.current.playbackRate = tocDo;
  }, [tocDo]);

  return (
    <div className="rounded-xl border border-cam-300 bg-cam-50/60 p-4 dark:border-cam-700/50 dark:bg-neutral-900">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-cam-800 dark:text-cam-300">
          {nhan}
        </p>
        {giong ? (
          <span className="text-xs text-neutral-500 dark:text-neutral-400">
            {giong}
          </span>
        ) : null}
      </div>

      {/* `preload="none"` có chủ đích: file thuật lại nặng vài MB. Tải sẵn thì
          mỗi lần mở trang là tốn băng thông cho thứ có thể chẳng ai bấm nghe. */}
      <audio
        ref={may}
        controls
        preload="none"
        src={duongDan}
        // Đặt lại tốc độ mỗi lần bắt đầu phát: Chrome trả `playbackRate` về 1
        // khi nạp nguồn mới, nên chỉ đặt một lần lúc dựng là không đủ.
        onLoadedMetadata={() => {
          if (may.current) may.current.playbackRate = tocDo;
        }}
        className="mt-2 w-full"
      >
        Trình duyệt này không phát được âm thanh.
      </audio>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-neutral-500 dark:text-neutral-400">
          Tốc độ
        </span>
        {CAC_MUC_TOC_DO.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setTocDo(m)}
            className={`rounded-md px-2 py-0.5 text-xs tabular-nums transition-colors ${
              Math.abs(m - tocDo) < 0.001
                ? "bg-cam-600 font-medium text-white"
                : "text-neutral-600 hover:bg-cam-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
            }`}
          >
            {docTocDo(m)}
          </button>
        ))}
      </div>

      {ghiChu ? (
        <p className="mt-2 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
          {ghiChu}
        </p>
      ) : null}
    </div>
  );
}
