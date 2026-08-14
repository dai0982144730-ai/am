/**
 * Đọc danh sách playlist thật trên tài khoản YouTube về kho.
 *
 * CHỈ ĐỌC. Không tạo, không sửa, không xoá gì cả — phần đó nằm ở `apDung.ts`
 * và chỉ chạy sau khi người dùng bấm duyệt từng việc một.
 *
 * VÌ SAO CẦN ĐỌC VỀ: để đề xuất được "video này nên bỏ vào playlist X", trợ lý
 * phải biết chủ nhà đang có những playlist nào và chúng tên gì. Không có bước
 * này thì mọi đề xuất đều là "tạo playlist mới", vừa vô duyên vừa làm rối tài
 * khoản.
 */

import { prisma } from "@/lib/db/prisma";
import { goiHetTrang } from "@/lib/youtube/goiApi";

/** Lấy tối đa ngần này playlist. Ai cũng khó mà có hơn. */
const TOI_DA_PLAYLIST = 200;

interface PlaylistTuYouTube {
  id?: string;
  snippet?: { title?: string; description?: string };
  contentDetails?: { itemCount?: number };
}

export interface KetQuaDongBo {
  soDoc: number;
  themMoi: number;
  capNhat: number;
}

/**
 * Đồng bộ playlist.
 *
 * Playlist đã có thì chỉ cập nhật tên, mô tả và số lượng — **không đụng vào
 * `managedByAI`**. Cờ đó là lựa chọn của chủ nhà về việc cho trợ lý động vào
 * playlist nào; một lần đồng bộ không được phép xoá lựa chọn đó.
 */
export async function dongBoPlaylist(): Promise<KetQuaDongBo> {
  const tuYouTube = await goiHetTrang<PlaylistTuYouTube>(
    "playlists.list",
    "playlists",
    { part: "snippet,contentDetails", mine: "true" },
    TOI_DA_PLAYLIST,
    { canDangNhap: true },
  );

  let themMoi = 0;
  let capNhat = 0;

  for (const pl of tuYouTube) {
    if (!pl.id) continue;

    const duLieu = {
      title: pl.snippet?.title ?? "(playlist không tên)",
      description: pl.snippet?.description || null,
      itemCount: pl.contentDetails?.itemCount ?? 0,
      lastSyncedAt: new Date(),
    };

    const daCo = await prisma.youTubePlaylist.findUnique({
      where: { youtubePlaylistId: pl.id },
      select: { id: true },
    });

    await prisma.youTubePlaylist.upsert({
      where: { youtubePlaylistId: pl.id },
      create: { youtubePlaylistId: pl.id, ...duLieu },
      update: duLieu,
    });

    if (daCo) capNhat += 1;
    else themMoi += 1;
  }

  return { soDoc: tuYouTube.length, themMoi, capNhat };
}
