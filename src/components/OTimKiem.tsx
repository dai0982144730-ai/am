"use client";

/**
 * Ô tìm kiếm.
 *
 * Tìm trong tiêu đề, mô tả, tên nguồn, **và cả nhận xét lẫn chủ đề Claude rút
 * ra**. Nhờ vậy gõ "khắc kỷ" vẫn tìm được video mà tiêu đề không hề có chữ đó —
 * đây là chỗ web này làm được thứ ô tìm kiếm của YouTube không làm được.
 */

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

export function OTimKiem() {
  const duongDan = usePathname();
  const thamSo = useSearchParams();
  const dieuHuong = useRouter();
  const [dangTim, batDauTim] = useTransition();

  const tuKhoaTrenUrl = thamSo.get("q") ?? "";

  function tim(tuKhoa: string) {
    const moi = new URLSearchParams(thamSo.toString());
    if (tuKhoa.trim()) moi.set("q", tuKhoa.trim());
    else moi.delete("q");
    moi.delete("trang");
    batDauTim(() => dieuHuong.push(`${duongDan}?${moi.toString()}`));
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const o = e.currentTarget.elements.namedItem("q");
        tim(o instanceof HTMLInputElement ? o.value : "");
      }}
      className="flex gap-2"
    >
      <input
        // Đổi key khi từ khoá trên địa chỉ đổi, để React dựng lại ô với giá
        // trị mới. Cách này thay cho việc đồng bộ bằng useEffect — vốn gây
        // dựng lại nhiều lần không cần thiết, và ESLint cũng chặn.
        key={tuKhoaTrenUrl}
        type="search"
        name="q"
        defaultValue={tuKhoaTrenUrl}
        placeholder="Tìm theo tiêu đề, chủ đề, tên giảng sư, hoặc nhận xét của Claude…"
        className="w-full rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900"
      />
      <button
        type="submit"
        disabled={dangTim}
        className="shrink-0 rounded-full bg-cam-600 px-5 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50 dark:bg-cam-500 dark:text-white"
      >
        {dangTim ? "Đang tìm…" : "Tìm"}
      </button>
    </form>
  );
}
