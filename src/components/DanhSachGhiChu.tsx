"use client";

/**
 * Danh sách ghi chú của một video, bấm vào mốc giờ là nhảy tới đúng chỗ.
 *
 * Cái nhảy-tới-đúng-chỗ mới là lý do ghi chú ở đây khác ghi chú trong một ứng
 * dụng bình thường. Lưu được giây thứ mấy mà bấm vào không đi tới đó thì con số
 * ấy chỉ để trang trí.
 */

import { useState, useTransition } from "react";

import { xoaGhiChu } from "@/lib/ghiChu/actions";
import { tuaToi } from "@/lib/tieuThu/viTriHienTai";

export interface GhiChuGon {
  id: string;
  chu: string;
  giay: number | null;
  nhan: string[];
  loai: string;
  bangGiongNoi: boolean;
  luc: Date;
}

function docPhutGiay(giay: number): string {
  const g = Math.floor(giay / 3600);
  const p = Math.floor((giay % 3600) / 60);
  const s = Math.floor(giay % 60);
  const haiSo = (n: number) => String(n).padStart(2, "0");
  return g > 0 ? `${g}:${haiSo(p)}:${haiSo(s)}` : `${p}:${haiSo(s)}`;
}

const TEN_LOAI: Record<string, string> = {
  action_item: "việc cần làm",
  quote: "trích dẫn",
};

export function DanhSachGhiChu({
  cacGhiChu,
  laChu,
}: {
  cacGhiChu: GhiChuGon[];
  laChu: boolean;
}) {
  const [daXoa, setDaXoa] = useState<Set<string>>(new Set());
  const [dangChay, batDau] = useTransition();

  const conLai = cacGhiChu.filter((g) => !daXoa.has(g.id));
  if (conLai.length === 0) return null;

  return (
    <section className="mt-5">
      <h3 className="mb-2 text-sm font-semibold">
        {conLai.length} ghi chú của bạn
      </h3>
      <ul className="space-y-2">
        {conLai.map((g) => (
          <li
            key={g.id}
            className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800"
          >
            <div className="flex items-start gap-3">
              {g.giay !== null ? (
                <button
                  type="button"
                  onClick={() => {
                    if (!tuaToi(g.giay!)) return;
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="shrink-0 rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-xs tabular-nums text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
                >
                  {docPhutGiay(g.giay)}
                </button>
              ) : null}

              <div className="min-w-0 flex-1">
                <p className="text-sm leading-relaxed">{g.chu}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {g.nhan.map((n) => (
                    <span
                      key={n}
                      className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
                    >
                      {n}
                    </span>
                  ))}
                  {TEN_LOAI[g.loai] ? (
                    <span className="text-xs text-neutral-400">
                      {TEN_LOAI[g.loai]}
                    </span>
                  ) : null}
                  {g.nhan.length === 0 ? (
                    <span className="text-xs text-neutral-400">
                      chưa gắn nhãn
                    </span>
                  ) : null}
                  {g.bangGiongNoi ? (
                    <span className="text-xs text-neutral-400">· đọc</span>
                  ) : null}
                </div>
              </div>

              {laChu ? (
                <button
                  type="button"
                  disabled={dangChay}
                  onClick={() =>
                    batDau(async () => {
                      const kq = await xoaGhiChu(g.id);
                      if (kq.ok) setDaXoa((truoc) => new Set(truoc).add(g.id));
                    })
                  }
                  className="shrink-0 text-xs text-neutral-400 underline hover:text-neutral-700 disabled:opacity-40 dark:hover:text-neutral-200"
                >
                  Xoá
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
