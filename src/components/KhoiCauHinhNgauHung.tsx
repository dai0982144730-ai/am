"use client";

/**
 * Khối "Cấu hình" bên trong chip Ngẫu hứng ở trang Khám phá.
 *
 * ## Thay cho trang "New"
 *
 * Trước đây đây là một trang riêng (`/quan-tam`, tên hiển thị "New"). Chủ dự
 * án chốt 2026-08-16: gỡ hẳn trang đó, dồn cùng một việc — thêm chủ đề, bật/tắt
 * tự quét — vào đúng chỗ nó thuộc về: bên trong bộ lọc của chính chuyên mục nó
 * sinh ra nội dung. Đứng riêng một trang thì phải nhớ đường đến đó; đứng trong
 * chip Ngẫu hứng thì mở chip là thấy luôn.
 *
 * ## Vì sao thu gọn được
 *
 * Đây là một khối CẤU HÌNH nằm giữa hàng nút lọc — phần lớn thời gian người ta
 * chỉ muốn lọc, không muốn sửa danh sách chủ đề. Bày cả bảng giá, ô nhập, danh
 * sách ra sẵn thì hàng lọc dài lê thê. Thu gọn lại chỉ còn một dòng tóm tắt,
 * bấm mũi tên mới bung ra để sửa.
 */

import { useState, useTransition } from "react";

import { batTatTuQuet, goTuKhoa, themTuKhoa } from "@/lib/quanTam/actions";
import {
  GIA_MOT_TU_KHOA,
  NGUONG_CANH_BAO_TU_KHOA,
} from "@/lib/quanTam/giaTuKhoa";

export interface TuKhoaGon {
  id: string;
  keyword: string;
  note: string | null;
  autoScan: boolean;
  resultCount: number;
  lastScannedAt: Date | null;
}

function docLuc(luc: Date | null): string {
  if (!luc) return "chưa quét lần nào";
  const soGio = Math.floor((Date.now() - luc.getTime()) / 3_600_000);
  if (soGio < 1) return "vừa quét xong";
  if (soGio < 24) return `quét ${soGio} giờ trước`;
  return `quét ${Math.floor(soGio / 24)} ngày trước`;
}

