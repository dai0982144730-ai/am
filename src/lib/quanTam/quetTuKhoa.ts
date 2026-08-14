/**
 * Chuyên mục "New" — quét YouTube theo từ khoá người dùng tự gõ.
 *
 * KHÁC MỌI CHUYÊN MỤC KHÁC Ở CHỖ NÀO: bốn chuyên mục chính lấy nội dung từ các
 * kênh đã đăng ký, tức là chỉ thấy được thứ mình đã biết mà theo dõi. Phần này
 * đi tìm ngoài vùng đó — hôm nay tự dưng quan tâm "thuế quan Mỹ Trung", gõ vào,
 * tối máy tự tìm giúp, sáng mai có trong bản tin.
 *
 * VÌ SAO PHẢI ĐẾM TIỀN CẨN THẬN: lệnh tìm kiếm của YouTube **đắt gấp 100 lần**
 * mọi lệnh khác — 100 đơn vị hạn mức một lần gọi, trong khi lấy chi tiết 50
 * video chỉ tốn 1. Cả ngày chỉ có 10.000 đơn vị. Nghĩa là mỗi từ khoá đang bật
 * ăn 1% hạn mức ngày, và bật quá tay thì hết sạch phần dành cho việc quét kênh
 * — việc chính. Đó là lý do giao diện phải nói thẳng con số ra, và phần này tự
 * dừng khi vượt ngưỡng.
 */

