/**
 * Áp dụng một đề xuất đã được duyệt — **chỗ DUY NHẤT trong cả dự án ghi thật
 * lên tài khoản YouTube**.
 *
 * Vì vậy file này cố ý ngắn và cố ý khó gọi nhầm:
 *
 *   - Chỉ nhận vào id của một đề xuất đang ở trạng thái `approved`. Không có
 *     cách nào bảo nó "thêm video X vào playlist Y" trực tiếp.
 *   - Mỗi lần chỉ làm đúng một việc. Không có chế độ chạy hàng loạt.
 *   - Mọi việc đã làm đều ghi vào `PlaylistActionLog` để tra lại và sửa tay.
 *
 * XOÁ PLAYLIST GIỜ CÓ, NHƯNG CHỈ QUA ĐỀ XUẤT ĐÃ DUYỆT (từ 2026-08-17). Trước
 * đây file này cố tình không có đường nào gọi `playlists.delete`. Chủ dự án
 * chốt lại: xoá vẫn được, miễn là qua đúng vòng đề xuất → duyệt → ghi như mọi
 * thao tác khác — không có ngoại lệ "không bao giờ" nữa, chỉ có "không bao giờ
 * TỰ ĐỘNG".
 */

import { prisma } from "@/lib/db/prisma";
import { maVideoTuUrl } from "@/lib/playlist/thanhVien";
import { ghiYouTube } from "@/lib/youtube/goiApi";

export interface KetQuaApDung {
  ok: boolean;
  thongDiep: string;
  /** Playlist mới được tạo, nếu có */
  playlistMoi?: string;
}

/**
 * Tạo thật playlist trên YouTube cho một đề xuất cần playlist mới.
 *
 * HAI TÌNH HUỐNG CẦN PHÂN BIỆT:
 *
 *   1. Đề xuất trỏ tới MỘT HÀNG `YouTubePlaylist` CÓ SẴN trên Am nhưng chưa có
 *      thật (`youtubePlaylistId` rỗng) — trường hợp chủ nhà bấm "+ Playlist
 *      mới" ở menu ba chấm. Tạo xong thì CẬP NHẬT đúng hàng đó, không tạo hàng
 *      mới — nếu không thư mục sẽ nhân đôi trên Am.
 *   2. Đề xuất chỉ mang một cái tên (`newPlaylistTitle`), không trỏ tới hàng
 *      nào — trường hợp cũ, Claude tự đề xuất playlist mới qua `sinhDeXuat`.
 *      Tạo một hàng `YouTubePlaylist` mới.
 */
async function taoPlaylistThat(
  ten: string,
  playlistAmSanCo: string | null,
): Promise<string> {
  const taoRa = await ghiYouTube<{ id?: string }>(
    "playlists.insert",
    "playlists",
    { part: "snippet,status" },
    {
      snippet: { title: ten },
      // Riêng tư mặc định: playlist do máy tạo mà công khai thì hoá ra
      // trợ lý tự đăng thứ gì đó lên trang cá nhân của chủ nhà
      status: { privacyStatus: "private" },
    },
  );
  if (!taoRa.id) throw new Error("YouTube không trả về id playlist mới.");

  if (playlistAmSanCo) {
    await prisma.youTubePlaylist.update({
      where: { id: playlistAmSanCo },
      data: { youtubePlaylistId: taoRa.id, lastSyncedAt: new Date() },
    });
  } else {
    await prisma.youTubePlaylist.create({
      data: {
        youtubePlaylistId: taoRa.id,
        title: ten,
        // Playlist do trợ lý tạo thì đương nhiên trợ lý được sắp xếp tiếp
        managedByAI: true,
        lastSyncedAt: new Date(),
      },
    });
  }

  await prisma.playlistActionLog.create({
    data: {
      actionType: "create_playlist",
      payload: { youtubePlaylistId: taoRa.id, title: ten },
      triggeredBy: "user_single_approval",
    },
  });

  return taoRa.id;
}

/**
 * Thực hiện một đề xuất đã duyệt.
 *
 * Thứ tự có chủ đích cho `new_save`: tạo playlist trước (nếu cần), rồi mới
 * thêm video. Nếu bước thêm video hỏng thì playlist rỗng vẫn còn đó — khó
 * chịu nhưng vô hại, và lần sau chạy lại sẽ dùng luôn playlist ấy.
 */
