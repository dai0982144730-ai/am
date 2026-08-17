"use client";

/**
 * Hai nút lên/xuống trên một thẻ trong trang chi tiết playlist — đổi chỗ
 * ngay trên Am. Ghi thật thứ tự lên YouTube là việc riêng, tự sinh đề xuất
 * chờ duyệt ở trang Playlist (xem `thanhVien.ts` → `xetLechThuTu`).
 *
 * NẰM DƯỚI ẢNH, không đè lên ảnh — bốn góc ảnh đã kín chỗ (nhãn chuyên mục,
 * loại nguồn, thời lượng, điểm chất lượng), thêm nút đè lên đó chỉ rối mắt.
 */

import { useTransition } from "react";

import { doiThuTu } from "@/lib/playlist/actions";

export function NutDoiViTri({
  playlistId,
  contentItemId,
  laDau,
  laCuoi,
}: {
  playlistId: string;
  contentItemId: string;
  laDau: boolean;
  laCuoi: boolean;
}) {
  const [dangChay, batDau] = useTransition();

  function bam(e: React.MouseEvent, huong: "len" | "xuong") {
    e.preventDefault();
    e.stopPropagation();
    batDau(() => {
      void doiThuTu(playlistId, contentItemId, huong);
    });
  }

  return (
    <div className="flex shrink-0 gap-1">
      <button
        type="button"
        disabled={dangChay || laDau}
        onClick={(e) => bam(e, "len")}
        aria-label="Đưa lên"
        title="Đưa lên"
        className="rounded-md border border-neutral-300 px-1.5 py-0.5 text-xs text-neutral-500 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-30 dark:border-neutral-700 dark:hover:bg-neutral-800"
      >
        ▲
      </button>
      <button
        type="button"
        disabled={dangChay || laCuoi}
        onClick={(e) => bam(e, "xuong")}
        aria-label="Đưa xuống"
        title="Đưa xuống"
        className="rounded-md border border-neutral-300 px-1.5 py-0.5 text-xs text-neutral-500 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-30 dark:border-neutral-700 dark:hover:bg-neutral-800"
      >
        ▼
      </button>
    </div>
  );
}