import type { ContentGroup, ContentItemType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db/prisma";
import { coTheLaNhac } from "@/lib/music/nhanDienNhac";
import { goiYouTube } from "@/lib/youtube/goiApi";
import { docThoiLuong } from "@/lib/youtube/quetKenh";

import { GIA_MOT_TU_KHOA } from "./giaTuKhoa";

/** Số kết quả lấy về mỗi từ khoá mỗi đêm. */
const KET_QUA_MOI_TU_KHOA = 10;

interface KetQuaTim {
  id?: { videoId?: string };
  snippet?: {
    channelId?: string;
    channelTitle?: string;
  };
}

interface ChiTietVideo {
  id?: string;
  snippet?: {
    title?: string;
    description?: string;
    channelId?: string;
    channelTitle?: string;
    publishedAt?: string;
    liveBroadcastContent?: string;
    defaultAudioLanguage?: string;
    defaultLanguage?: string;
    thumbnails?: Record<string, { url?: string } | undefined>;
  };
  contentDetails?: { duration?: string };
  statistics?: {
    viewCount?: string;
    likeCount?: string;
    commentCount?: string;
  };
}

function docSo(chuoi: string | undefined): number | null {
  if (chuoi === undefined) return null;
  const so = Number(chuoi);
  return Number.isFinite(so) ? so : null;
}

function layAnh(
  anh: Record<string, { url?: string } | undefined> | undefined,
): string | null {
  return (
    anh?.maxres?.url ?? anh?.high?.url ?? anh?.medium?.url ?? anh?.default?.url ?? null
  );
}

/**
 * Tìm-hoặc-tạo nguồn cho kênh của một video tìm được.
 *
 * Đánh dấu `not_subscribed` — đây là kênh lạ, gặp qua tìm kiếm, không phải kênh
 * chủ nhà theo dõi. Phân biệt được hai loại là cần thiết: uy tín nguồn có trọng
 * số trong công thức chấm điểm, và một kênh tình cờ tìm ra không đáng được tin
 * ngang một kênh đã theo dõi nhiều năm.
 */
async function baoDamCoNguon(
  idKenh: string,
  tenKenh: string,
): Promise<string> {
  const nguon = await prisma.source.upsert({
    where: { type_externalId: { type: "youtube_channel", externalId: idKenh } },
    create: {
      type: "youtube_channel",
      externalId: idKenh,
      title: tenKenh,
      url: `https://www.youtube.com/channel/${idKenh}`,
      subscriptionStatus: "not_subscribed",
    },
    // Gặp lại kênh đã có thì không đụng gì — đặc biệt không được hạ
    // `subscriptionStatus` của một kênh đang theo dõi xuống "không theo dõi"
    update: {},
    select: { id: true },
  });

  return nguon.id;
}

export interface KetQuaQuetMotTuKhoa {
  tuKhoa: string;
  soTimThay: number;
  soThemMoi: number;
  loi?: string;
}

export interface KetQuaQuetTuKhoa {
  cacTuKhoa: KetQuaQuetMotTuKhoa[];
  tongThemMoi: number;
  /** Hạn mức đã tiêu cho lần quét này */
  hanMucDaTieu: number;
}

/**
 * Quét một từ khoá.
 *
 * Hai lệnh gọi: một lệnh tìm (100 đơn vị) rồi một lệnh lấy chi tiết cả lô (1
 * đơn vị). Lệnh tìm không trả về thời lượng, lượt xem hay lượt thích — thiếu
 * đúng những thứ cần để chấm điểm, nên phải gọi thêm lệnh thứ hai.
 */
async function quetMotTuKhoa(
  idQuanTam: string,
  tuKhoa: string,
  soNgayGanDay: number,
): Promise<KetQuaQuetMotTuKhoa> {
  const tuLuc = new Date(Date.now() - soNgayGanDay * 86_400_000);

  const ketQuaTim = await goiYouTube<{ items?: KetQuaTim[] }>(
    "search.list",
    "search",
    {
      part: "snippet",
      q: tuKhoa,
      type: "video",
      order: "relevance",
      publishedAfter: tuLuc.toISOString(),
      maxResults: KET_QUA_MOI_TU_KHOA,
    },
  );

  const timThay = ketQuaTim.items ?? [];
  const maVideo = timThay
    .map((kq) => kq.id?.videoId)
    .filter((ma): ma is string => Boolean(ma));

  if (maVideo.length === 0) {
    return { tuKhoa, soTimThay: 0, soThemMoi: 0 };
  }

  // Bỏ video đã có trong kho — khỏi tốn công lấy chi tiết lại
  const daCo = await prisma.contentItem.findMany({
    where: { externalId: { in: maVideo } },
    select: { externalId: true },
  });
  const daCoSet = new Set(daCo.map((m) => m.externalId));
  const canLay = maVideo.filter((ma) => !daCoSet.has(ma));

  if (canLay.length === 0) {
    return { tuKhoa, soTimThay: timThay.length, soThemMoi: 0 };
  }

  const chiTiet = await goiYouTube<{ items?: ChiTietVideo[] }>(
    "videos.list",
    "videos",
    { part: "snippet,contentDetails,statistics", id: canLay.join(",") },
  );

  let themMoi = 0;

  for (const video of chiTiet.items ?? []) {
    const idKenh = video.snippet?.channelId;
    if (!video.id || !idKenh) continue;

    // Buổi phát trực tiếp chưa xong thì chưa có gì để đọc, để chấm
    const kieuPhat = video.snippet?.liveBroadcastContent;
    if (kieuPhat === "upcoming" || kieuPhat === "live") continue;

    const idNguon = await baoDamCoNguon(
      idKenh,
      video.snippet?.channelTitle ?? "(kênh không rõ tên)",
    );

    const thoiLuong = docThoiLuong(video.contentDetails?.duration);

    const luu = await prisma.contentItem.createMany({
      data: [
        {
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
          durationSeconds: thoiLuong,
          viewOrPlayCount: docSo(video.statistics?.viewCount),
          likeCount: docSo(video.statistics?.likeCount),
          commentCount: docSo(video.statistics?.commentCount),
          originalLanguage:
            video.snippet?.defaultAudioLanguage ??
            video.snippet?.defaultLanguage ??
            null,
          // Xếp thẳng vào "New" và giữ nguyên. Khác với video quét từ kênh
          // (để Claude tự xếp chuyên mục), thứ tìm được theo từ khoá thì
          // người dùng đã nói rõ họ muốn gì — không cần đoán lại.
          contentGroup: "new_search" as ContentGroup,
          ingestSource: "adhoc_interest" as const,
          adHocInterestId: idQuanTam,
          status: coTheLaNhac(
            video.snippet?.title ?? "",
            video.snippet?.channelTitle,
            thoiLuong,
          ).coTheLaNhac
            ? ("pending_classification" as const)
            : ("pending_transcript" as const),
        },
      ],
      skipDuplicates: true,
    });

    themMoi += luu.count;
  }

  await prisma.adHocInterest.update({
    where: { id: idQuanTam },
    data: {
      lastScannedAt: new Date(),
      resultCount: { increment: themMoi },
    },
  });

  return { tuKhoa, soTimThay: timThay.length, soThemMoi: themMoi };
}

/**
 * Quét tất cả từ khoá đang bật tự quét.
 *
 * Một từ khoá hỏng không được làm chết những từ còn lại — hết hạn mức giữa
 * chừng là chuyện có thật, và những từ đã quét xong trước đó vẫn phải giữ được
 * kết quả.
 */
export async function quetTuKhoaQuanTam(
  soNgayGanDay = 3,
): Promise<KetQuaQuetTuKhoa> {
  const cacTuKhoa = await prisma.adHocInterest.findMany({
    where: { active: true, autoScan: true },
    orderBy: { createdAt: "asc" },
    select: { id: true, keyword: true },
  });

  const ketQua: KetQuaQuetMotTuKhoa[] = [];
  let tongThemMoi = 0;
  let hanMucDaTieu = 0;

  for (const tu of cacTuKhoa) {
    try {
      const kq = await quetMotTuKhoa(tu.id, tu.keyword, soNgayGanDay);
      ketQua.push(kq);
      tongThemMoi += kq.soThemMoi;
      hanMucDaTieu += GIA_MOT_TU_KHOA + 1;
    } catch (e) {
      ketQua.push({
        tuKhoa: tu.keyword,
        soTimThay: 0,
        soThemMoi: 0,
        loi: e instanceof Error ? e.message : String(e),
      });
      // Hết hạn mức thì những từ sau cũng hỏng nốt, dừng luôn cho gọn
      if (e instanceof Error && e.name === "HetHanMuc") break;
    }
  }

  return { cacTuKhoa: ketQua, tongThemMoi, hanMucDaTieu };
}
