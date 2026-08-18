/**
 * Ghi THẲNG lên YouTube khi chính chủ nhà bấm nút — không qua bước duyệt.
 *
 * ## Vì sao bỏ bước duyệt cho thao tác của người dùng
 *
 * Nguyên tắc "đề xuất → duyệt → áp dụng" trong `CLAUDE.md` sinh ra để chặn
 * **trợ lý** tự ý đổi tài khoản thật của chủ nhà. Nhưng nó bị áp cả cho việc
 * chính chủ nhà tự tay bấm — thành ra bấm "xoá khỏi playlist" xong phải sang
 * trang khác duyệt lại chính việc mình vừa làm, rồi bấm thêm lần nữa để ghi.
 * Ba cú bấm cho một ý định.
 *
 * Chủ dự án chốt 2026-08-18: *"Bỏ chức năng duyệt khỏi hệ thống đã làm là làm
 * luôn không cần duyệt"*. Đúng tinh thần nguyên tắc gốc — **cú bấm của chủ nhà
 * CHÍNH LÀ sự cho phép**, không cần xin phép lần nữa. Phần đề xuất chờ duyệt
 * vẫn giữ nguyên cho thứ **trợ lý** tự nghĩ ra, đó mới là chỗ cần cái phanh.
 *
 * ## Không bao giờ chặn thao tác vì YouTube hỏng
 *
 * Mọi hàm ở đây đều đã được gọi SAU khi Am ghi xong ý muốn vào database. Nên
 * khi YouTube từ chối (hết hạn mức, mất mạng, video riêng tư), việc trên Am
 * vẫn còn nguyên — chỉ trả về lời nhắn nói rõ phần YouTube chưa xong. Ném lỗi
 * ở đây sẽ làm hỏng cả thao tác người dùng vừa làm đúng.
 */

import { prisma } from "@/lib/db/prisma";
import { ghiYouTube, goiYouTube } from "@/lib/youtube/goiApi";

import { maVideoTuUrl } from "./thanhVien";

export interface KetQuaGhi {
  ok: boolean;
  thongDiep: string;
}

/**
 * Cập nhật ảnh chụp "thật đang có gì trên YouTube" sau khi ghi xong.
 *
 * BẮT BUỘC, không phải làm cho đẹp. `soSanhVaSinhDeXuat` so ý Am muốn với
 * `lastSyncedVideoIds` để tìm chỗ lệch; ghi thật xong mà không cập nhật ảnh
 * chụp thì nó vẫn thấy lệch và đẻ ra một đề xuất chờ duyệt cho đúng việc vừa
 * làm xong — chính là cái vòng luẩn quẩn mà bỏ bước duyệt là để thoát khỏi.
 */
async function capNhatAnhChup(
  playlistId: string,
  doi: (cu: string[]) => string[],
): Promise<void> {
  const pl = await prisma.youTubePlaylist.findUnique({
    where: { id: playlistId },
    select: { lastSyncedVideoIds: true },
  });
  if (!pl) return;
  const moi = doi(pl.lastSyncedVideoIds);
  await prisma.youTubePlaylist.update({
    where: { id: playlistId },
    data: { lastSyncedVideoIds: moi, itemCount: moi.length, lastSyncedAt: new Date() },
  });
}

/** Gói lời than của YouTube thành câu tiếng Việt đọc được. */
function loiGon(e: unknown): string {
  return e instanceof Error ? e.message : "không rõ lý do";
}

/**
 * Tạo playlist thật trên YouTube cho một thư mục mới có trên Am.
 *
 * Trả về id thật, hoặc `null` nếu tạo hỏng. Đặt riêng tư giống hệt
 * `apDung.ts`: playlist do máy tạo mà công khai thì hoá ra tự đăng thứ gì đó
 * lên trang cá nhân của chủ nhà.
 */
async function baoDamCoThat(playlistId: string): Promise<string | null> {
  const pl = await prisma.youTubePlaylist.findUnique({
    where: { id: playlistId },
    select: { id: true, title: true, youtubePlaylistId: true },
  });
  if (!pl) return null;
  if (pl.youtubePlaylistId) return pl.youtubePlaylistId;

  const taoRa = await ghiYouTube<{ id?: string }>(
    "playlists.insert",
    "playlists",
    { part: "snippet,status" },
    {
      snippet: { title: pl.title },
      status: { privacyStatus: "private" },
    },
  );
  if (!taoRa.id) return null;

  await prisma.youTubePlaylist.update({
    where: { id: pl.id },
    data: { youtubePlaylistId: taoRa.id, lastSyncedAt: new Date() },
  });
  await prisma.playlistActionLog.create({
    data: {
      actionType: "create_playlist",
      payload: { youtubePlaylistId: taoRa.id, title: pl.title },
      triggeredBy: "user_direct",
    },
  });
  return taoRa.id;
}

