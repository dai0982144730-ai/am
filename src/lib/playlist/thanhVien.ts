/**
 * Thành viên playlist trên Am — sửa tự do, không cần duyệt.
 *
 * Nguyên tắc chốt 2026-08-17: Am giữ **ý Am muốn** (`PlaylistItem`) tách hẳn
 * khỏi **thứ đã thật trên YouTube** (`YouTubePlaylist.lastSyncedVideoIds`).
 * Sửa ý muốn — thêm/xoá/đổi tên/xoá thư mục — không đụng gì tới thế giới
 * thật, nên làm ngay, không cần duyệt, kể cả khi AI là người sửa.
 *
 * Chỉ khi so hai bên mà LỆCH thì mới có việc phải làm thật (`soSanhVaSinhDeXuat`
 * bên dưới), và việc đó luôn dừng lại ở một đề xuất chờ duyệt — chỗ ghi thật
 * nằm ở `apDung.ts`, file này không gọi YouTube.
 */

import { prisma } from "@/lib/db/prisma";

export interface KetQua {
  ok: boolean;
  thongDiep: string;
}

/** Lấy mã video YouTube từ đường dẫn — dùng để so với `lastSyncedVideoIds`. */
export function maVideoTuUrl(url: string | null): string | null {
  if (!url) return null;
  return /(?:v=|youtu\.be\/|embed\/)([\w-]{11})/.exec(url)?.[1] ?? null;
}

/**
 * Tạo một thư mục mới, CHƯA có thật trên YouTube.
 *
 * `youtubePlaylistId` để trống — đúng nghĩa "đang chờ". Chỉ khi có đề xuất
 * `create_playlist`/`new_save` được duyệt và ghi thật thì cột đó mới được
 * điền, xem `apDung.ts`.
 */
export async function taoThuMucMoi(ten: string): Promise<{ id: string }> {
  const sach = ten.trim().slice(0, 150) || "Thư mục mới";
  return prisma.youTubePlaylist.create({
    data: { title: sach },
    select: { id: true },
  });
}

/**
 * Đổi tên thư mục trên Am ngay lập tức.
 *
 * Nếu thư mục đã có thật trên YouTube (`youtubePlaylistId` khác rỗng), việc
 * đổi tên thật cần ghi — sinh một đề xuất `rename_playlist` chờ duyệt. Thư
 * mục còn đang chờ tạo thì đổi tên tại đây là đủ, chưa có gì thật để sinh đề
 * xuất, tên mới tự động dùng khi đề xuất tạo playlist được ghi.
 */
export async function doiTenThuMuc(
  playlistId: string,
  tenMoi: string,
): Promise<KetQua> {
  const sach = tenMoi.trim().slice(0, 150);
  if (!sach) return { ok: false, thongDiep: "Tên không được để trống." };

  const pl = await prisma.youTubePlaylist.findUnique({
    where: { id: playlistId },
    select: { youtubePlaylistId: true, title: true },
  });
  if (!pl) return { ok: false, thongDiep: "Không tìm thấy thư mục này." };
  if (pl.title === sach) return { ok: true, thongDiep: "Tên không đổi." };

  await prisma.youTubePlaylist.update({
    where: { id: playlistId },
    data: { title: sach },
  });

  if (pl.youtubePlaylistId) {
    await prisma.playlistOrganizationSuggestion.create({
      data: {
        suggestedPlaylistId: playlistId,
        currentPlaylistTitle: pl.title,
        newPlaylistTitle: sach,
        reason: `Bạn đổi tên thư mục từ "${pl.title}" thành "${sach}" trên Am.`,
        type: "rename_playlist",
        status: "pending",
      },
    });
  }

  return { ok: true, thongDiep: "Đã đổi tên." };
}

/**
 * Yêu cầu xoá một thư mục — CHƯA xoá gì cả.
 *
 * Chỉ đặt `deletionRequestedAt` để ẩn khỏi danh sách bình thường, và sinh một
 * đề xuất `delete_playlist` chờ duyệt. Xoá thật diễn ra ở `apDung.ts`, và chỉ
 * khi đề xuất đó được duyệt rồi bấm ghi. Playlist chưa từng có thật trên
 * YouTube thì xoá thẳng, không có gì để đề xuất.
 */