export function KhoiCauHinhNgauHung({
  cacTuKhoa,
  laChu,
  nganSachNgay,
}: {
  cacTuKhoa: TuKhoaGon[];
  laChu: boolean;
  nganSachNgay: number;
}) {
  const [mo, datMo] = useState(false);
  const [tuKhoaMoi, setTuKhoaMoi] = useState("");
  const [ghiChu, setGhiChu] = useState("");
  const [thongDiep, setThongDiep] = useState<string | null>(null);
  const [dangChay, batDau] = useTransition();

  const soDangBat = cacTuKhoa.filter((t) => t.autoScan).length;

  function chay(viec: () => Promise<{ ok: boolean; thongDiep: string }>) {
    batDau(async () => {
      const kq = await viec();
      setThongDiep(kq.thongDiep);
      if (kq.ok) {
        setTuKhoaMoi("");
        setGhiChu("");
      }
    });
  }

  return (
    <div className="mt-2 rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700">
      <button
        type="button"
        onClick={() => datMo((cu) => !cu)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs"
      >
        <span className="font-semibold text-neutral-600 dark:text-neutral-300">
          Cấu hình
          <span className="ml-1.5 font-normal text-neutral-400 dark:text-neutral-500">
            {soDangBat > 0
              ? `${soDangBat} chủ đề đang tự quét`
              : "chưa có chủ đề nào tự quét"}
          </span>
        </span>
        <span
          aria-hidden
          className={`text-neutral-400 transition-transform ${mo ? "rotate-180" : ""}`}
        >
          ▾
        </span>
      </button>

      {mo ? (
        <div className="border-t border-dashed border-neutral-300 p-3 dark:border-neutral-700">
          {soDangBat > NGUONG_CANH_BAO_TU_KHOA ? (
            <p className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              Đang bật quá {NGUONG_CANH_BAO_TU_KHOA} chủ đề — mỗi chủ đề tốn{" "}
              {GIA_MOT_TU_KHOA} đơn vị hạn mức YouTube mỗi đêm, tổng đang chiếm{" "}
              {(((soDangBat * GIA_MOT_TU_KHOA) / nganSachNgay) * 100).toFixed(1)}
              % ngân sách ngày ({nganSachNgay.toLocaleString("vi-VN")}). Tắt bớt
              chủ đề không còn quan tâm, kẻo phần quét kênh bị bóp.
            </p>
          ) : null}

          {laChu ? (
            <form
              className="flex flex-col gap-2 sm:flex-row"
              onSubmit={(e) => {
                e.preventDefault();
                chay(() => themTuKhoa(tuKhoaMoi, ghiChu));
              }}
            >
              <input
                value={tuKhoaMoi}
                onChange={(e) => setTuKhoaMoi(e.target.value)}
                placeholder="Hôm nay quan tâm gì?"
                className="flex-1 rounded-lg border border-neutral-300 px-3 py-1.5 text-xs outline-none focus:border-cam-500 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-cam-500"
              />
              <input
                value={ghiChu}
                onChange={(e) => setGhiChu(e.target.value)}
                placeholder="Ghi chú (không bắt buộc)"
                className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs outline-none focus:border-cam-500 sm:w-48 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-cam-500"
              />
              <button
                type="submit"
                disabled={dangChay || tuKhoaMoi.trim().length < 2}
                className="shrink-0 rounded-lg bg-cam-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40 dark:bg-cam-500"
              >
                Thêm
              </button>
            </form>
          ) : (
            <p className="rounded-lg border border-dashed border-neutral-300 p-3 text-center text-xs text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
              Đăng nhập để thêm chủ đề — mỗi chủ đề tiêu hạn mức YouTube của chủ
              nhà.
            </p>
          )}

          {thongDiep ? (
            <p className="mt-2 text-xs text-neutral-600 dark:text-neutral-300">
              {thongDiep}
            </p>
          ) : null}

          {cacTuKhoa.length === 0 ? (
            <p className="mt-4 text-center text-xs text-neutral-400">
              Chưa có chủ đề nào. Gõ thứ bạn đang tò mò vào ô trên.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-neutral-100 dark:divide-neutral-800">
              {cacTuKhoa.map((tu) => (
                <li
                  key={tu.id}
                  className="flex flex-wrap items-center gap-2 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium">{tu.keyword}</p>
                    <p className="mt-0.5 text-[11px] text-neutral-500 dark:text-neutral-400">
                      {tu.note ? `${tu.note} · ` : ""}
                      {tu.resultCount} nội dung · {docLuc(tu.lastScannedAt)}
                    </p>
                  </div>

                  {laChu ? (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          chay(() => batTatTuQuet(tu.id, !tu.autoScan))
                        }
                        disabled={dangChay}
                        title={
                          tu.autoScan
                            ? "Mỗi tối máy tự tìm thêm nội dung mới cho chủ đề này, tốn 100 đơn vị hạn mức. Bấm để tạm dừng."
                            : "Đang tạm dừng — không tìm thêm, không tốn hạn mức. Nội dung đã tìm được vẫn còn. Bấm để bật lại."
                        }
                        className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors disabled:opacity-40 ${
                          tu.autoScan
                            ? "border-cam-600 bg-cam-600 text-white dark:border-cam-500 dark:bg-cam-500"
                            : "border-neutral-300 text-neutral-500 dark:border-neutral-700"
                        }`}
                      >
                        {tu.autoScan ? "Đang tự quét" : "Đã tắt"}
                      </button>
                      <button
                        type="button"
                        onClick={() => chay(() => goTuKhoa(tu.id))}
                        disabled={dangChay}
                        title="Xoá hẳn chủ đề khỏi danh sách. Nội dung đã tìm được vẫn giữ nguyên trong kho, không mất."
                        className="text-[11px] text-neutral-400 underline hover:text-neutral-700 disabled:opacity-40 dark:hover:text-neutral-200"
                      >
                        Gỡ
                      </button>
                    </>
                  ) : (
                    <span className="text-[11px] text-neutral-400">
                      {tu.autoScan ? "đang tự quét" : "đã tắt"}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
