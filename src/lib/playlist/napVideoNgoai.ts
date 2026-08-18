/**
 * Nạp về những video nằm trong playlist thật mà Am chưa hề biết.
 *
 * ## Vì sao cần
 *
 * Playlist của chủ nhà gom video từ khắp nơi — nhạc, xây nhà, mua bán, chụp
 * ảnh — phần lớn đến từ kênh Am không theo dõi. Đo ngày 2026-08-18: **586 video
 * trong 26 playlist, Am biết đúng 0 cái**, nên mọi trang chi tiết playlist đều
 * trống trơn.
 *
 * Chủ dự án chốt cùng ngày: *"tôi chỉ cần xem/chuyển/xoá trong playlist như
 * YouTube vì không muốn vào youtube để xắp xếp dữ liệu này"*. Tức là chỉ cần
 * đủ để NHÌN THẤY và SẮP XẾP, không cần Claude đọc xem nội dung là gì.
 *
 * ## Hai chốt chặn để nó không lọt vào kho tuyển chọn
 *
 * 1. **`ContentItem.chiTrongPlaylist = true`** — chặn khỏi Trang chủ, Khám phá,
 *    tìm kiếm, lượt phân loại của Claude và bước lấy lời thoại. Xem giải thích
 *    dài ở schema.
 * 2. **`Source.uploadsPlaylistId = null`** — máy quét đêm chỉ lấy kênh CÓ
 *    trường này (`quetKenh.ts`), nên kênh tạo ở đây không bao giờ bị quét. Nếu
 *    thiếu chốt này thì nhập 1 video của BlackPink là đêm sau Am tự kéo về cả
 *    kênh.
 *
 * ## Giá
 *
 * `videos.list` 1 đơn vị cho mỗi lô 50 video → 586 video hết 12 đơn vị trên
 * 10.000/ngày. Rẻ tới mức không cần dè.
 */

import type { ContentGroup } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db/prisma";
import { goiYouTube } from "@/lib/youtube/goiApi";
import { docThoiLuong } from "@/lib/youtube/quetKenh";

/** `videos.list` nhận tối đa 50 id mỗi lần gọi. */
const TOI_DA_MOI_LO = 50;

interface VideoTuYouTube {
  id?: string;
  snippet?: {
    title?: string;
    description?: string;
    channelId?: string;
    channelTitle?: string;
    publishedAt?: string;
    defaultAudioLanguage?: string;
    defaultLanguage?: string;
    thumbnails?: Record<string, { url?: string }>;
  };
  contentDetails?: { duration?: string };
  statistics?: { viewCount?: string; likeCount?: string; commentCount?: string };
}

export interface KetQuaNap {
  /** Số video Am chưa biết trước khi chạy */
  canNap: number;
  /** Số video tạo được hồ sơ */
  daTao: number;
  /** Số kênh mới phải dựng hồ sơ (không bao giờ bị quét) */
  kenhMoi: number;
  /** Video YouTube không trả về — đã bị xoá hoặc để riêng tư */
  matTich: number;
  donViHanMuc: number;
}

function docSo(chuoi: string | undefined): number | null {
  if (chuoi === undefined) return null;
  const so = Number(chuoi);
  return Number.isFinite(so) ? so : null;
}

function layAnh(thumbnails: Record<string, { url?: string }> | undefined): string | null {
  if (!thumbnails) return null;
  for (const co of ["maxres", "standard", "high", "medium", "default"]) {
    const url = thumbnails[co]?.url;
    if (url) return url;
  }
  return null;
}

function chiaLo<T>(mang: T[], coLo: number): T[][] {
  const cacLo: T[][] = [];
  for (let i = 0; i < mang.length; i += coLo) cacLo.push(mang.slice(i, i + coLo));
  return cacLo;
}

/**
 * Nạp chi tiết cho những mã video còn thiếu trong kho.
 *
 * Trả về map `mã video YouTube → id ContentItem` cho MỌI mã truyền vào mà giờ
 * đã có hồ sơ (kể cả cái vốn đã có sẵn từ trước), để bên gọi đắp `PlaylistItem`
 * ngay được.
 */