export async function apDungDeXuat(idDeXuat: string): Promise<KetQuaApDung> {
  const deXuat = await prisma.playlistOrganizationSuggestion.findUnique({
    where: { id: idDeXuat },
    include: {
      contentItem: { select: { title: true, url: true } },
      suggestedPlaylist: {
        select: { id: true, youtubePlaylistId: true, title: true },
      },
    },
  });

  if (!deXuat) {
    return { ok: false, thongDiep: "Không tìm thấy đề xuất này." };
  }

  // Chốt chặn quan trọng nhất của cả file: chưa duyệt thì không đụng gì tới
  // YouTube. Kiểm ở đây chứ không chỉ ở giao diện.
  if (deXuat.status !== "approved") {
    return {
      ok: false,
      thongDiep:
        deXuat.status === "applied"
          ? "Đề xuất này đã được áp dụng rồi."
          : "Đề xuất chưa được duyệt — không được ghi lên YouTube.",
    };
  }

  try {
    switch (deXuat.type) {
      case "new_save":
      case "misplaced_fix":
        return await apDungThemVideo(idDeXuat, deXuat);
      case "remove_item":
        return await apDungXoaVideo(idDeXuat, deXuat);
      case "delete_playlist":
        return await apDungXoaPlaylist(idDeXuat, deXuat);
      case "rename_playlist":
        return await apDungDoiTen(idDeXuat, deXuat);
    }
  } catch (e) {
    // Giữ nguyên trạng thái `approved` để bấm lại được sau khi sửa nguyên nhân
    return {
      ok: false,
      thongDiep: e instanceof Error ? e.message : "Ghi lên YouTube không được.",
    };
  }
}

type DeXuatDayDu = NonNullable<
  Awaited<ReturnType<typeof prisma.playlistOrganizationSuggestion.findUnique>>
> & {
  contentItem: { title: string; url: string | null } | null;
  suggestedPlaylist: { id: string; youtubePlaylistId: string | null; title: string } | null;
};

async function apDungThemVideo(
  idDeXuat: string,
  deXuat: DeXuatDayDu,
): Promise<KetQuaApDung> {
  const ma = maVideoTuUrl(deXuat.contentItem?.url ?? null);
  if (!ma) return { ok: false, thongDiep: "Không đọc được mã video từ đường dẫn." };

  let idPlaylistThat = deXuat.suggestedPlaylist?.youtubePlaylistId ?? null;
  let tenPlaylist = deXuat.suggestedPlaylist?.title ?? "";
  let daTaoMoi: string | undefined;

  if (!idPlaylistThat) {
    const ten = deXuat.suggestedPlaylist?.title ?? deXuat.newPlaylistTitle;
    if (!ten) return { ok: false, thongDiep: "Đề xuất thiếu tên playlist." };

    idPlaylistThat = await taoPlaylistThat(ten, deXuat.suggestedPlaylist?.id ?? null);
    tenPlaylist = ten;
    daTaoMoi = ten;

    if (!deXuat.suggestedPlaylist) {
      const luu = await prisma.youTubePlaylist.findUnique({
        where: { youtubePlaylistId: idPlaylistThat },
        select: { id: true },
      });
      if (luu) {
        await prisma.playlistOrganizationSuggestion.update({
          where: { id: idDeXuat },
          data: { suggestedPlaylistId: luu.id },
        });
      }
    }
  }

  await ghiYouTube(
    "playlistItems.insert",
    "playlistItems",
    { part: "snippet" },
    {
      snippet: {
        playlistId: idPlaylistThat,
        resourceId: { kind: "youtube#video", videoId: ma },
      },
    },
  );

  await prisma.playlistActionLog.create({
    data: {
      actionType: "add_item",
      payload: {
        youtubePlaylistId: idPlaylistThat,
        videoId: ma,
        tieuDe: deXuat.contentItem?.title,
      },
      triggeredBy: "user_single_approval",
    },
  });

  await prisma.playlistOrganizationSuggestion.update({
    where: { id: idDeXuat },
    data: { status: "applied", decidedAt: new Date() },
  });

  return {
    ok: true,
    thongDiep: daTaoMoi
      ? `Đã tạo playlist "${daTaoMoi}" (riêng tư) và thêm video vào.`
      : `Đã thêm vào playlist "${tenPlaylist}".`,
    playlistMoi: daTaoMoi,
  };
}

