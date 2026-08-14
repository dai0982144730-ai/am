import Link from "next/link";
import { Suspense } from "react";

import { ChipLoc } from "@/components/ChipLoc";
import { KhungTrang } from "@/components/KhungTrang";
import { OTimKiem } from "@/components/OTimKiem";
import { TheNoiDungCard } from "@/components/TheNoiDung";
import type { ContentGroup } from "@/generated/prisma/enums";
import {
  demTheoNhom,
  timNoiDung,
  type KieuSapXep,
} from "@/lib/nghiepVu/timVaLoc";
import { emailChuDuAn } from "@/lib/quyen";

export const dynamic = "force-dynamic";

function doSo(giaTri: string | undefined): number | undefined {
  if (!giaTri) return undefined;
  const so = Number(giaTri);
  return Number.isFinite(so) && so > 0 ? so : undefined;
}

export default async function TrangKhamPha({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const tham = await searchParams;

  const [email, dem, ketQua] = await Promise.all([
    emailChuDuAn(),
    demTheoNhom(),
    timNoiDung({
      tuKhoa: tham.q,
      nhom: (tham.nhom as ContentGroup) || undefined,
      daThuatLai: tham.daThuatLai === "1",
      duoiBaoNhieuPhut: doSo(tham.duoi),
      tuBaoNhieuPhut: doSo(tham.tu),
      trongBaoNhieuNgay: doSo(tham.ngay),
      sapXep: (tham.sap as KieuSapXep) || "phu_hop_nhat",
      trang: doSo(tham.trang) ?? 1,
    }),
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
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <h1 className="text-xl font-semibold tracking-tight">Khám phá</h1>

        <div className="mt-4">
          <Suspense fallback={<div className="h-10" />}>
            <OTimKiem />
          </Suspense>
        </div>

        <div className="mt-4">
          <Suspense fallback={<div className="h-20" />}>
            <ChipLoc demTheoNhom={dem} />
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
