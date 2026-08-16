"use server";

/**
 * Thêm, bật/tắt, gỡ từ khoá quan tâm.
 *
 * Chỉ chủ dự án làm được — mỗi từ khoá đang bật tiêu 100 đơn vị hạn mức YouTube
 * mỗi đêm, tức là tiêu tài nguyên có hạn của chủ nhà. Đây đúng là nhóm việc
 * `quyen.ts` nói phải chặn.
 */

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db/prisma";
import { doiHoiChuDuAn } from "@/lib/quyen";

export interface KetQua {
  ok: boolean;
  thongDiep: string;
}

/** Dài quá thì gần như chắc chắn là dán nhầm cả đoạn văn vào. */
const DAI_TOI_DA = 80;

/** Thêm một từ khoá mới. */
export async function themTuKhoa(
  tuKhoa: string,
  ghiChu: string,
): Promise<KetQua> {
  try {
    await doiHoiChuDuAn("thêm từ khoá quan tâm");
  } catch (e) {
    return { ok: false, thongDiep: e instanceof Error ? e.message : "Không có quyền." };
  }

  const sach = tuKhoa.trim().replace(/\s+/g, " ");

  if (sach.length < 2) {
    return { ok: false, thongDiep: "Từ khoá quá ngắn." };
  }
  if (sach.length > DAI_TOI_DA) {
    return {
      ok: false,
      thongDiep: `Từ khoá dài quá ${DAI_TOI_DA} ký tự — YouTube tìm theo cả câu dài thường ra rất ít kết quả.`,
    };
  }

  const daCo = await prisma.adHocInterest.findUnique({
    where: { keyword: sach },
    select: { id: true },
  });
  if (daCo) {
    return { ok: false, thongDiep: `"${sach}" đã có trong danh sách rồi.` };
  }

  await prisma.adHocInterest.create({
    data: { keyword: sach, note: ghiChu.trim() || null },
  });

  revalidatePath("/kham-pha");
  return {
    ok: true,
    thongDiep: `Đã thêm "${sach}". Tối nay máy sẽ tìm giúp, sáng mai có trong bản tin.`,
  };
}

/** Bật/tắt việc tự quét cho một từ khoá. */
export async function batTatTuQuet(id: string, bat: boolean): Promise<KetQua> {
  try {
    await doiHoiChuDuAn("bật/tắt từ khoá quan tâm");
  } catch (e) {
    return { ok: false, thongDiep: e instanceof Error ? e.message : "Không có quyền." };
  }

  await prisma.adHocInterest.update({
    where: { id },
    data: { autoScan: bat, active: bat },
  });

  revalidatePath("/kham-pha");
  return {
    ok: true,
    thongDiep: bat ? "Đã bật tự quét." : "Đã tắt — không tiêu hạn mức nữa.",
  };
}

/**
 * Gỡ một từ khoá.
 *
 * Nội dung đã tìm được vẫn nằm nguyên trong kho — quan hệ tới `AdHocInterest`
 * chỉ được gỡ ra (`SetNull`), không xoá theo. Gỡ từ khoá là "thôi không tìm
 * nữa", không phải "xoá những gì đã tìm được".
 */
export async function goTuKhoa(id: string): Promise<KetQua> {
  try {
    await doiHoiChuDuAn("gỡ từ khoá quan tâm");
  } catch (e) {
    return { ok: false, thongDiep: e instanceof Error ? e.message : "Không có quyền." };
  }

  const tu = await prisma.adHocInterest.findUnique({
    where: { id },
    select: { keyword: true, resultCount: true },
  });
  if (!tu) return { ok: false, thongDiep: "Không tìm thấy từ khoá này." };

  await prisma.adHocInterest.delete({ where: { id } });

  revalidatePath("/kham-pha");
  return {
    ok: true,
    thongDiep: `Đã gỡ "${tu.keyword}". ${tu.resultCount} nội dung đã tìm được vẫn giữ nguyên trong kho.`,
  };
}
