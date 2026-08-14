"use client";

/**
 * Chấm sao và gắn tag cảm xúc sau khi xem.
 *
 * VÌ SAO ĐÁNG CÔNG: bản thiết kế xếp đây là **tín hiệu tường minh, trọng số cao
 * hơn tín hiệu ngầm**. Xem hết một video chỉ nói lên "không tệ đến mức tắt";
 * ba sao kèm tag "quá dài" nói lên nhiều hơn hẳn, và nói được thứ mà thời lượng
 * xem không bao giờ nói ra.
 *
 * VÌ SAO TAG KHÁC NHAU THEO CHUYÊN MỤC: hỏi một bản nhạc có "hữu ích" không thì
 * vô nghĩa, hỏi một bài về AI có "thư giãn" không cũng vậy. Danh sách tag chung
 * cho mọi thứ sẽ khiến phần lớn lựa chọn thành nhiễu.
 */

import { useState, useTransition } from "react";

import type { DeviceType } from "@/generated/prisma/enums";
import { danhGia } from "@/lib/tieuThu/actions";

/** Tag hợp với mọi chuyên mục. */
const TAG_CHUNG = ["đáng suy ngẫm", "quá dài", "nhàm chán"];

/** Tag riêng từng chuyên mục — hỏi đúng thứ đáng hỏi. */
const TAG_RIENG: Record<string, string[]> = {
  ai: ["áp dụng được ngay", "lý thuyết suông", "đã biết rồi"],
  triet_hoc: ["an yên", "khó hiểu", "chạm tới mình"],
  truyen: ["sợ", "cuốn", "giọng đọc hay", "nghe như AI đọc"],
  music: ["thư giãn", "tăng năng lượng", "hợp lúc làm việc", "nghe lại được"],
  new_search: ["đúng thứ đang tìm", "lạc đề"],
  other: ["hữu ích"],
};

function docTag(chuyenMuc: string): string[] {
  return [...(TAG_RIENG[chuyenMuc] ?? TAG_RIENG.other), ...TAG_CHUNG];
}

export interface DanhGiaCamXucProps {
  idNoiDung: string;
  chuyenMuc: string;
  laChu: boolean;
  saoBanDau: number | null;
  tagBanDau: string[];
}

export function DanhGiaCamXuc({
  idNoiDung,
  chuyenMuc,
  laChu,
  saoBanDau,
  tagBanDau,
}: DanhGiaCamXucProps) {
  const [sao, setSao] = useState<number | null>(saoBanDau);
  const [tagDaChon, setTagDaChon] = useState<string[]>(tagBanDau);
  const [thongDiep, setThongDiep] = useState<string | null>(null);
  const [dangLuu, batDauLuu] = useTransition();

  const cacTag = docTag(chuyenMuc);
  const daTungDanhGia = saoBanDau !== null || tagBanDau.length > 0;

  function luu(saoMoi: number | null, tagMoi: string[]) {
    const thietBi: DeviceType =
      typeof window !== "undefined" && window.innerWidth < 768
        ? "mobile"
        : "desktop";

    batDauLuu(async () => {
      const kq = await danhGia(idNoiDung, saoMoi, tagMoi, thietBi);
      setThongDiep(kq.ok ? "Đã ghi nhận." : kq.thongDiep);
    });
  }

  function chonSao(n: number) {
    // Bấm lại đúng số sao đang chọn thì bỏ chọn — chấm nhầm còn sửa được
    const saoMoi = n === sao ? null : n;
    setSao(saoMoi);
    luu(saoMoi, tagDaChon);
  }

  function batTat(tag: string) {
    const tagMoi = tagDaChon.includes(tag)
      ? tagDaChon.filter((t) => t !== tag)
      : [...tagDaChon, tag];
    setTagDaChon(tagMoi);
    luu(sao, tagMoi);
  }

  if (!laChu) {
    return (
      <div className="mt-6 rounded-xl border border-dashed border-neutral-300 p-4 text-center dark:border-neutral-700">
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          Đăng nhập để đánh giá — đây là cách máy học gu của chủ nhà.
        </p>
      </div>
    );
  }

  return (
    <section className="mt-6 rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
      <h2 className="text-base font-semibold">
        {daTungDanhGia ? "Bạn đã đánh giá" : "Xem xong rồi thấy sao?"}
      </h2>
      <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
        Đánh giá ở đây nặng ký hơn nhiều so với việc bạn xem hết hay không.
      </p>

      <div className="mt-4 flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => chonSao(n)}
            disabled={dangLuu}
            aria-label={`${n} sao`}
            aria-pressed={sao !== null && n <= sao}
            className={`rounded-md px-1.5 text-2xl leading-none transition-colors disabled:opacity-50 ${
              sao !== null && n <= sao
                ? "text-amber-500"
                : "text-neutral-300 hover:text-amber-300 dark:text-neutral-600"
            }`}
          >
            ★
          </button>
        ))}
        {sao !== null ? (
          <span className="ml-2 text-sm text-neutral-500 dark:text-neutral-400">
            {sao}/5
          </span>
        ) : null}
      </div>

      <div className="mt-4">
        <p className="mb-2 text-xs font-medium text-neutral-600 dark:text-neutral-300">
          Cảm giác khi xem
        </p>
        <div className="flex flex-wrap gap-2">
          {cacTag.map((tag) => {
            const dangChon = tagDaChon.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => batTat(tag)}
                disabled={dangLuu}
                aria-pressed={dangChon}
                className={`rounded-full border px-3 py-1 text-xs transition-colors disabled:opacity-50 ${
                  dangChon
                    ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900"
                    : "border-neutral-200 text-neutral-600 hover:border-neutral-400 dark:border-neutral-700 dark:text-neutral-300"
                }`}
              >
                {tag}
              </button>
            );
          })}
        </div>
      </div>

      {thongDiep ? (
        <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
          {thongDiep}
        </p>
      ) : null}
    </section>
  );
}
