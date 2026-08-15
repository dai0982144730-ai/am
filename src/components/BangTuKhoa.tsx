"use client";

/**
 * Bảng quản lý từ khoá quan tâm.
 *
 * ĐIỀU QUAN TRỌNG NHẤT Ở ĐÂY LÀ NÓI THẲNG GIÁ. Lệnh tìm kiếm của YouTube đắt
 * gấp 100 lần mọi lệnh khác, cả ngày chỉ có 10.000 đơn vị. Bật mười từ khoá là
 * ăn mất 10% hạn mức ngày, và phần bị bóp lại chính là việc quét kênh — việc
 * chính. Giấu con số đó đi thì người dùng bật thoải mái rồi một hôm ngồi nhìn
 * lần quét đêm chết giữa chừng mà không hiểu vì sao.
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

export function BangTuKhoa({
  cacTuKhoa,
  laChu,
  nganSachNgay,
}: {
  cacTuKhoa: TuKhoaGon[];
  laChu: boolean;
  nganSachNgay: number;
}) {
  const [tuKhoaMoi, setTuKhoaMoi] = useState("");
  const [ghiChu, setGhiChu] = useState("");
  const [thongDiep, setThongDiep] = useState<string | null>(null);
  const [dangChay, batDau] = useTransition();

  const soDangBat = cacTuKhoa.filter((t) => t.autoScan).length;
  const tieuMoiDem = soDangBat * GIA_MOT_TU_KHOA;
  const phanTram = nganSachNgay > 0 ? (tieuMoiDem / nganSachNgay) * 100 : 0;
  const quaTay = soDangBat > NGUONG_CANH_BAO_TU_KHOA;

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
    <div>
      {/* Bảng giá — đặt trên cùng, trước cả ô nhập */}
      <div
        className={`rounded-xl border p-4 ${
          quaTay
            ? "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40"
            : "border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900"
        }`}
      >
        <p className="text-sm text-neutral-700 dark:text-neutral-300">
          <strong>{soDangBat}</strong> từ khoá đang bật ={" "}
          <strong>{tieuMoiDem.toLocaleString("vi-VN")}</strong> đơn vị hạn mức
          mỗi đêm, tức <strong>{phanTram.toFixed(1)}%</strong> ngân sách ngày (
          {nganSachNgay.toLocaleString("vi-VN")}).
        </p>
        <p className="mt-1.5 text-xs text-neutral-500 dark:text-neutral-400">
          Mỗi lần tìm kiếm tốn {GIA_MOT_TU_KHOA} đơn vị — đắt gấp 100 lần lệnh
          lấy chi tiết video. Phần hạn mức tiêu ở đây bị trừ vào phần dành cho
          việc quét kênh hằng đêm.
        </p>
        {quaTay ? (
          <p className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-400">
            Đang bật quá {NGUONG_CANH_BAO_TU_KHOA} từ khoá. Nên tắt bớt những từ
            không còn quan tâm, kẻo lần quét đêm hết hạn mức giữa chừng.
          </p>
        ) : null}
      </div>

      {/* Ô nhập */}
      {laChu ? (
        <form
          className="mt-5 flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            chay(() => themTuKhoa(tuKhoaMoi, ghiChu));
          }}
        >
          <input
            value={tuKhoaMoi}
            onChange={(e) => setTuKhoaMoi(e.target.value)}
            placeholder="Hôm nay quan tâm gì?"
            className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-cam-500 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-cam-500"
          />
          <input
            value={ghiChu}
            onChange={(e) => setGhiChu(e.target.value)}
            placeholder="Ghi chú (không bắt buộc)"
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-cam-500 sm:w-56 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-cam-500"
          />
          <button
            type="submit"
            disabled={dangChay || tuKhoaMoi.trim().length < 2}
            className="rounded-lg bg-cam-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40 dark:bg-cam-500 dark:text-white"
          >
            Thêm
          </button>
        </form>
      ) : (
        <p className="mt-5 rounded-lg border border-dashed border-neutral-300 p-4 text-center text-xs text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
          Đăng nhập để thêm từ khoá — mỗi từ khoá tiêu hạn mức YouTube của chủ
          nhà.
        </p>
      )}

      {thongDiep ? (
        <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-300">
          {thongDiep}
        </p>
      ) : null}

      {/* Ba nhãn dưới đây tự chúng không nói được gì — chủ dự án hỏi thẳng
          "đã tắt, gỡ nghĩa là gì". Giải thích ngay tại chỗ, đừng bắt đi tìm */}
      {cacTuKhoa.length > 0 ? (
        <dl className="mt-5 grid gap-2 rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-xs leading-relaxed sm:grid-cols-3 dark:border-neutral-800 dark:bg-neutral-900">
          <div>
            <dt className="font-semibold text-cam-700 dark:text-cam-300">
              Đang tự quét
            </dt>
            <dd className="mt-0.5 text-neutral-600 dark:text-neutral-300">
              Mỗi tối máy tự đi tìm thêm nội dung mới cho từ khoá này. Tốn 100
              đơn vị hạn mức YouTube mỗi đêm.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-neutral-700 dark:text-neutral-200">
              Đã tắt
            </dt>
            <dd className="mt-0.5 text-neutral-600 dark:text-neutral-300">
              Tạm dừng: không tìm thêm, không tốn hạn mức. Những gì đã tìm được
              vẫn nằm nguyên ở đây. Bấm lần nữa là bật lại.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-neutral-700 dark:text-neutral-200">
              Gỡ
            </dt>
            <dd className="mt-0.5 text-neutral-600 dark:text-neutral-300">
              Xoá hẳn từ khoá khỏi danh sách. <strong>Nội dung đã tìm được
              không mất</strong> — nó vẫn ở trong kho và ở Khám phá.
            </dd>
          </div>
        </dl>
      ) : null}

      {/* Danh sách */}
      {cacTuKhoa.length === 0 ? (
        <p className="mt-8 text-center text-sm text-neutral-400">
          Chưa có từ khoá nào. Gõ thứ bạn đang tò mò vào ô trên.
        </p>
      ) : (
        // HAI CỘT trên màn rộng — chủ dự án chốt 2026-08-15.
        //
        // Mỗi dòng từ khoá chỉ cao chừng 60px mà kéo hết bề ngang màn hình,
        // nên danh sách một cột vừa dài lê thê vừa để trống hai phần ba bên
        // phải. Hai cột thì liếc một cái là thấy hết.
        //
        // Dùng lưới chứ không dùng cột báo ở đây: các dòng cao bằng nhau nên
        // không sinh ra khoảng hở như bên trang Cài đặt, mà lưới thì giữ đúng
        // thứ tự trái-phải, dễ dò hơn.
        <ul className="mt-6 grid gap-x-8 lg:grid-cols-2">
          {cacTuKhoa.map((tu) => (
            <li
              key={tu.id}
              className="flex flex-wrap items-center gap-3 border-b border-neutral-200 py-3 dark:border-neutral-800"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{tu.keyword}</p>
                <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                  {tu.note ? `${tu.note} · ` : ""}
                  {tu.resultCount} nội dung · {docLuc(tu.lastScannedAt)}
                </p>
              </div>

              {laChu ? (
                <>
                  <button
                    type="button"
                    onClick={() => chay(() => batTatTuQuet(tu.id, !tu.autoScan))}
                    disabled={dangChay}
                    title={
                      tu.autoScan
                        ? "Mỗi tối máy tự tìm thêm nội dung mới cho từ khoá này, tốn 100 đơn vị hạn mức. Bấm để tạm dừng."
                        : "Đang tạm dừng — không tìm thêm, không tốn hạn mức. Nội dung đã tìm được vẫn còn. Bấm để bật lại."
                    }
                    className={`rounded-full border px-3 py-1 text-xs transition-colors disabled:opacity-40 ${
                      tu.autoScan
                        ? "border-cam-600 bg-cam-600 text-white dark:border-cam-500 dark:bg-cam-500 dark:text-white"
                        : "border-neutral-300 text-neutral-500 dark:border-neutral-700"
                    }`}
                  >
                    {tu.autoScan ? "Đang tự quét" : "Đã tắt"}
                  </button>
                  <button
                    type="button"
                    onClick={() => chay(() => goTuKhoa(tu.id))}
                    disabled={dangChay}
                    title="Xoá hẳn từ khoá khỏi danh sách. Nội dung đã tìm được vẫn giữ nguyên trong kho, không mất."
                    className="text-xs text-neutral-400 underline hover:text-neutral-700 disabled:opacity-40 dark:hover:text-neutral-200"
                  >
                    Gỡ
                  </button>
                </>
              ) : (
                <span className="text-xs text-neutral-400">
                  {tu.autoScan ? "đang tự quét" : "đã tắt"}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
