import Link from "next/link";
import { Suspense } from "react";

import { ChipLoc } from "@/components/ChipLoc";
import { KhungTrang } from "@/components/KhungTrang";
import { OTimKiem } from "@/components/OTimKiem";
import { TheNoiDungCard } from "@/components/TheNoiDung";
import {
  danhSachTacGia,
  demTheoNhom,
  timNoiDung,
  type BoLoc,
} from "@/lib/nghiepVu/timVaLoc";
import { emailChuDuAn } from "@/lib/quyen";

export const dynamic = "force-dynamic";

function doSo(giaTri: string | undefined): number | undefined {
  if (!giaTri) return undefined;
  const so = Number(giaTri);
  return Number.isFinite(so) && so > 0 ? so : undefined;
}

/**
 * Đọc bộ lọc từ địa chỉ trang.
 *
 * Mỗi nhóm đúng một tham số, nên "chỉ chọn được một" là chuyện tự nhiên chứ
 * không phải luật phải viết ra. Ép kiểu ở đây là an toàn: giá trị lạ chỉ làm
 * truy vấn không khớp gì, không làm sập trang — và hàng nút chỉ sinh ra đúng
 * những giá trị hợp lệ.
 */
function docBoLoc(tham: Record<string, string | undefined>): BoLoc {
  return {
    tuKhoa: tham.q,
    nhom: tham.nhom as BoLoc["nhom"],

    thoiGian: tham.tg as BoLoc["thoiGian"],
    kenh: tham.kenh as BoLoc["kenh"],
    sapXep: tham.sap as BoLoc["sapXep"],
    nguon: tham.nguon as BoLoc["nguon"],
    tiengViet: tham.tv as BoLoc["tiengViet"],

    aiChuDe: tham.ai_chu_de as BoLoc["aiChuDe"],
    aiHang: tham.ai_hang as BoLoc["aiHang"],
    thTruongPhai: tham.th_truong_phai as BoLoc["thTruongPhai"],
    thDang: tham.th_dang as BoLoc["thDang"],
    trTheLoai: tham.tr_the_loai as BoLoc["trTheLoai"],
    trXuatXu: tham.tr_xuat_xu as BoLoc["trXuatXu"],
    trDoCang: tham.tr_do_cang as BoLoc["trDoCang"],
    trChuyenThat: tham.tr_that === "1",
    msTheLoai: tham.ms_the_loai as BoLoc["msTheLoai"],
    msDoDai: tham.ms_do_dai,
    msDaiBpm: tham.bpm,
    khLinhVuc: tham.kh_linh_vuc as BoLoc["khLinhVuc"],
    tacGiaId: tham.tac_gia,

    trang: doSo(tham.trang) ?? 1,
  };
}

export default async function TrangKhamPha({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const tham = await searchParams;

  const boLoc = docBoLoc(tham);

  const [email, dem, cacTacGia, ketQua] = await Promise.all([
    emailChuDuAn(),
    demTheoNhom(),
    danhSachTacGia(boLoc.nhom),
    timNoiDung(boLoc),
  ]);

  /** Giữ nguyên mọi bộ lọc khi chuyển trang, chỉ đổi số trang. */
  function duongDanTrang(trang: number): string {
    const moi = new URLSearchParams();
    for (const [khoa, giaTri] of Object.entries(tham)) {
      if (giaTri && khoa !== "trang") moi.set(khoa, giaTri);
    }
    moi.set("trang", String(trang));
    return `/kham-pha?${moi.toString()}`;
  }

  return (
    <KhungTrang emailNguoiDung={email}>
      <div className="w-full px-4 py-6 sm:px-6 lg:px-8">
        <h1 className="text-xl font-semibold tracking-tight">Khám phá</h1>

        <div className="mt-4">
          <Suspense fallback={<div className="h-10" />}>
            <OTimKiem />
          </Suspense>
        </div>

        <div className="mt-4">
          <Suspense fallback={<div className="h-20" />}>
            <ChipLoc demTheoNhom={dem} cacTacGia={cacTacGia} />
          </Suspense>
        </div>

        <p className="mt-4 text-sm text-neutral-500 dark:text-neutral-400">
          {ketQua.tongSo === 0
            ? "Không có nội dung nào khớp."
            : `${ketQua.tongSo} nội dung${
                ketQua.soTrang > 1
                  ? ` · trang ${ketQua.trang}/${ketQua.soTrang}`
                  : ""
              }`}
        </p>

        {ketQua.cacThe.length > 0 ? (
          <div className="mt-4 grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
            {ketQua.cacThe.map((the) => (
              <TheNoiDungCard key={the.id} muc={the} />
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-xl border border-dashed border-neutral-300 p-10 text-center dark:border-neutral-700">
            <p className="text-sm text-neutral-500">
              Thử bỏ bớt bộ lọc, hoặc gõ từ khoá khác.
            </p>
          </div>
        )}

        {ketQua.soTrang > 1 ? (
          <div className="mt-8 flex items-center justify-center gap-2">
            {ketQua.trang > 1 ? (
              <Link
                href={duongDanTrang(ketQua.trang - 1)}
                className="rounded-lg border border-neutral-200 px-3.5 py-1.5 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
              >
                ← Trước
              </Link>
            ) : null}
            <span className="px-3 text-sm text-neutral-500">
              {ketQua.trang} / {ketQua.soTrang}
            </span>
            {ketQua.trang < ketQua.soTrang ? (
              <Link
                href={duongDanTrang(ketQua.trang + 1)}
                className="rounded-lg border border-neutral-200 px-3.5 py-1.5 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
              >
                Sau →
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>
    </KhungTrang>
  );
}