export async function xoaThuMuc(playlistId: string): Promise<KetQua> {
  const pl = await prisma.youTubePlaylist.findUnique({
    where: { id: playlistId },
    select: { youtubePlaylistId: true, title: true },
  });
  if (!pl) return { ok: false, thongDiep: "Không tìm thấy thư mục này." };

  if (!pl.youtubePlaylistId) {
    await prisma.youTubePlaylist.delete({ where: { id: playlistId } });
    return { ok: true, thongDiep: `Đã xoá "${pl.title}" — chưa từng có thật trên YouTube.` };
  }

  await prisma.youTubePlaylist.update({
    where: { id: playlistId },
    data: { deletionRequestedAt: new Date() },
  });

  // Xoá cả thư mục thì mọi đề xuất thêm/bớt riêng lẻ của nó không còn nghĩa gì
  await prisma.playlistOrganizationSuggestion.updateMany({
    where: { suggestedPlaylistId: playlistId, status: "pending" },
    data: { status: "rejected", decidedAt: new Date() },
  });

  await prisma.playlistOrganizationSuggestion.create({
    data: {
      suggestedPlaylistId: playlistId,
      currentPlaylistTitle: pl.title,
      reason: `Bạn yêu cầu xoá hẳn thư mục "${pl.title}" — việc DUY NHẤT không cứu lại được, cân nhắc kỹ trước khi duyệt.`,
      type: "delete_playlist",
      status: "pending",
    },
  });

  return {
    ok: true,
    thongDiep: `Đã ẩn "${pl.title}" và tạo đề xuất xoá thật — chờ bạn duyệt ở trang Playlist.`,
  };
}

/** Huỷ yêu cầu xoá — thư mục hiện lại bình thường. */
export async function huyXoaThuMuc(playlistId: string): Promise<KetQua> {
  await prisma.youTubePlaylist.update({
    where: { id: playlistId },
    data: { deletionRequestedAt: null },
  });
  await prisma.playlistOrganizationSuggestion.updateMany({
    where: { suggestedPlaylistId: playlistId, type: "delete_playlist", status: "pending" },
    data: { status: "rejected", decidedAt: new Date() },
  });
  return { ok: true, thongDiep: "Đã huỷ yêu cầu xoá." };
}

/**
 * Thêm một nội dung vào thư mục — ngay lập tức trên Am.
 *
 * @param nguoiThem "user" khi chính chủ nhà bấm; "ai" khi trợ lý tự quyết —
 *   cả hai đều được phép sửa tự do, chỉ khác ở chỗ ghi lại ai làm.
 */
export async function themVaoThuMuc(
  contentItemId: string,
  playlistId: string,
  nguoiThem: "user" | "ai" = "user",
): Promise<KetQua> {
  const [pl, noiDung] = await Promise.all([
    prisma.youTubePlaylist.findUnique({
      where: { id: playlistId },
      select: { id: true, title: true, items: { select: { position: true } } },
    }),
    prisma.contentItem.findUnique({
      where: { id: contentItemId },
      select: { id: true, title: true },
    }),
  ]);
  if (!pl) return { ok: false, thongDiep: "Không tìm thấy thư mục này." };
  if (!noiDung) return { ok: false, thongDiep: "Không tìm thấy nội dung này." };

  const viTriKe = pl.items.reduce((max, i) => Math.max(max, i.position), -1) + 1;

  await prisma.playlistItem.upsert({
    where: { playlistId_contentItemId: { playlistId, contentItemId } },
    create: { playlistId, contentItemId, position: viTriKe, addedBy: nguoiThem },
    update: {},
  });

  await soSanhVaSinhDeXuat(playlistId);

  return { ok: true, thongDiep: `Đã thêm vào "${pl.title}".` };
}

/**
 * Bỏ một nội dung khỏi thư mục — ngay lập tức trên Am.
 *
 * Nếu nội dung đó đã thật sự có trên YouTube, `soSanhVaSinhDeXuat` bên dưới sẽ
 * tự phát hiện chỗ lệch và sinh đề xuất `remove_item` chờ duyệt.
 */
export async function xoaKhoiThuMuc(
  contentItemId: string,
  playlistId: string,
): Promise<KetQua> {
  await prisma.playlistItem.deleteMany({ where: { playlistId, contentItemId } });
  await soSanhVaSinhDeXuat(playlistId);
  return { ok: true, thongDiep: "Đã bỏ khỏi thư mục." };
}

