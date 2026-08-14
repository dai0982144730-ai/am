"use client";

/**
 * Một dòng việc cần làm, tick là xong.
 *
 * Danh sách này chỉ có ích khi nó **sạch**. Nếu phần gắn nhãn đánh dấu bừa,
 * chỗ này đầy thứ không phải việc và chủ nhà sẽ thôi nhìn nó — nên lời dặn cho
 * Claude ở `ganNhan.ts` nói rõ: nghĩ về một chuyện không phải là việc cần làm.
 */

import Link from "next/link";
import { useState, useTransition } from "react";

import { doiTrangThaiViec } from "@/lib/ghiChu/actions";

export function OViecCanLam({
  id,
  moTa,
  xong: xongBanDau,
  idNoiDung,
  tenNoiDung,
}: {
  id: string;
  moTa: string;
  xong: boolean;
  idNoiDung: string;
  tenNoiDung: string;
}) {
  const [xong, setXong] = useState(xongBanDau);
  const [dangChay, batDau] = useTransition();

  return (
    <li className="flex items-start gap-3 rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
      <input
        type="checkbox"
        checked={xong}
        disabled={dangChay}
        onChange={() => {
          const moi = !xong;
          setXong(moi);
          batDau(() =>
            doiTrangThaiViec(id, moi ? "done" : "todo").then(() => undefined),
          );
        }}
        className="mt-0.5 size-4 shrink-0 accent-cam-600 dark:accent-cam-500"
      />
      <div className="min-w-0 flex-1">
        <p
          className={`text-sm leading-relaxed ${
            xong ? "text-neutral-400 line-through dark:text-neutral-600" : ""
          }`}
        >
          {moTa}
        </p>
        <Link
          href={`/xem/${idNoiDung}`}
          className="mt-0.5 inline-block text-xs text-neutral-500 underline hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-200"
        >
          {tenNoiDung.slice(0, 50)}
          {tenNoiDung.length > 50 ? "…" : ""}
        </Link>
      </div>
    </li>
  );
}
