"use client";

/**
 * Bảng duyệt đề xuất playlist.
 *
 * ĐIỀU QUAN TRỌNG NHẤT VỀ GIAO DIỆN NÀY: **duyệt và ghi là hai nút khác nhau.**
 * Bấm "Duyệt" chỉ ghi lại ý định; phải bấm thêm "Ghi lên YouTube" mới thật sự
 * đổi tài khoản ngoài đời. Gộp lại một nút thì một cú bấm nhầm là xong chuyện —
 * mà đây là thứ duy nhất trong cả web này chạm được ra thế giới thật.
 *
 * Nút ghi cũng cố ý viết rõ là "lên YouTube", không viết "áp dụng" hay "OK".
 * Chữ trên nút phải nói đúng thứ nó làm.
 */

import Link from "next/link";
import { useState, useTransition } from "react";

import {
  batTatChoSapXep,
  dongBoLai,
  duyet,
  ghiLenYouTube,
  tuChoi,
} from "@/lib/playlist/actions";

export interface PlaylistGon {
  id: string;
  ten: string;
  soMuc: number;
  choSapXep: boolean;
}

export interface DeXuatGon {
  id: string;
  tieuDeVideo: string;
  idNoiDung: string;
  tenPlaylist: string;
  laPlaylistMoi: boolean;
  lyDo: string;
  trangThai: string;
}