/**
 * So sánh ý Am muốn (`PlaylistItem`) với thật trên YouTube
 * (`lastSyncedVideoIds`), rồi tự dọn đề xuất cho khớp.
 *
 * BA VIỆC, đúng nguyên tắc đã chốt:
 *
 *   1. Thiếu trên YouTube mà Am muốn có → đề xuất `new_save` nếu chưa có.
 *   2. Có trên YouTube mà Am không muốn nữa → đề xuất `remove_item` nếu chưa có.
 *   3. Đề xuất cũ đã hết lý do tồn tại (thêm cái đã có sẵn rồi, hoặc bớt cái
 *      đã tự mất rồi) → tự đóng, KHÔNG bắt duyệt một việc đã xong hoặc vô nghĩa.
 *
 * CHỈ so phần video YouTube thật — nội dung nguồn khác (podcast, blog…) chỉ
 * sống trên Am, YouTube không nhận được nên không có gì để so.
 */
export async function soSanhVaSinhDeXuat(playlistId: string): Promise<void> {
  const pl = await prisma.youTubePlaylist.findUnique({
    where: { id: playlistId },
    select: {
      id: true,
      lastSyncedVideoIds: true,
      deletionRequestedAt: true,
      items: {
        select: {
          contentItem: { select: { id: true, url: true, source: { select: { type: true } } } },
        },
      },
    },
  });
  // Thư mục đang chờ xoá thì thôi, không sinh thêm đề xuất thêm/bớt nữa
  if (!pl || pl.deletionRequestedAt) return;

  const muonCo = new Map<string, string>(); // videoId -> contentItemId
  for (const it of pl.items) {
    if (it.contentItem.source.type !== "youtube_channel") continue;
    const ma = maVideoTuUrl(it.contentItem.url);
    if (ma) muonCo.set(ma, it.contentItem.id);
  }
  const thatCo = new Set(pl.lastSyncedVideoIds);

  const canThem = [...muonCo.entries()].filter(([ma]) => !thatCo.has(ma));
  const canBot = [...thatCo].filter((ma) => !muonCo.has(ma));

  const deXuatDangCho = await prisma.playlistOrganizationSuggestion.findMany({
    where: {
      suggestedPlaylistId: playlistId,
      status: { in: ["pending", "approved"] },
      type: { in: ["new_save", "remove_item"] },
    },
    select: {
      id: true,
      type: true,
      contentItemId: true,
      contentItem: { select: { url: true } },
    },
  });

  // Đóng MỌI đề xuất new_save/remove_item mà thực tế đã trùng với thật rồi
  // (video đã có/đã mất trên YouTube từ trước) HOẶC đã hết ý nghĩa (chủ nhà
  // đổi ý trên Am trước khi kịp duyệt) — dựa đúng một câu hỏi: "ý Am muốn bây
  // giờ có khớp thật không?" Khớp rồi thì đề xuất thêm/bớt không còn lý do tồn
  // tại, dù nó khớp theo hướng nào.
  const coRoi = new Set<string>();
  for (const dx of deXuatDangCho) {
    if (!dx.contentItemId) continue;
    coRoi.add(dx.contentItemId);

    const ma = maVideoTuUrl(dx.contentItem?.url ?? null);
    const trongYMuon = muonCo.has(ma ?? "");
    const trongThat = ma ? thatCo.has(ma) : false;

    if (trongYMuon === trongThat) {
      await prisma.playlistOrganizationSuggestion.update({
        where: { id: dx.id },
        data: {
          status: "rejected",
          decidedAt: new Date(),
          reason: trongThat
            ? "Đã có sẵn trên YouTube rồi, không cần ghi nữa."
            : "Bạn đã đổi ý hoặc video đã tự mất khỏi YouTube — không còn gì để ghi.",
        },
      });
      coRoi.delete(dx.contentItemId);
    }
  }

  for (const [, contentItemId] of canThem) {
    if (coRoi.has(contentItemId)) continue;
    await prisma.playlistOrganizationSuggestion.create({
      data: {
        contentItemId,
        suggestedPlaylistId: playlistId,
        reason: "Bạn đã thêm trên Am, chờ ghi thật lên YouTube.",
        type: "new_save",
        status: "pending",
      },
    });
  }

  for (const ma of canBot) {
    const idThat = await prisma.contentItem.findFirst({
      where: { url: { contains: ma } },
      select: { id: true },
    });
    if (!idThat || coRoi.has(idThat.id)) continue;
    await prisma.playlistOrganizationSuggestion.create({
      data: {
        contentItemId: idThat.id,
        suggestedPlaylistId: playlistId,
        reason: "Bạn đã bỏ khỏi thư mục trên Am, chờ xoá thật khỏi YouTube.",
        type: "remove_item",
        status: "pending",
      },
    });
  }
}
