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
  doiTenTrenYouTube,
  ghiThuTuLenYouTube,
  themLenYouTube,
  xoaKhoiYouTube,
  xoaPlaylistTrenYouTube,
} from "./ghiThang";
import {
  datLaiThuTu as datLaiThuTuLoi,
  doiTenThuMuc as doiTenThuMucLoi,
  huyXoaThuMuc as huyXoaThuMucLoi,
  taoThuMucMoi as taoThuMucMoiLoi,
  themVaoThuMuc as themVaoThuMucLoi,
  soSanhVaSinhDeXuat,
  xoaKhoiThuMuc as xoaKhoiThuMucLoi,
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

/**
 * Đồng ý một gợi ý của trợ lý VÀ ghi luôn lên YouTube — một cú bấm.
 *
 * Bản cũ tách "Duyệt" và "Ghi lên YouTube" thành hai nút ở hai khu vực khác
 * nhau, cốt để một cú bấm nhầm không đổi được tài khoản thật. Nhưng từ khi
 * thao tác của chính chủ nhà ghi thẳng lên YouTube, giữ hai bước cho riêng
 * phần gợi ý của trợ lý chỉ còn gây rối: cùng một trang mà hai kiểu hành xử.
 * Cái phanh thật sự vẫn còn — trợ lý không tự bấm được, phải chủ nhà bấm.
 */
export async function dongYVaGhi(id: string): Promise<KetQua> {
  const chan = await chanCua("đồng ý gợi ý playlist");
  if (chan) return chan;

  await prisma.playlistOrganizationSuggestion.update({
    where: { id },
    data: { status: "approved", decidedAt: new Date() },
  });

  const kq = await apDungDeXuat(id);
  lamMoiMoiTrangCoThe();
  return kq;
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

/**
 * Ghép lời nhắn phần YouTube vào kết quả.
 *
 * YouTube hỏng KHÔNG làm hỏng thao tác — việc trên Am đã ghi xong từ trước,
 * đây chỉ là nói thêm cho biết phần ghi thật chưa tới nơi.
 */
function kemLoiYouTube(kq: KetQua, ghi: { ok: boolean; thongDiep: string }): KetQua {
  if (ghi.ok) return kq;
  return { ...kq, thongDiep: `${kq.thongDiep} (YouTube chưa nhận: ${ghi.thongDiep})` };
}

/**
 * So lại Am với YouTube SAU KHI đã ghi xong.
 *
 * THỨ TỰ Ở ĐÂY LÀ TẤT CẢ. Bản trước để `themVaoThuMuc` tự so ngay lúc sửa
 * database, tức là TRƯỚC khi ghi lên YouTube — bộ so sánh nhìn thấy Am có mà
 * YouTube chưa có, liền đẻ ra một đề xuất chờ duyệt. Ghi xong thì đề xuất ấy
 * vẫn nằm lại, bắt chủ nhà đi duyệt đúng cái việc mình vừa tự tay làm. Đúng
 * chuyện chủ dự án gặp khi chuyển bài từ "Chụp ảnh" sang "0 AI".
 *
 * Gọi ở đây thì ảnh chụp đã được cập nhật, không còn lệch để mà đẻ đề xuất —
 * và nó còn tự đóng những đề xuất cũ đã hết lý do tồn tại.
 */
async function soLaiSauKhiGhi(...cacPlaylistId: string[]): Promise<void> {
  for (const id of new Set(cacPlaylistId)) {
    await soSanhVaSinhDeXuat(id);
  }
}

/** Thêm một nội dung vào thư mục — ghi thẳng lên YouTube luôn, không cần duyệt. */
export async function themVaoThuMuc(
  contentItemId: string,
  playlistId: string,
): Promise<KetQua> {
  const chan = await chanCua("thêm vào playlist");
  if (chan) return chan;

  const kq = await themVaoThuMucLoi(contentItemId, playlistId, "user", false);
  if (!kq.ok) return kq;

  const ghi = await themLenYouTube(playlistId, contentItemId);
  await soLaiSauKhiGhi(playlistId);
  lamMoiMoiTrangCoThe();
  return kemLoiYouTube(kq, ghi);
}

/** Bỏ một nội dung khỏi thư mục — ghi thẳng lên YouTube luôn, không cần duyệt. */
export async function xoaKhoiThuMuc(
  contentItemId: string,
  playlistId: string,
): Promise<KetQua> {
  const chan = await chanCua("bỏ khỏi playlist");
  if (chan) return chan;

  const kq = await xoaKhoiThuMucLoi(contentItemId, playlistId, false);
  if (!kq.ok) return kq;

  const ghi = await xoaKhoiYouTube(playlistId, contentItemId);
  await soLaiSauKhiGhi(playlistId);
  lamMoiMoiTrangCoThe();
  return kemLoiYouTube(kq, ghi);
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

  const kqThem = await themVaoThuMucLoi(contentItemId, denPlaylistId, "user", false);
  if (!kqThem.ok) return kqThem;
  await xoaKhoiThuMucLoi(contentItemId, tuPlaylistId, false);

  // Ghi thật cả hai đầu. Thêm trước, bớt sau — hỏng giữa chừng thì video nằm
  // ở cả hai chỗ, khó chịu nhưng không mất; làm ngược lại thì nó biến mất hẳn.
  const ghiThem = await themLenYouTube(denPlaylistId, contentItemId);
  const ghiBot = await xoaKhoiYouTube(tuPlaylistId, contentItemId);

  await soLaiSauKhiGhi(denPlaylistId, tuPlaylistId);
  lamMoiMoiTrangCoThe();
  const kq = {
    ok: true,
    thongDiep: kqThem.thongDiep.replace("Đã thêm vào", "Đã chuyển sang"),
  };
  return kemLoiYouTube(kq, ghiThem.ok ? ghiBot : ghiThem);
}

/** Ghi lại thứ tự sau khi kéo-thả — ghi thẳng lên YouTube luôn. */
export async function datLaiThuTu(
  playlistId: string,
  thuTuMoi: string[],
): Promise<KetQua> {
  const chan = await chanCua("đổi thứ tự playlist");
  if (chan) return chan;

  const kq = await datLaiThuTuLoi(playlistId, thuTuMoi, false);
  if (!kq.ok) return kq;

  const ghi = await ghiThuTuLenYouTube(playlistId);
  await soLaiSauKhiGhi(playlistId);
  revalidatePath(`/playlist/${playlistId}`);
  revalidatePath("/playlist");
  return kemLoiYouTube(kq, ghi);
}

/**
 * Sắp xếp lại thứ tự GIỮA các playlist sau khi kéo-thả trên trang Playlist.
 *
 * CHỈ ĐỔI TRÊN AM. YouTube không có API sắp xếp thứ tự giữa các playlist —
 * chỉ sắp được video bên trong một playlist. Nên đây là thứ duy nhất trong bộ
 * playlist không ghi ra ngoài được, và cũng không cần: nó chỉ đổi cách trang
 * này bày ra cho dễ tìm.
 */
export async function sapXepPlaylist(thuTuMoi: string[]): Promise<KetQua> {
  const chan = await chanCua("sắp xếp playlist");
  if (chan) return chan;

  const dangCo = await prisma.youTubePlaylist.findMany({
    where: { deletionRequestedAt: null },
    select: { id: true },
  });
  const hopLe = new Set(dangCo.map((p) => p.id));
  if (thuTuMoi.some((id) => !hopLe.has(id))) {
    return { ok: false, thongDiep: "Danh sách không khớp — tải lại trang rồi thử lại." };
  }

  await prisma.$transaction(
    thuTuMoi.map((id, i) =>
      prisma.youTubePlaylist.update({ where: { id }, data: { viTri: i } }),
    ),
  );

  revalidatePath("/playlist");
  return { ok: true, thongDiep: "Đã lưu thứ tự." };
}

/** Đổi tên thư mục — đổi luôn cả trên YouTube, không cần duyệt. */
export async function doiTenThuMuc(
  playlistId: string,
  tenMoi: string,
): Promise<KetQua> {
  const chan = await chanCua("đổi tên playlist");
  if (chan) return chan;

  const kq = await doiTenThuMucLoi(playlistId, tenMoi, false);
  if (!kq.ok) return kq;

  const ghi = await doiTenTrenYouTube(playlistId, tenMoi.trim());
  revalidatePath("/playlist");
  return kemLoiYouTube(kq, ghi);
}

/**
 * Xoá thư mục — xoá luôn cả trên YouTube.
 *
 * VIỆC KHÔNG LÙI ĐƯỢC. Giao diện đã hỏi lại một lần trước khi gọi tới đây;
 * xoá xong thì YouTube không có thùng rác để lấy lại.
 *
 * Xoá bên YouTube TRƯỚC rồi mới xoá trên Am: làm ngược lại thì hỏng giữa chừng
 * là mất dấu hoàn toàn — Am không còn biết playlist nào cần xoá nữa.
 */
export async function xoaThuMuc(playlistId: string): Promise<KetQua> {
  const chan = await chanCua("xoá thư mục playlist");
  if (chan) return chan;

  const ghi = await xoaPlaylistTrenYouTube(playlistId);
  if (!ghi.ok) {
    return { ok: false, thongDiep: `Chưa xoá được trên YouTube: ${ghi.thongDiep}` };
  }

  await prisma.youTubePlaylist.delete({ where: { id: playlistId } });
  revalidatePath("/playlist");
  return { ok: true, thongDiep: "Đã xoá hẳn, cả trên YouTube." };
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