export function BangPlaylist({
  cacPlaylist,
  cacDeXuat,
  laChu,
  coQuyenGhi,
}: {
  cacPlaylist: PlaylistGon[];
  cacDeXuat: DeXuatGon[];
  laChu: boolean;
  coQuyenGhi: boolean;
}) {
  const [thongDiep, setThongDiep] = useState<string | null>(null);
  const [dangChay, batDau] = useTransition();

  function chay(viec: () => Promise<{ ok: boolean; thongDiep: string }>) {
    batDau(async () => {
      const kq = await viec();
      setThongDiep(kq.thongDiep);
    });
  }

  const choDuyet = cacDeXuat.filter((d) => d.trangThai === "pending");
  const daDuyet = cacDeXuat.filter((d) => d.trangThai === "approved");
  const daGhi = cacDeXuat.filter((d) => d.trangThai === "applied");

  return (
    <div>
      {/* Cảnh báo thiếu quyền — nói trước khi người dùng bấm rồi mới gặp lỗi */}
      {laChu && !coQuyenGhi ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/40">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
            Tài khoản mới chỉ cấp quyền <strong>đọc</strong> YouTube.
          </p>
          <p className="mt-1.5 text-xs text-amber-700 dark:text-amber-400">
            Vẫn xem được playlist và đọc đề xuất, nhưng bấm &ldquo;Ghi lên
            YouTube&rdquo; sẽ báo lỗi. Muốn ghi thật thì phải cấp thêm quyền sửa
            playlist rồi đăng nhập lại — xem `docs/PROGRESS.md`, mục Phase 7b.
          </p>
        </div>
      ) : null}

      {thongDiep ? (
        <p className="mt-3 rounded-lg bg-neutral-100 px-3 py-2 text-sm dark:bg-neutral-900">
          {thongDiep}
        </p>
      ) : null}

      {/* Đề xuất đang chờ */}
      <section className="mt-6">
        <h2 className="text-base font-semibold">
          Chờ bạn quyết ({choDuyet.length})
        </h2>
        {choDuyet.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-400">
            Không có đề xuất nào đang chờ. Chạy{" "}
            <code>npx tsx scripts/de-xuat-playlist.ts</code> để trợ lý xem qua
            kho và đề xuất.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {choDuyet.map((d) => (
              <li
                key={d.id}
                className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800"
              >
                <Link
                  href={`/xem/${d.idNoiDung}`}
                  className="text-sm font-medium leading-snug hover:underline"
                >
                  {d.tieuDeVideo}
                </Link>
                <p className="mt-1.5 text-sm text-neutral-600 dark:text-neutral-300">
                  →{" "}
                  <strong>
                    {d.tenPlaylist}
                    {d.laPlaylistMoi ? " (playlist mới)" : ""}
                  </strong>
                </p>
                <p className="mt-1.5 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
                  {d.lyDo}
                </p>

                {laChu ? (
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      disabled={dangChay}
                      onClick={() => chay(() => duyet(d.id))}
                      className="rounded-lg border border-neutral-900 px-3 py-1.5 text-xs font-medium disabled:opacity-40 dark:border-white"
                    >
                      Duyệt
                    </button>
                    <button
                      type="button"
                      disabled={dangChay}
                      onClick={() => chay(() => tuChoi(d.id))}
                      className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs text-neutral-500 disabled:opacity-40 dark:border-neutral-700"
                    >
                      Bỏ
                    </button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Đã duyệt, chờ ghi thật */}
      {daDuyet.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-base font-semibold">
            Đã duyệt, chưa ghi ({daDuyet.length})
          </h2>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            Duyệt rồi vẫn chưa có gì thay đổi trên YouTube. Bấm nút dưới mới ghi
            thật.
          </p>
          <ul className="mt-3 space-y-2">
            {daDuyet.map((d) => (
              <li
                key={d.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-neutral-300 p-3 dark:border-neutral-700"
              >
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-sm">{d.tieuDeVideo}</p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    → {d.tenPlaylist}
                    {d.laPlaylistMoi ? " (sẽ tạo mới, để riêng tư)" : ""}
                  </p>
                </div>
                {laChu ? (
                  <button
                    type="button"
                    disabled={dangChay}
                    onClick={() => chay(() => ghiLenYouTube(d.id))}
                    className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40 dark:bg-white dark:text-neutral-900"
                  >
                    Ghi lên YouTube
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Đã ghi rồi */}
      {daGhi.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-base font-semibold">Đã ghi ({daGhi.length})</h2>
          <ul className="mt-3 space-y-1">
            {daGhi.map((d) => (
              <li
                key={d.id}
                className="flex items-baseline justify-between gap-3 text-sm text-neutral-500 dark:text-neutral-400"
              >
                <span className="line-clamp-1">{d.tieuDeVideo}</span>
                <span className="shrink-0 text-xs">→ {d.tenPlaylist}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Playlist thật */}
      <section className="mt-10">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-base font-semibold">
            Playlist của bạn ({cacPlaylist.length})
          </h2>
          {laChu ? (
            <button
              type="button"
              disabled={dangChay}
              onClick={() => chay(() => dongBoLai())}
              className="text-xs text-neutral-500 underline hover:text-neutral-900 disabled:opacity-40 dark:hover:text-neutral-200"
            >
              Đọc lại từ YouTube
            </button>
          ) : null}
        </div>
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          Trợ lý chỉ đề xuất cho những playlist bạn bật. Playlist tắt thì nó
          không đụng tới.
        </p>

        {cacPlaylist.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-400">
            Chưa đọc playlist nào về. Bấm &ldquo;Đọc lại từ YouTube&rdquo;.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-neutral-200 dark:divide-neutral-800">
            {cacPlaylist.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm">{p.ten}</p>
                  <p className="text-xs text-neutral-400">{p.soMuc} video</p>
                </div>
                {laChu ? (
                  <button
                    type="button"
                    disabled={dangChay}
                    onClick={() => chay(() => batTatChoSapXep(p.id, !p.choSapXep))}
                    className={`rounded-full border px-3 py-1 text-xs transition-colors disabled:opacity-40 ${
                      p.choSapXep
                        ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900"
                        : "border-neutral-300 text-neutral-500 dark:border-neutral-700"
                    }`}
                  >
                    {p.choSapXep ? "Cho sắp xếp" : "Không đụng tới"}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