/** Mã video YouTube của một nội dung, hoặc `null` nếu nó không phải video YouTube. */
async function maVideoCua(contentItemId: string): Promise<string | null> {
  const ci = await prisma.contentItem.findUnique({
    where: { id: contentItemId },
    select: { url: true, source: { select: { type: true } } },
  });
  if (!ci || ci.source.type !== "youtube_channel") return null;
  return maVideoTuUrl(ci.url);
}

/** Thêm một video vào playlist thật trên YouTube. */
export async function themLenYouTube(
  playlistId: string,
  contentItemId: string,
): Promise<KetQuaGhi> {
  const ma = await maVideoCua(contentItemId);
  if (!ma) {
    // Podcast, blog… YouTube không nhận được. Trên Am vẫn nằm trong thư mục.
    return { ok: true, thongDiep: "" };
  }

  try {
    const idThat = await baoDamCoThat(playlistId);
    if (!idThat) return { ok: false, thongDiep: "chưa tạo được playlist trên YouTube" };

    await ghiYouTube(
      "playlistItems.insert",
      "playlistItems",
      { part: "snippet" },
      { snippet: { playlistId: idThat, resourceId: { kind: "youtube#video", videoId: ma } } },
    );

    await capNhatAnhChup(playlistId, (cu) => (cu.includes(ma) ? cu : [...cu, ma]));
    await prisma.playlistActionLog.create({
      data: {
        actionType: "add_item",
        payload: { youtubePlaylistId: idThat, videoId: ma },
        triggeredBy: "user_direct",
      },
    });
    return { ok: true, thongDiep: "" };
  } catch (e) {
    return { ok: false, thongDiep: loiGon(e) };
  }
}

/** Bỏ một video khỏi playlist thật trên YouTube. */
export async function xoaKhoiYouTube(
  playlistId: string,
  contentItemId: string,
): Promise<KetQuaGhi> {
  const ma = await maVideoCua(contentItemId);
  if (!ma) return { ok: true, thongDiep: "" };

  const pl = await prisma.youTubePlaylist.findUnique({
    where: { id: playlistId },
    select: { youtubePlaylistId: true },
  });
  // Thư mục chưa từng có thật trên YouTube thì chẳng có gì để xoá
  if (!pl?.youtubePlaylistId) return { ok: true, thongDiep: "" };

  try {
    // `playlistItems.delete` cần id CỦA DÒNG trong playlist, khác id video —
    // nên phải đọc lại danh sách để tìm đúng dòng.
    const dong = await timDongTrongPlaylist(pl.youtubePlaylistId, ma);
    // Đã tự mất trên YouTube rồi thì coi như xong — nhưng vẫn phải gỡ khỏi ảnh
    // chụp, không thì bộ so sánh mãi thấy thừa một mã không có thật
    if (!dong) {
      await capNhatAnhChup(playlistId, (cu) => cu.filter((m) => m !== ma));
      return { ok: true, thongDiep: "" };
    }

    await ghiYouTube("playlistItems.delete", "playlistItems", { id: dong }, undefined, "DELETE");

    await capNhatAnhChup(playlistId, (cu) => cu.filter((m) => m !== ma));
    await prisma.playlistActionLog.create({
      data: {
        actionType: "remove_item",
        payload: { youtubePlaylistId: pl.youtubePlaylistId, videoId: ma },
        triggeredBy: "user_direct",
      },
    });
    return { ok: true, thongDiep: "" };
  } catch (e) {
    return { ok: false, thongDiep: loiGon(e) };
  }
}

/**
 * Tìm id dòng của một video trong playlist thật.
 *
 * Phải lật hết trang vì playlist có tới 202 video (BlackPink), mà một trang
 * chỉ trả 50 — tìm trong trang đầu rồi bỏ cuộc thì mọi video từ thứ 51 trở đi
 * đều "xoá không được" mà không rõ vì sao.
 */
async function timDongTrongPlaylist(
  idPlaylistThat: string,
  maVideo: string,
): Promise<string | null> {
  let trang: string | undefined;
  do {
    const kq = await goiYouTube<{
      items?: { id?: string; snippet?: { resourceId?: { videoId?: string } } }[];
      nextPageToken?: string;
    }>(
      "playlistItems.list",
      "playlistItems",
      { part: "snippet", playlistId: idPlaylistThat, maxResults: 50, pageToken: trang },
      { canDangNhap: true },
    );
    const thay = kq.items?.find((i) => i.snippet?.resourceId?.videoId === maVideo);
    if (thay?.id) return thay.id;
    trang = kq.nextPageToken;
  } while (trang);
  return null;
}

/** Đổi tên playlist thật trên YouTube. */
export async function doiTenTrenYouTube(
  playlistId: string,
  tenMoi: string,
): Promise<KetQuaGhi> {
  const pl = await prisma.youTubePlaylist.findUnique({
    where: { id: playlistId },
    select: { youtubePlaylistId: true },
  });
  if (!pl?.youtubePlaylistId) return { ok: true, thongDiep: "" };

  try {
    await ghiYouTube(
      "playlists.update",
      "playlists",
      { part: "snippet" },
      { id: pl.youtubePlaylistId, snippet: { title: tenMoi } },
      "PUT",
    );
    await prisma.playlistActionLog.create({
      data: {
        actionType: "rename_playlist",
        payload: { youtubePlaylistId: pl.youtubePlaylistId, title: tenMoi },
        triggeredBy: "user_direct",
      },
    });
    return { ok: true, thongDiep: "" };
  } catch (e) {
    return { ok: false, thongDiep: loiGon(e) };
  }
}

