/**
 * Đọc danh sách playlist thật trên tài khoản YouTube về kho, cùng với đúng
 * danh sách video bên trong từng playlist.
 *
 * CHỈ ĐỌC. Không tạo, không sửa, không xoá gì cả — phần đó nằm ở `apDung.ts`
 * và chỉ chạy sau khi người dùng bấm duyệt từng việc một.
 *
 * VÌ SAO CẦN ĐỌC VỀ: để đề xuất được "video này nên bỏ vào playlist X", trợ lý
 * phải biết chủ nhà đang có những playlist nào và chúng tên gì. Không có bước
 * này thì mọi đề xuất đều là "tạo playlist mới", vừa vô duyên vừa làm rối tài
 * khoản.
 *
 * ĐỌC CẢ THÀNH VIÊN (từ 2026-08-17): trước đây chỉ đọc tên và số lượng, không
 * biết đích xác video nào đang ở playlist nào. Không có việc này thì không so
 * sánh được với ý Am muốn (`PlaylistItem`) để biết chỗ nào lệch — xem
 * `thanhVien.ts`.
 */

import { prisma } from "@/lib/db/prisma";
import { napVideoConThieu } from "@/lib/playlist/napVideoNgoai";
import { soSanhVaSinhDeXuat } from "@/lib/playlist/thanhVien";
import { goiHetTrang } from "@/lib/youtube/goiApi";

/** Lấy tối đa ngần này playlist. Ai cũng khó mà có hơn. */
const TOI_DA_PLAYLIST = 200;

/** Mỗi playlist đọc tối đa ngần này video — đủ cho hầu hết mọi playlist cá nhân. */
const TOI_DA_VIDEO_MOI_PLAYLIST = 500;

interface PlaylistTuYouTube {
  id?: string;
  snippet?: { title?: string; description?: string };
  contentDetails?: { itemCount?: number };
}

interface PlaylistItemTuYouTube {
  snippet?: { resourceId?: { videoId?: string } };
}

export interface KetQuaDongBo {
  soDoc: number;
  themMoi: number;
  capNhat: number;
  /** Playlist từng có thật trên YouTube nhưng giờ đã bị xoá bên đó */
  matBenYoutube: number;
}

/**
 * Đắp `PlaylistItem` (bảng "ý Am muốn") khớp với thành viên THẬT vừa đọc về.
 *
 * VÌ SAO CẦN: `PlaylistItem` sinh ra trống trơn cho mọi playlist đã có sẵn
 * video từ trước khi Am biết tới nó — chỉ video thêm QUA AM mới tự có dòng ở
 * đây. Không đắp lại thì bảng "ý muốn" mãi mãi trống với mọi playlist cũ, kéo
 * theo ba thứ hỏng: trang Playlist báo "0 mục", trang chi tiết playlist không
 * có gì để hiện, và nút "Bỏ khỏi playlist" bấm vào chẳng xoá được dòng nào vì
 * dòng đó chưa từng tồn tại.
 *
 * TỪ 2026-08-18 CÒN NẠP CẢ VIDEO AM CHƯA BIẾT. Bản trước chỉ đắp cho video đã
 * có sẵn trong kho, mà đo ra thì **586 video trong 26 playlist không có lấy
 * một cái nào trong kho** — nên mọi trang playlist đều trống, đúng thứ bản
 * trước tưởng là đã sửa xong. Xem `napVideoNgoai.ts` để biết vì sao nạp về mà
 * vẫn không lọt vào kho tuyển chọn.
 *
 * Đắp ĐÚNG THỨ TỰ THẬT trên YouTube, không phải nối đuôi vào cuối — thứ tự là
 * thông tin có ý nghĩa với playlist, và đây là ảnh chụp trung thực từ YouTube.
 */
async function dapLaiThanhVien(
  playlistId: string,
  idVideo: string[],
): Promise<void> {
  if (idVideo.length === 0) return;

  const { theoMaVideo } = await napVideoConThieu(idVideo);
  if (theoMaVideo.size === 0) return;

  const dangCo = await prisma.playlistItem.findMany({
    where: { playlistId },
    select: { contentItemId: true, position: true },
  });
  const idDaCo = new Set(dangCo.map((i) => i.contentItemId));
  let viTriKe = dangCo.reduce((max, i) => Math.max(max, i.position), -1) + 1;

  // Duyệt theo thứ tự YouTube trả về, không theo thứ tự database trả về
  for (const ma of idVideo) {
    const idNoiDung = theoMaVideo.get(ma);
    if (!idNoiDung || idDaCo.has(idNoiDung)) continue;
    idDaCo.add(idNoiDung);
    await prisma.playlistItem.create({
      data: { playlistId, contentItemId: idNoiDung, position: viTriKe, addedBy: "user" },
    });
    viTriKe += 1;
  }
}

