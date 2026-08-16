"use client";

import { BookMarked, Check } from "lucide-react";
import { useTransition } from "react";

import { doiTheoDoiTacGia } from "@/app/tu-sach/actions";

/** Nút thêm/bỏ một tác giả khỏi Tủ sách. */
export function NutTheoDoiTacGia({
  tacGiaId,
  dangTheoDoi,
}: {
  tacGiaId: string;
  dangTheoDoi: boolean;
}) {
  const [dangChay, batDau] = useTransition();

  return (
    <button
      type="button"
      disabled={dangChay}
      onClick={() => batDau(() => doiTheoDoiTacGia(tacGiaId, !dangTheoDoi))}
      className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
        dangTheoDoi
          ? "bg-cam-600 text-white dark:bg-cam-500 dark:text-neutral-950"
          : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
      } ${dangChay ? "opacity-60" : ""}`}
    >
      {dangTheoDoi ? <Check size={14} /> : <BookMarked size={14} />}
      {dangTheoDoi ? "Trong tủ" : "Thêm vào tủ"}
    </button>
  );
}
