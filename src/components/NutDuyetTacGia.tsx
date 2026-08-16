"use client";

/**
 * Nút bác một cái tên máy tự rút ra: "đây không phải tên tác giả".
 *
 * ## Vì sao cần nút này bên cạnh nút "Thêm vào tủ"
 *
 * Claude rút tên tác giả từ nội dung, và rút sai là chuyện thường: tên chương
 * trình, tên người dẫn, một cụm chữ trong tiêu đề đều có thể bị nhận nhầm
 * thành tên người. Trước đây Tủ sách chỉ có một chiều — thêm vào tủ. Cái tên
 * sai thì nằm đó mãi, và mỗi lần mở Tủ sách lại phải lướt qua nó.
 *
 * Bản thiết kế đòi tác giả do máy phát hiện phải **được duyệt tay** mới cộng
 * điểm uy tín. "Duyệt" có hai chiều, và trước hôm nay mới có một.
 */

import { Undo2, X } from "lucide-react";
import { useTransition } from "react";

import { doiTuChoiTacGia } from "@/app/tu-sach/actions";

export function NutDuyetTacGia({
  tacGiaId,
  biTuChoi,
}: {
  tacGiaId: string;
  biTuChoi: boolean;
}) {
  const [dangChay, batDau] = useTransition();

  return (
    <button
      type="button"
      disabled={dangChay}
      onClick={() => batDau(() => doiTuChoiTacGia(tacGiaId, !biTuChoi))}
      title={
        biTuChoi
          ? "Nhận lại vào hàng chờ duyệt"
          : "Đây không phải tên tác giả — máy rút nhầm"
      }
      className={`flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
        biTuChoi
          ? "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
          : "text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
      } ${dangChay ? "opacity-60" : ""}`}
    >
      {biTuChoi ? <Undo2 size={14} /> : <X size={14} />}
      {biTuChoi ? "Nhận lại" : "Không phải tác giả"}
    </button>
  );
}
