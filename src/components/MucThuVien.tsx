"use client";

/**
 * Một dòng trong thư viện — sửa được tại chỗ.
 *
 * VÌ SAO SỬA TẠI CHỖ CHỨ KHÔNG MỞ TRANG RIÊNG: sắp xếp thư viện là việc làm
 * theo mạch — đổi thư mục ba bốn mục liền, đánh dấu xong vài cái. Bắt bấm vào
 * từng mục rồi quay ra thì làm hai lần là bỏ cuộc.
 */

import Link from "next/link";
import { useState, useTransition } from "react";

import {
  doiThuMuc,
  doiTrangThaiDoc,
  luuGhiChuRieng,
} from "@/lib/thuVien/actions";
import {
  TRANG_THAI_DOC,
  type TrangThaiDoc,
} from "@/lib/thuVien/trangThai";

export interface MucThuVienGon {
  id: string;
  tieuDe: string;
  nguon: string;
  thuMuc: string | null;
  trangThai: string;
  ghiChuRieng: string | null;
  luocLuc: Date;
  anh: string | null;
  diem: number | null;
}

export function MucThuVien({
  muc,
  cacThuMuc,
}: {
  muc: MucThuVienGon;
  cacThuMuc: string[];
}) {
  const [thuMuc, setThuMuc] = useState(muc.thuMuc ?? "");
  const [trangThai, setTrangThai] = useState(muc.trangThai);
  const [ghiChu, setGhiChu] = useState(muc.ghiChuRieng ?? "");
  const [moGhiChu, setMoGhiChu] = useState(false);
  const [dangChay, batDau] = useTransition();

  return (
    <li className="flex gap-4 py-4">
      <Link
        href={`/xem/${muc.id}`}
        className="hidden w-32 shrink-0 overflow-hidden rounded-lg bg-neutral-100 sm:block dark:bg-neutral-800"
      >
        {muc.anh ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={muc.anh} alt="" className="aspect-video w-full object-cover" />
        ) : (
          <div className="aspect-video" />
        )}
      </Link>

      <div className="min-w-0 flex-1">
        <Link href={`/xem/${muc.id}`} className="hover:underline">
          <h3 className="line-clamp-2 text-sm font-medium leading-snug">
            {muc.tieuDe}
          </h3>
        </Link>
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          {muc.nguon}
          {muc.diem != null ? ` · ${muc.diem.toFixed(1)}/10` : ""} · cất{" "}
          {muc.luocLuc.toLocaleDateString("vi-VN")}
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          {/* Trạng thái đọc */}
          <select
            value={trangThai}
            disabled={dangChay}
            onChange={(e) => {
              const moi = e.target.value as TrangThaiDoc;
              setTrangThai(moi);
              batDau(() => doiTrangThaiDoc(muc.id, moi).then(() => undefined));
            }}
            className="rounded-md border border-neutral-300 bg-transparent px-2 py-1 text-xs disabled:opacity-40 dark:border-neutral-700"
          >
            {Object.entries(TRANG_THAI_DOC).map(([ma, ten]) => (
              <option key={ma} value={ma}>
                {ten}
              </option>
            ))}
          </select>

          {/* Thư mục — gõ tự do, có gợi ý từ những thư mục đã dùng */}
          <input
            list="cac-thu-muc"
            value={thuMuc}
            disabled={dangChay}
            placeholder="thư mục"
            onChange={(e) => setThuMuc(e.target.value)}
            onBlur={() => {
              if ((muc.thuMuc ?? "") === thuMuc.trim()) return;
              batDau(() => doiThuMuc(muc.id, thuMuc).then(() => undefined));
            }}
            className="w-32 rounded-md border border-neutral-300 bg-transparent px-2 py-1 text-xs disabled:opacity-40 dark:border-neutral-700"
          />
          <datalist id="cac-thu-muc">
            {cacThuMuc.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>

          <button
            type="button"
            onClick={() => setMoGhiChu((x) => !x)}
            className="text-xs text-neutral-400 underline hover:text-neutral-700 dark:hover:text-neutral-200"
          >
            {ghiChu ? "Sửa ghi chú" : "Ghi chú"}
          </button>
        </div>

        {moGhiChu ? (
          <textarea
            value={ghiChu}
            disabled={dangChay}
            rows={2}
            placeholder="Vì sao cất cái này lại?"
            onChange={(e) => setGhiChu(e.target.value)}
            onBlur={() => {
              if ((muc.ghiChuRieng ?? "") === ghiChu.trim()) return;
              batDau(() => luuGhiChuRieng(muc.id, ghiChu).then(() => undefined));
            }}
            className="mt-2 w-full rounded-md border border-neutral-300 bg-transparent px-2 py-1.5 text-xs disabled:opacity-40 dark:border-neutral-700"
          />
        ) : ghiChu ? (
          <p className="mt-2 text-xs italic text-neutral-500 dark:text-neutral-400">
            {ghiChu}
          </p>
        ) : null}
      </div>
    </li>
  );
}
