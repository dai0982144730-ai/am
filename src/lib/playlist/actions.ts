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
import {
  datLaiThuTu as datLaiThuTuLoi,
  doiTenThuMuc as doiTenThuMucLoi,
  doiThuTu as doiThuTuLoi,
  huyXoaThuMuc as huyXoaThuMucLoi,
  taoThuMucMoi as taoThuMucMoiLoi,
  themVaoThuMuc as themVaoThuMucLoi,
  xoaKhoiThuMuc as xoaKhoiThuMucLoi,
  xoaThuMuc as xoaThuMucLoi,
} from "./thanhVien";

export interface KetQua {
  ok: boolean;
  thongDiep: string;
}

/**
 * Làm mới MỌI trang, không riêng `/playlist`.
 *
 * Thêm/bớt một bài khỏi playlist đổi nhãn playlist trên chính thẻ nội dung đó,
 * mà thẻ ấy có mặt ở khắp nơi: trang chủ, Khám phá, trang xem, Thư viện, Lịch
 * sử. Chỉ làm mới `/playlist` thì bấm xong quay ra vẫn thấy như cũ — trông y
 * như nút không chạy, dù dưới database đã ghi đúng.
 */
function lamMoiMoiTrangCoThe(): void {
  revalidatePath("/", "layout");
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

/**
 * Dữ liệu cho menu ba chấm — nạp một lần lúc mở menu, không nạp sẵn cho mọi
 * thẻ nội dung trên trang (một trang Khám phá có tới hai bốn thẻ, nạp sẵn cho
 * hết là hai bốn lượt hỏi database không ai cần).
 */
export async function layDuLieuMenuBaCham(contentItemId: string): Promise<{
  cacPlaylist: { id: string; ten: string }[];
  dangTrongThuVien: boolean;
}> {
  const [cacPlaylist, muc] = await Promise.all([
    prisma.youTubePlaylist.findMany({
      where: { deletionRequestedAt: null },
      orderBy: { title: "asc" },
      select: { id: true, title: true },
    }),
    prisma.libraryItem.findUnique({
      where: { contentItemId },
      select: { id: true },
    }),
  ]);

  return {
    cacPlaylist: cacPlaylist.map((p) => ({ id: p.id, ten: p.title })),
    dangTrongThuVien: Boolean(muc),
  };
}

/** Tạo một thư mục mới trên Am — chưa có gì thật trên YouTube. */
export async function taoThuMuc(ten: string): Promise<KetQua & { id?: string }> {
  const chan = await chanCua("tạo thư mục playlist");
  if (chan) return chan;

  const sach = ten.trim();
  if (!sach) return { ok: false, thongDiep: "Chưa đặt tên." };

  const { id } = await taoThuMucMoiLoi(sach);
  revalidatePath("/playlist");
  return { ok: true, thongDiep: `Đã tạo "${sach}" trên Am.`, id };
}

/** Thêm một nội dung vào thư mục — làm ngay trên Am, không cần duyệt. */
export async function themVaoThuMuc(
  contentItemId: string,
  playlistId: string,
): Promise<KetQua> {
  const chan = await chanCua("thêm vào playlist");
  if (chan) return chan;

  const kq = await themVaoThuMucLoi(contentItemId, playlistId, "user");
  lamMoiMoiTrangCoThe();
  return kq;
}

/** Bỏ một nội dung khỏi thư mục — làm ngay trên Am, không cần duyệt. */
export async function xoaKhoiThuMuc(
  contentItemId: string,
  playlistId: string,
): Promise<KetQua> {
  const chan = await chanCua("bỏ khỏi playlist");
  if (chan) return chan;

  const kq = await xoaKhoiThuMucLoi(contentItemId, playlistId);
  lamMoiMoiTrangCoThe();
  return kq;
}

/**
 * Chuyển một nội dung từ thư mục này sang thư mục khác — làm ngay trên Am.
 *
 * Chỉ là thêm-rồi-bớt gộp thành một hành động cho người dùng, nhưng viết
 * thành một lệnh riêng để giao diện gọi MỘT lần thay vì hai, và thông điệp trả
 * về nói đúng việc vừa xảy ra ("đã chuyển") thay vì hai câu rời rạc.
 */
export async function chuyenDenThuMuc(
  contentItemId: string,
  tuPlaylistId: string,
  denPlaylistId: string,
): Promise<KetQua> {
  const chan = await chanCua("chuyển playlist");
  if (chan) return chan;

  const kqThem = await themVaoThuMucLoi(contentItemId, denPlaylistId, "user");
  if (!kqThem.ok) return kqThem;
  await xoaKhoiThuMucLoi(contentItemId, tuPlaylistId);

  lamMoiMoiTrangCoThe();
  return { ok: true, thongDiep: kqThem.thongDiep.replace("Đã thêm vào", "Đã chuyển sang") };
}

/** Đổi chỗ một nội dung với nội dung liền kề trong thư mục — làm ngay trên Am. */
export async function doiThuTu(
  playlistId: string,
  contentItemId: string,
  huong: "len" | "xuong",
): Promise<KetQua> {
  const chan = await chanCua("đổi thứ tự playlist");
  if (chan) return chan;

  const kq = await doiThuTuLoi(playlistId, contentItemId, huong);
  revalidatePath(`/playlist/${playlistId}`);
  revalidatePath("/playlist");
  return kq;
}

/** Ghi lại thứ tự sau khi kéo-thả — làm ngay trên Am, chưa đụng YouTube. */
export async function datLaiThuTu(
  playlistId: string,
  thuTuMoi: string[],
): Promise<KetQua> {
  const chan = await chanCua("đổi thứ tự playlist");
  if (chan) return chan;

  const kq = await datLaiThuTuLoi(playlistId, thuTuMoi);
  revalidatePath(`/playlist/${playlistId}`);
  revalidatePath("/playlist");
  return kq;
}

/** Đổi tên thư mục trên Am — thật thì sinh đề xuất chờ duyệt. */
export async function doiTenThuMuc(
  playlistId: string,
  tenMoi: string,
): Promise<KetQua> {
  const chan = await chanCua("đổi tên playlist");
  if (chan) return chan;

  const kq = await doiTenThuMucLoi(playlistId, tenMoi);
  revalidatePath("/playlist");
  return kq;
}

/** Yêu cầu xoá thư mục — CHƯA xoá gì thật, chỉ ẩn đi và chờ duyệt. */
export async function xoaThuMuc(playlistId: string): Promise<KetQua> {
  const chan = await chanCua("xoá thư mục playlist");
  if (chan) return chan;

  const kq = await xoaThuMucLoi(playlistId);
  revalidatePath("/playlist");
  return kq;
}

/** Huỷ yêu cầu xoá — thư mục hiện lại bình thường. */
export async function huyXoaThuMuc(playlistId: string): Promise<KetQua> {
  const chan = await chanCua("huỷ xoá thư mục playlist");
  if (chan) return chan;

  const kq = await huyXoaThuMucLoi(playlistId);
  revalidatePath("/playlist");
  return kq;
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
      thongDiep:
        `Đọc về ${kq.soDoc} playlist (${kq.themMoi} mới)` +
        (kq.matBenYoutube > 0
          ? `, gỡ ${kq.matBenYoutube} thư mục đã xoá bên YouTube.`
          : "."),
    };
  } catch (e) {
    return {
      ok: false,
      thongDiep: e instanceof Error ? e.message : "Đồng bộ không được.",
    };
  }
}
