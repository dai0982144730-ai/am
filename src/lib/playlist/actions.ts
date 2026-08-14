"use server";

/**
 * Duyệt, từ chối, áp dụng đề xuất playlist.
 *
 * Ba việc tách rời có chủ đích: **duyệt không phải là áp dụng**. Bấm duyệt chỉ
 * ghi lại ý định; phải bấm thêm một lần nữa mới thật sự chạm vào tài khoản
 * YouTube. Gộp hai bước làm một thì một cú bấm nhầm là đã đổi thứ ngoài đời.
 */

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db/prisma";
import { doiHoiChuDuAn } from "@/lib/quyen";

import { apDungDeXuat } from "./apDung";
import { dongBoPlaylist } from "./dongBo";

export interface KetQua {
  ok: boolean;
  thongDiep: string;
}

async function chanCua(viec: string): Promise<KetQua | null> {
  try {
    await doiHoiChuDuAn(viec);
    return null;
  } catch (e) {
    return {
      ok: false,
      thongDiep: e instanceof Error ? e.message : "Không có quyền.",
    };
  }
}

/** Duyệt một đề xuất — mới chỉ là ghi nhận ý định, chưa đụng tới YouTube. */
export async function duyet(id: string): Promise<KetQua> {
  const chan = await chanCua("duyệt đề xuất playlist");
  if (chan) return chan;

  await prisma.playlistOrganizationSuggestion.update({
    where: { id },
    data: { status: "approved", decidedAt: new Date() },
  });

  revalidatePath("/playlist");
  return {
    ok: true,
    thongDiep: "Đã duyệt. Bấm 'Ghi lên YouTube' để thực hiện.",
  };
}

/** Từ chối một đề xuất. */
export async function tuChoi(id: string): Promise<KetQua> {
  const chan = await chanCua("từ chối đề xuất playlist");
  if (chan) return chan;

  await prisma.playlistOrganizationSuggestion.update({
    where: { id },
    data: { status: "rejected", decidedAt: new Date() },
  });

  revalidatePath("/playlist");
  return { ok: true, thongDiep: "Đã bỏ." };
}

/**
 * Ghi thật lên YouTube.
 *
 * Đây là lời gọi duy nhất từ giao diện đi tới chỗ ghi thật. `apDungDeXuat` còn
 * kiểm lại lần nữa rằng đề xuất đang ở trạng thái đã duyệt.
 */
export async function ghiLenYouTube(id: string): Promise<KetQua> {
  const chan = await chanCua("ghi lên YouTube");
  if (chan) return chan;

  const kq = await apDungDeXuat(id);
  revalidatePath("/playlist");
  return { ok: kq.ok, thongDiep: kq.thongDiep };
}

/** Bật/tắt việc cho trợ lý sắp xếp một playlist. */
export async function batTatChoSapXep(
  id: string,
  bat: boolean,
): Promise<KetQua> {
  const chan = await chanCua("đổi playlist trợ lý được sắp xếp");
  if (chan) return chan;

  await prisma.youTubePlaylist.update({
    where: { id },
    data: { managedByAI: bat },
  });

  revalidatePath("/playlist");
  return {
    ok: true,
    thongDiep: bat
      ? "Trợ lý sẽ đề xuất video cho playlist này."
      : "Đã tắt — trợ lý không đụng tới playlist này nữa.",
  };
}

/** Đọc lại danh sách playlist từ YouTube. Chỉ đọc, không sửa gì. */
export async function dongBoLai(): Promise<KetQua> {
  const chan = await chanCua("đồng bộ playlist");
  if (chan) return chan;

  try {
    const kq = await dongBoPlaylist();
    revalidatePath("/playlist");
    return {
      ok: true,
      thongDiep: `Đọc về ${kq.soDoc} playlist (${kq.themMoi} mới).`,
    };
  } catch (e) {
    return {
      ok: false,
      thongDiep: e instanceof Error ? e.message : "Đồng bộ không được.",
    };
  }
}