export async function napVideoConThieu(
  idVideo: string[],
): Promise<{ ketQua: KetQuaNap; theoMaVideo: Map<string, string> }> {
  const ketQua: KetQuaNap = {
    canNap: 0,
    daTao: 0,
    kenhMoi: 0,
    matTich: 0,
    donViHanMuc: 0,
  };
  const theoMaVideo = new Map<string, string>();
  if (idVideo.length === 0) return { ketQua, theoMaVideo };

  const khongTrung = [...new Set(idVideo)];

  const daBiet = await prisma.contentItem.findMany({
    where: { externalId: { in: khongTrung }, source: { type: "youtube_channel" } },
    select: { id: true, externalId: true },
  });
  for (const c of daBiet) theoMaVideo.set(c.externalId, c.id);

  const conThieu = khongTrung.filter((ma) => !theoMaVideo.has(ma));
  ketQua.canNap = conThieu.length;
  if (conThieu.length === 0) return { ketQua, theoMaVideo };

  for (const lo of chiaLo(conThieu, TOI_DA_MOI_LO)) {
    const traVe = await goiYouTube<{ items?: VideoTuYouTube[] }>(
      "videos.list",
      "videos",
      { part: "snippet,contentDetails,statistics", id: lo.join(",") },
      { canDangNhap: true },
    );
    ketQua.donViHanMuc += 1;

    const cacVideo = traVe.items ?? [];
    ketQua.matTich += lo.length - cacVideo.length;

    for (const v of cacVideo) {
      if (!v.id || !v.snippet?.channelId) continue;

      // Kênh: dùng lại nếu đã có, còn không thì dựng hồ sơ tối giản KHÔNG kèm
      // `uploadsPlaylistId` — đó chính là thứ giữ nó ngoài tầm máy quét đêm.
      const kenhDaCo = await prisma.source.findUnique({
        where: {
          type_externalId: { type: "youtube_channel", externalId: v.snippet.channelId },
        },
        select: { id: true },
      });

      let idNguon: string;
      if (kenhDaCo) {
        idNguon = kenhDaCo.id;
      } else {
        const tao = await prisma.source.create({
          data: {
            type: "youtube_channel",
            externalId: v.snippet.channelId,
            title: v.snippet.channelTitle ?? "(kênh không tên)",
            url: `https://www.youtube.com/channel/${v.snippet.channelId}`,
            subscriptionStatus: "unknown",
          },
          select: { id: true },
        });
        idNguon = tao.id;
        ketQua.kenhMoi += 1;
      }

      const hoSo = await prisma.contentItem.upsert({
        where: { sourceId_externalId: { sourceId: idNguon, externalId: v.id } },
        // Đã có sẵn thì KHÔNG đụng gì — nhất là không bật cờ `chiTrongPlaylist`
        // lên cho một video vốn thuộc kho tuyển chọn đầy đủ.
        update: {},
        create: {
          sourceId: idNguon,
          externalId: v.id,
          url: `https://www.youtube.com/watch?v=${v.id}`,
          type: "video",
          title: v.snippet.title ?? "(không rõ tên)",
          description: v.snippet.description ?? null,
          thumbnailUrl: layAnh(v.snippet.thumbnails),
          publishedAt: v.snippet.publishedAt ? new Date(v.snippet.publishedAt) : null,
          durationSeconds: docThoiLuong(v.contentDetails?.duration),
          viewOrPlayCount: docSo(v.statistics?.viewCount),
          likeCount: docSo(v.statistics?.likeCount),
          commentCount: docSo(v.statistics?.commentCount),
          originalLanguage:
            v.snippet.defaultAudioLanguage ?? v.snippet.defaultLanguage ?? null,
          contentGroup: "other" as ContentGroup,
          ingestSource: "manual",
          // Không xếp hàng chờ lấy lời thoại hay chờ Claude đọc — nó chỉ có mặt
          // để nhìn thấy trong playlist.
          status: "pending_classification",
          chiTrongPlaylist: true,
        },
        select: { id: true },
      });

      theoMaVideo.set(v.id, hoSo.id);
      ketQua.daTao += 1;
    }
  }

  return { ketQua, theoMaVideo };
}
