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
 * KHÔNG BAO GIỜ XOÁ PLAYLIST. Thêm video hay tạo playlist mới thì gỡ ra dễ; xoá
 * cả một playlist thì không lấy lại được. Trong file này không có hàm nào gọi
 * `playlists.delete`, và đừng thêm vào.
 */

import { prisma } from "@/lib/db/prisma";
import { ghiYouTube } from "@/lib/youtube/goiApi";

/** Lấy mã video YouTube từ đường dẫn. */
function maVideo(url: string | null): string | null {
  if (!url) return null;
  return /(?:v=|youtu\.be\/|embed\/)([\w-]{11})/.exec(url)?.[1] ?? null;
}

export interface KetQuaApDung {
  ok: boolean;
  thongDiep: string;
  /** Playlist mới được tạo, nếu có */
  playlistMoi?: string;
}

/**
 * Thực hiện một đề xuất đã duyệt.
 *
 * Thứ tự có chủ đích: tạo playlist trước (nếu cần), rồi mới thêm video. Nếu
 * bước thêm video hỏng thì playlist rỗng vẫn còn đó — khó chịu nhưng vô hại, và
 * lần sau chạy lại sẽ dùng luôn playlist ấy. Làm ngược lại thì không được, vì
 * chưa có playlist thì thêm vào đâu.
 */
export async function apDungDeXuat(idDeXuat: string): Promise<KetQuaApDung> {
  const deXuat = await prisma.playlistOrganizationSuggestion.findUnique({
    where: { id: idDeXuat },
    include: {
      contentItem: { select: { title: true, url: true } },
      suggestedPlaylist: { select: { youtubePlaylistId: true, title: true } },
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

  const ma = maVideo(deXuat.contentItem.url);
  if (!ma) {
    return { ok: false, thongDiep: "Không đọc được mã video từ đường dẫn." };
  }

  let idPlaylistThat = deXuat.suggestedPlaylist?.youtubePlaylistId ?? null;
  let tenPlaylist = deXuat.suggestedPlaylist?.title ?? "";
  let daTaoMoi: string | undefined;

  try {
    // ----- Bước 1: tạo playlist mới nếu cần -----
    if (!idPlaylistThat) {
      if (!deXuat.newPlaylistTitle) {
        return { ok: false, thongDiep: "Đề xuất thiếu tên playlist." };
      }

      const taoRa = await ghiYouTube<{ id?: string }>(
        "playlists.insert",
        "playlists",
        { part: "snippet,status" },
        {
          snippet: { title: deXuat.newPlaylistTitle },
          // Riêng tư mặc định: playlist do máy tạo mà công khai thì hoá ra
          // trợ lý tự đăng thứ gì đó lên trang cá nhân của chủ nhà
          status: { privacyStatus: "private" },
        },
      );

      if (!taoRa.id) {
        return { ok: false, thongDiep: "YouTube không trả về id playlist mới." };
      }

      idPlaylistThat = taoRa.id;
      tenPlaylist = deXuat.newPlaylistTitle;
      daTaoMoi = deXuat.newPlaylistTitle;

      const luu = await prisma.youTubePlaylist.create({
        data: {
          youtubePlaylistId: taoRa.id,
          title: deXuat.newPlaylistTitle,
          // Playlist do trợ lý tạo thì đương nhiên trợ lý được sắp xếp tiếp
          managedByAI: true,
          lastSyncedAt: new Date(),
        },
        select: { id: true },
      });

      await prisma.playlistActionLog.create({
        data: {
          actionType: "create_playlist",
          payload: { youtubePlaylistId: taoRa.id, title: deXuat.newPlaylistTitle },
          triggeredBy: "user_single_approval",
        },
      });

      // Nối đề xuất vào playlist vừa tạo, để lần sau nhìn lại biết nó đi đâu
      await prisma.playlistOrganizationSuggestion.update({
        where: { id: idDeXuat },
        data: { suggestedPlaylistId: luu.id },
      });
    }

    // ----- Bước 2: thêm video vào playlist -----
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
          tieuDe: deXuat.contentItem.title,
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
  } catch (e) {
    // Giữ nguyên trạng thái `approved` để bấm lại được sau khi sửa nguyên nhân
    return {
      ok: false,
      thongDiep: e instanceof Error ? e.message : "Ghi lên YouTube không được.",
      playlistMoi: daTaoMoi,
    };
  }
}