/**
 * Đồng bộ playlist — tên, mô tả, số lượng, VÀ danh sách video thật bên trong.
 *
 * Playlist đã có thì chỉ cập nhật tên, mô tả và số lượng — **không đụng vào
 * `managedByAI`**. Cờ đó là lựa chọn của chủ nhà về việc cho trợ lý động vào
 * playlist nào; một lần đồng bộ không được phép xoá lựa chọn đó.
 *
 * Playlist đang chờ xoá (`deletionRequestedAt` đã đặt) thì bỏ qua — không đọc
 * lại thành viên của thứ sắp biến mất làm gì.
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
  /** id playlist thật vừa thấy trên YouTube lần này — dùng để nhận ra playlist nào đã biến mất */
  const idConThat = new Set<string>();

  for (const pl of tuYouTube) {
    if (!pl.id) continue;
    idConThat.add(pl.id);

    const duLieu = {
      title: pl.snippet?.title ?? "(playlist không tên)",
      description: pl.snippet?.description || null,
      itemCount: pl.contentDetails?.itemCount ?? 0,
      lastSyncedAt: new Date(),
    };

    const daCo = await prisma.youTubePlaylist.findUnique({
      where: { youtubePlaylistId: pl.id },
      select: { id: true, deletionRequestedAt: true },
    });

    const luu = await prisma.youTubePlaylist.upsert({
      where: { youtubePlaylistId: pl.id },
      create: { youtubePlaylistId: pl.id, ...duLieu },
      update: duLieu,
      select: { id: true },
    });

    if (daCo) capNhat += 1;
    else themMoi += 1;

    if (daCo?.deletionRequestedAt) continue;

    const cacVideo = await goiHetTrang<PlaylistItemTuYouTube>(
      "playlistItems.list",
      "playlistItems",
      { part: "snippet", playlistId: pl.id },
      TOI_DA_VIDEO_MOI_PLAYLIST,
      { canDangNhap: true },
    );
    const idVideo = cacVideo
      .map((v) => v.snippet?.resourceId?.videoId)
      .filter((id): id is string => Boolean(id));

    await prisma.youTubePlaylist.update({
      where: { id: luu.id },
      data: { lastSyncedVideoIds: idVideo },
    });

    await dapLaiThanhVien(luu.id, idVideo);
    await soSanhVaSinhDeXuat(luu.id);
  }

  // Playlist nào ĐÃ TỪNG có thật (có youtubePlaylistId) mà lần đọc này không
  // còn thấy trên YouTube nữa — nghĩa là chủ nhà đã xoá nó bên đó. Việc đã
  // xảy ra thật rồi ngoài đời, ghi lại đúng sự thật lên Am không phải một
  // hành vi ghi ra thế giới thật cần chờ duyệt — khác hẳn việc Am chủ động
  // xoá một playlist thật (`apDungXoaPlaylist`), vẫn phải qua đề xuất → duyệt.
  //
  // Đã vấp thật (2026-08-17): playlist tiếng Anh xoá bên YouTube hôm trước
  // vẫn nằm lì trên Am, vì bản cũ chỉ biết UPSERT những gì đọc VỀ, không biết
  // tự hỏi "còn cái nào cũ mà giờ không thấy nữa không".
  const matBen = await prisma.youTubePlaylist.findMany({
    where: {
      youtubePlaylistId: { not: null },
      deletionRequestedAt: null,
    },
    select: { id: true, youtubePlaylistId: true },
  });
  const bienMat = matBen.filter(
    (p) => p.youtubePlaylistId && !idConThat.has(p.youtubePlaylistId),
  );
  if (bienMat.length > 0) {
    await prisma.youTubePlaylist.deleteMany({
      where: { id: { in: bienMat.map((p) => p.id) } },
    });
  }

  return {
    soDoc: tuYouTube.length,
    themMoi,
    capNhat,
    matBenYoutube: bienMat.length,
  };
}