async function apDungXoaVideo(
  idDeXuat: string,
  deXuat: DeXuatDayDu,
): Promise<KetQuaApDung> {
  const ma = maVideoTuUrl(deXuat.contentItem?.url ?? null);
  const idPlaylistThat = deXuat.suggestedPlaylist?.youtubePlaylistId;
  if (!ma || !idPlaylistThat) {
    return { ok: false, thongDiep: "Thiếu mã video hoặc playlist chưa có thật." };
  }

  // playlistItems.delete cần đúng id CỦA DÒNG trong playlist (khác id video),
  // nên phải tìm lại đúng dòng trước khi xoá.
  const trang = await ghiApiDoc<{ items?: { id?: string; snippet?: { resourceId?: { videoId?: string } } }[] }>(
    idPlaylistThat,
    ma,
  );
  const dong = trang?.items?.find((i) => i.snippet?.resourceId?.videoId === ma);
  if (!dong?.id) {
    // Đã tự mất trên YouTube rồi — coi như xong, không cần báo lỗi
    await prisma.playlistOrganizationSuggestion.update({
      where: { id: idDeXuat },
      data: { status: "applied", decidedAt: new Date() },
    });
    return { ok: true, thongDiep: "Video đã không còn trong playlist từ trước — không cần xoá nữa." };
  }

  await ghiYouTube("playlistItems.delete", "playlistItems", { id: dong.id }, undefined, "DELETE");

  await prisma.playlistActionLog.create({
    data: {
      actionType: "remove_item",
      payload: { youtubePlaylistId: idPlaylistThat, videoId: ma, tieuDe: deXuat.contentItem?.title },
      triggeredBy: "user_single_approval",
    },
  });

  await prisma.playlistOrganizationSuggestion.update({
    where: { id: idDeXuat },
    data: { status: "applied", decidedAt: new Date() },
  });

  return { ok: true, thongDiep: "Đã xoá khỏi playlist trên YouTube." };
}

/** Đọc một trang playlistItems — dùng riêng để tìm đúng id dòng cần xoá. */
async function ghiApiDoc<T>(playlistId: string, _video: string): Promise<T> {
  const { goiYouTube } = await import("@/lib/youtube/goiApi");
  return goiYouTube<T>(
    "playlistItems.list",
    "playlistItems",
    { part: "snippet", playlistId, maxResults: 50 },
    { canDangNhap: true },
  );
}

async function apDungXoaPlaylist(
  idDeXuat: string,
  deXuat: DeXuatDayDu,
): Promise<KetQuaApDung> {
  const idPlaylistThat = deXuat.suggestedPlaylist?.youtubePlaylistId;
  const idPlaylistAm = deXuat.suggestedPlaylist?.id;
  if (!idPlaylistAm) return { ok: false, thongDiep: "Không tìm thấy thư mục để xoá." };

  if (idPlaylistThat) {
    await ghiYouTube("playlists.delete", "playlists", { id: idPlaylistThat }, undefined, "DELETE");
    await prisma.playlistActionLog.create({
      data: {
        actionType: "delete_playlist",
        payload: { youtubePlaylistId: idPlaylistThat, title: deXuat.currentPlaylistTitle },
        triggeredBy: "user_single_approval",
      },
    });
  }

  await prisma.playlistOrganizationSuggestion.update({
    where: { id: idDeXuat },
    data: { status: "applied", decidedAt: new Date() },
  });
  // Xoá hàng Am cuối cùng — kéo theo mọi PlaylistItem và mọi đề xuất khác của
  // playlist này (onDelete: Cascade / SetNull tương ứng)
  await prisma.youTubePlaylist.delete({ where: { id: idPlaylistAm } });

  return {
    ok: true,
    thongDiep: idPlaylistThat
      ? "Đã xoá playlist thật trên YouTube."
      : "Đã xoá thư mục — chưa từng có thật trên YouTube nên không cần gọi gì thêm.",
  };
}

async function apDungDoiTen(
  idDeXuat: string,
  deXuat: DeXuatDayDu,
): Promise<KetQuaApDung> {
  const idPlaylistThat = deXuat.suggestedPlaylist?.youtubePlaylistId;
  if (!idPlaylistThat || !deXuat.newPlaylistTitle) {
    return { ok: false, thongDiep: "Thiếu playlist thật hoặc tên mới." };
  }

  await ghiYouTube(
    "playlists.update",
    "playlists",
    { part: "snippet" },
    { id: idPlaylistThat, snippet: { title: deXuat.newPlaylistTitle } },
    "PUT",
  );

  await prisma.playlistActionLog.create({
    data: {
      actionType: "rename_playlist",
      payload: { youtubePlaylistId: idPlaylistThat, tenMoi: deXuat.newPlaylistTitle },
      triggeredBy: "user_single_approval",
    },
  });

  await prisma.playlistOrganizationSuggestion.update({
    where: { id: idDeXuat },
    data: { status: "applied", decidedAt: new Date() },
  });

  return { ok: true, thongDiep: `Đã đổi tên thật thành "${deXuat.newPlaylistTitle}".` };
}