/**
 * Xoá hẳn playlist thật trên YouTube.
 *
 * Việc nguy hiểm nhất ở đây, nhưng vẫn làm ngay theo đúng ý chủ dự án: nút
 * "Xoá" trên giao diện đã hỏi lại một lần trước khi gọi tới đây.
 */
export async function xoaPlaylistTrenYouTube(playlistId: string): Promise<KetQuaGhi> {
  const pl = await prisma.youTubePlaylist.findUnique({
    where: { id: playlistId },
    select: { youtubePlaylistId: true, title: true },
  });
  if (!pl?.youtubePlaylistId) return { ok: true, thongDiep: "" };

  try {
    await ghiYouTube(
      "playlists.delete",
      "playlists",
      { id: pl.youtubePlaylistId },
      undefined,
      "DELETE",
    );
    await prisma.playlistActionLog.create({
      data: {
        actionType: "delete_playlist",
        payload: { youtubePlaylistId: pl.youtubePlaylistId, title: pl.title },
        triggeredBy: "user_direct",
      },
    });
    return { ok: true, thongDiep: "" };
  } catch (e) {
    return { ok: false, thongDiep: loiGon(e) };
  }
}

/**
 * Ghi thứ tự hiện tại của Am lên playlist thật.
 *
 * CHỈ ghi dòng thật sự lệch chỗ — mỗi lượt ghi tốn 50 đơn vị hạn mức, viết lại
 * cả playlist 202 video là 10.100 đơn vị, vượt hẳn mức 10.000 một ngày.
 */
export async function ghiThuTuLenYouTube(playlistId: string): Promise<KetQuaGhi> {
  const pl = await prisma.youTubePlaylist.findUnique({
    where: { id: playlistId },
    select: {
      youtubePlaylistId: true,
      items: {
        orderBy: { position: "asc" },
        select: { contentItem: { select: { url: true, source: { select: { type: true } } } } },
      },
    },
  });
  if (!pl?.youtubePlaylistId) return { ok: true, thongDiep: "" };

  const thuTuMuon = pl.items
    .filter((i) => i.contentItem.source.type === "youtube_channel")
    .map((i) => maVideoTuUrl(i.contentItem.url))
    .filter((m): m is string => Boolean(m));
  if (thuTuMuon.length === 0) return { ok: true, thongDiep: "" };

  try {
    const dongThat = await docHetDong(pl.youtubePlaylistId);
    let daGhi = 0;

    for (const [viTri, ma] of thuTuMuon.entries()) {
      const dong = dongThat.find((d) => d.maVideo === ma);
      if (!dong || dong.viTri === viTri) continue;

      await ghiYouTube(
        "playlistItems.update",
        "playlistItems",
        { part: "snippet" },
        {
          id: dong.id,
          snippet: {
            playlistId: pl.youtubePlaylistId,
            resourceId: { kind: "youtube#video", videoId: ma },
            position: viTri,
          },
        },
        "PUT",
      );
      daGhi += 1;
    }

    if (daGhi > 0) {
      // Ảnh chụp phải mang THỨ TỰ mới, không thì `xetLechThuTu` lại đẻ đề xuất
      await capNhatAnhChup(playlistId, () => thuTuMuon);
      await prisma.playlistActionLog.create({
        data: {
          actionType: "move_item",
          payload: { youtubePlaylistId: pl.youtubePlaylistId, soDong: daGhi },
          triggeredBy: "user_direct",
        },
      });
    }
    return { ok: true, thongDiep: "" };
  } catch (e) {
    return { ok: false, thongDiep: loiGon(e) };
  }
}

/** Đọc hết mọi dòng của một playlist thật, kèm vị trí hiện tại. */
async function docHetDong(
  idPlaylistThat: string,
): Promise<{ id: string; maVideo: string; viTri: number }[]> {
  const ra: { id: string; maVideo: string; viTri: number }[] = [];
  let trang: string | undefined;
  do {
    const kq = await goiYouTube<{
      items?: {
        id?: string;
        snippet?: { position?: number; resourceId?: { videoId?: string } };
      }[];
      nextPageToken?: string;
    }>(
      "playlistItems.list",
      "playlistItems",
      { part: "snippet", playlistId: idPlaylistThat, maxResults: 50, pageToken: trang },
      { canDangNhap: true },
    );
    for (const i of kq.items ?? []) {
      const ma = i.snippet?.resourceId?.videoId;
      if (i.id && ma) ra.push({ id: i.id, maVideo: ma, viTri: i.snippet?.position ?? 0 });
    }
    trang = kq.nextPageToken;
  } while (trang);
  return ra;
}
