/**
 * Quét video mới từ các kênh YouTube đã đăng ký.
 *
 * Đây là việc chạy hằng đêm lúc 21:00. Yêu cầu quan trọng nhất là **rẻ**: mỗi
 * đêm quét vài trăm kênh mà vẫn nằm gọn trong 10.000 đơn vị hạn mức Google cho.
 *
 * Cách làm rẻ: mỗi kênh YouTube có sẵn một playlist ngầm chứa toàn bộ video của
 * kênh đó (gọi là playlist "uploads"). Đọc playlist đó tốn 1 đơn vị, trong khi
 * dùng lệnh tìm kiếm để lấy đúng ngần ấy video tốn 100 đơn vị — đắt gấp trăm
 * lần cho cùng một kết quả. Nên id playlist uploads được lấy một lần rồi cất
 * vào `Source.uploadsPlaylistId` dùng mãi.
 *
 * Ở bước này video được lưu với `contentGroup = other` và trạng thái "chờ lấy
 * lời thoại". Việc xếp video vào đúng chuyên mục (AI, triết học, truyện, nhạc)
 * là của bước sau, khi Claude đọc nội dung.
 */

import type { ContentGroup, ContentItemType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db/prisma";

import { goiHetTrang, goiYouTube } from "./goiApi";

/** YouTube cho tra tối đa 50 id một lần gọi. */
const TOI_DA_MOI_LO = 50;

interface ThongTinKenh {
  id?: string;
  snippet?: { title?: string; publishedAt?: string };
  statistics?: { subscriberCount?: string };
  contentDetails?: { relatedPlaylists?: { uploads?: string } };
}

interface MucTrongPlaylist {
  snippet?: {
    publishedAt?: string;
    resourceId?: { videoId?: string };
  };
}

interface ChiTietVideo {
  id?: string;
  snippet?: {
    title?: string;
    description?: string;
    publishedAt?: string;
    channelId?: string;
    defaultAudioLanguage?: string;
    defaultLanguage?: string;
    thumbnails?: Record<string, { url?: string }>;
    /** "none" | "live" | "upcoming" */
    liveBroadcastContent?: string;
  };
  contentDetails?: { duration?: string };
  statistics?: {
    viewCount?: string;
    likeCount?: string;
    commentCount?: string;
  };
}

/**
 * Đổi thời lượng kiểu ISO 8601 của YouTube ("PT1H2M3S") sang số giây.
 *
 * Trả về `null` khi không đọc được, thay vì đoán bừa bằng 0 — thời lượng 0 giây
 * sẽ khiến mọi bộ lọc theo độ dài hiểu sai.
 */
export function docThoiLuong(chuoi: string | undefined): number | null {
  if (!chuoi) return null;
  const khop = /^P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(chuoi);
  if (!khop) return null;

  const [, ngay, gio, phut, giay] = khop;
  const tong =
    Number(ngay ?? 0) * 86400 +
    Number(gio ?? 0) * 3600 +
    Number(phut ?? 0) * 60 +
    Number(giay ?? 0);

  return tong > 0 ? tong : null;
}

/** Đổi chuỗi số của YouTube sang số. Kênh ẩn lượt thích thì trả `null`. */
function docSo(chuoi: string | undefined): number | null {
  if (chuoi === undefined) return null;
  const so = Number(chuoi);
  return Number.isFinite(so) ? so : null;
}

/** Lấy ảnh đại diện to nhất có sẵn. */
function layAnh(
  thumbnails: Record<string, { url?: string }> | undefined,
): string | null {
  if (!thumbnails) return null;
  for (const co of ["maxres", "standard", "high", "medium", "default"]) {
    const url = thumbnails[co]?.url;
    if (url) return url;
  }
  return null;
}

/** Cắt mảng thành từng lô nhỏ. */
function chiaLo<T>(mang: T[], coLo: number): T[][] {
  const cacLo: T[][] = [];
  for (let i = 0; i < mang.length; i += coLo) {
    cacLo.push(mang.slice(i, i + coLo));
  }
  return cacLo;
}

export interface KetQuaDongBoNguon {
  themMoi: number;
  capNhat: number;
  khongLayDuoc: number;
}

/**
 * Dựng bảng `Source` từ danh sách kênh đã đăng ký, kèm id playlist uploads.
 *
 * Chỉ hỏi Google về những kênh chưa có id playlist uploads, nên chạy lại lần
 * hai gần như không tốn hạn mức.
 */
export async function dongBoNguonTuKenhDaDangKy(): Promise<KetQuaDongBoNguon> {
  const tinHieu = await prisma.youTubeAccountSignal.findMany({
    where: { signalType: "subscription" },
    select: { externalId: true, title: true },
  });

  // Kênh nào đã có sẵn id playlist uploads thì khỏi hỏi lại Google
  const daCo = await prisma.source.findMany({
    where: {
      type: "youtube_channel",
      uploadsPlaylistId: { not: null },
    },
    select: { externalId: true },
  });
  const tapDaCo = new Set(daCo.map((n) => n.externalId));

  const canHoi = tinHieu.filter((t) => !tapDaCo.has(t.externalId));

  let themMoi = 0;
  let capNhat = 0;
  let khongLayDuoc = 0;

  for (const lo of chiaLo(canHoi, TOI_DA_MOI_LO)) {
    const ketQua = await goiYouTube<{ items?: ThongTinKenh[] }>(
      "channels.list",
      "channels",
      {
        part: "snippet,statistics,contentDetails",
        id: lo.map((k) => k.externalId).join(","),
      },
    );

    const traVe = new Map(
      (ketQua.items ?? []).map((kenh) => [kenh.id ?? "", kenh]),
    );

    for (const kenh of lo) {
      const chiTiet = traVe.get(kenh.externalId);
      // Kênh đã bị xoá hoặc khoá thì Google không trả về gì cả
      if (!chiTiet) {
        khongLayDuoc += 1;
        continue;
      }

      const duLieu = {
        title: chiTiet.snippet?.title ?? kenh.title,
        url: `https://www.youtube.com/channel/${kenh.externalId}`,
        followerCount: docSo(chiTiet.statistics?.subscriberCount),
        subscriptionStatus: "subscribed" as const,
        uploadsPlaylistId:
          chiTiet.contentDetails?.relatedPlaylists?.uploads ?? null,
      };

      const truoc = await prisma.source.findUnique({
        where: {
          type_externalId: {
            type: "youtube_channel",
            externalId: kenh.externalId,
          },
        },
        select: { id: true },
      });

      await prisma.source.upsert({
        where: {
          type_externalId: {
            type: "youtube_channel",
            externalId: kenh.externalId,
          },
        },
        create: {
          type: "youtube_channel",
          externalId: kenh.externalId,
          ...duLieu,
        },
        update: duLieu,
      });

      if (truoc) capNhat += 1;
      else themMoi += 1;
    }
  }

  return { themMoi, capNhat, khongLayDuoc };
}

export interface TuyChonQuet {
  /** Chỉ lấy video đăng trong ngần này ngày gần đây. Mặc định 7. */
  soNgayGanDay?: number;
  /** Số video xét mỗi kênh, tính từ mới nhất. Mặc định 10. */
  videoMoiKenh?: number;
  /** Chỉ quét ngần này kênh — để chạy thử mà không tốn nhiều hạn mức. */
  gioiHanKenh?: number;
}

export interface KetQuaQuet {
  soKenhQuet: number;
  soVideoXet: number;
  soVideoThemMoi: number;
  kenhLoi: { ten: string; lyDo: string }[];
}

/**
 * Quét video mới từ các kênh đã có trong `Source`.
 *
 * Một kênh hỏng không được làm chết cả lần quét — kênh bị khoá, playlist riêng
 * tư là chuyện thường gặp khi theo dõi vài trăm kênh. Gom lỗi lại báo sau.
 */
export async function quetVideoMoi(
  tuyChon: TuyChonQuet = {},
): Promise<KetQuaQuet> {
  const soNgay = tuyChon.soNgayGanDay ?? 7;
  const videoMoiKenh = tuyChon.videoMoiKenh ?? 10;

  const moc = new Date(Date.now() - soNgay * 86_400_000);

  const cacNguon = await prisma.source.findMany({
    where: {
      type: "youtube_channel",
      uploadsPlaylistId: { not: null },
    },
    select: { id: true, externalId: true, title: true, uploadsPlaylistId: true },
    orderBy: { lastCrawledAt: { sort: "asc", nulls: "first" } },
    ...(tuyChon.gioiHanKenh ? { take: tuyChon.gioiHanKenh } : {}),
  });

  const kenhLoi: { ten: string; lyDo: string }[] = [];
  /** id video → id nguồn, để biết video thuộc kênh nào khi lưu */
  const videoCanLay = new Map<string, string>();
  let soVideoXet = 0;

  for (const nguon of cacNguon) {
    try {
      const cacMuc = await goiHetTrang<MucTrongPlaylist>(
        "playlistItems.list",
        "playlistItems",
        { part: "snippet", playlistId: nguon.uploadsPlaylistId ?? "" },
        videoMoiKenh,
      );

      for (const muc of cacMuc) {
        soVideoXet += 1;
        const idVideo = muc.snippet?.resourceId?.videoId;
        const dangLuc = muc.snippet?.publishedAt
          ? new Date(muc.snippet.publishedAt)
          : null;

        if (!idVideo) continue;
        if (dangLuc && dangLuc < moc) continue;

        videoCanLay.set(idVideo, nguon.id);
      }

      await prisma.source.update({
        where: { id: nguon.id },
        data: { lastCrawledAt: new Date() },
      });
    } catch (e) {
      kenhLoi.push({
        ten: nguon.title,
        lyDo: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const soVideoThemMoi = await layChiTietVaLuu(videoCanLay);

  return {
    soKenhQuet: cacNguon.length,
    soVideoXet,
    soVideoThemMoi,
    kenhLoi,
  };
}

/**
 * Lấy chi tiết video theo lô 50 rồi lưu vào `ContentItem`.
 *
 * Gộp 50 video vào một lệnh thay vì gọi 50 lần là chỗ tiết kiệm lớn nhất:
 * 1 đơn vị hạn mức thay vì 50.
 */
async function layChiTietVaLuu(
  videoCanLay: Map<string, string>,
): Promise<number> {
  if (videoCanLay.size === 0) return 0;

  // Bỏ qua video đã có trong kho, khỏi tốn hạn mức lấy lại
  const daCo = await prisma.contentItem.findMany({
    where: { externalId: { in: [...videoCanLay.keys()] } },
    select: { externalId: true },
  });
  for (const muc of daCo) videoCanLay.delete(muc.externalId);

  if (videoCanLay.size === 0) return 0;

  let themMoi = 0;

  for (const lo of chiaLo([...videoCanLay.keys()], TOI_DA_MOI_LO)) {
    const ketQua = await goiYouTube<{ items?: ChiTietVideo[] }>(
      "videos.list",
      "videos",
      {
        part: "snippet,contentDetails,statistics",
        id: lo.join(","),
      },
    );

    const dong = (ketQua.items ?? [])
      .map((video) => {
        const idNguon = video.id ? videoCanLay.get(video.id) : undefined;
        if (!video.id || !idNguon) return null;

        // Bỏ qua buổi phát trực tiếp chưa diễn ra hoặc đang diễn ra dở. Chúng
        // chưa có nội dung để lấy lời thoại, chưa có lượt xem để chấm điểm, và
        // thời lượng Google trả về là "P0D". Lần quét sau, khi buổi phát đã
        // xong, video sẽ được lấy về bình thường.
        const kieuPhat = video.snippet?.liveBroadcastContent;
        if (kieuPhat === "upcoming" || kieuPhat === "live") return null;

        return {
          sourceId: idNguon,
          externalId: video.id,
          url: `https://www.youtube.com/watch?v=${video.id}`,
          type: "video" as ContentItemType,
          title: video.snippet?.title ?? "(không rõ tên)",
          description: video.snippet?.description ?? null,
          thumbnailUrl: layAnh(video.snippet?.thumbnails),
          publishedAt: video.snippet?.publishedAt
            ? new Date(video.snippet.publishedAt)
            : null,
          durationSeconds: docThoiLuong(video.contentDetails?.duration),
          viewOrPlayCount: docSo(video.statistics?.viewCount),
          likeCount: docSo(video.statistics?.likeCount),
          commentCount: docSo(video.statistics?.commentCount),
          originalLanguage:
            video.snippet?.defaultAudioLanguage ??
            video.snippet?.defaultLanguage ??
            null,
          // Chưa biết video thuộc chuyên mục nào — để Claude xếp ở bước sau
          contentGroup: "other" as ContentGroup,
          ingestSource: "subscribed" as const,
        };
      })
      .filter((d) => d !== null);

    if (dong.length > 0) {
      const luu = await prisma.contentItem.createMany({
        data: dong,
        skipDuplicates: true,
      });
      themMoi += luu.count;
    }
  }

  return themMoi;
}
