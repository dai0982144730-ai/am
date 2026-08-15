/**
 * Đi tìm nội dung ngoài vùng đã theo dõi.
 *
 * VẤN ĐỀ: bốn chuyên mục chính chỉ quét các kênh chủ nhà đã đăng ký, nên mãi
 * chỉ thấy thứ mình đã biết mà theo dõi. Chủ dự án nói thẳng: *"nếu không muôn
 * đời tôi chỉ nhai lại không mở rộng được kiến thức."*
 *
 * CÁCH TÌM — đi theo chính gu đã bộc lộ, không tìm mò:
 *
 * Lấy **chủ đề Claude đã rút ra** từ những nội dung điểm cao (`extractedTopics`)
 * rồi dùng chúng làm từ khoá tìm. Khác chuyên mục "New" ở chỗ: New là chủ nhà
 * tự gõ; đây là máy suy ra từ thứ chủ nhà đã xem và chấm điểm cao. Nhờ vậy nó
 * mở rộng **quanh vùng đang quan tâm** chứ không lôi về thứ vô can.
 *
 * BA CHỐT CHẶN, theo đúng thứ tự tiêu tiền từ rẻ tới đắt:
 *
 *   1. Nguồn đã bị chủ nhà chê thì không lấy nữa (`uyTinNguon.ts`) — miễn phí
 *   2. Lọc sơ bộ bằng số liệu (`locSoBo.ts`) — miễn phí
 *   3. Claude đọc và chấm — đắt, chỉ dành cho thứ đã qua hai cửa trên
 *
 * Bước 3 không nằm ở file này: thứ tìm được chỉ được **đưa vào kho ở trạng thái
 * chờ**, rồi đi qua đúng dây chuyền phân loại và chấm điểm như mọi nội dung
 * khác. Nhờ vậy không có đường tắt nào cho nội dung nguồn lạ.
 */

import type { ContentGroup, ContentItemType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db/prisma";
import { coTheLaNhac } from "@/lib/music/nhanDienNhac";
import { GIA_LENH } from "@/lib/youtube/giaLenh";
import { goiYouTube } from "@/lib/youtube/goiApi";
import { docThoiLuong } from "@/lib/youtube/quetKenh";

import { locSoBo } from "./locSoBo";
import { idNguonNenBo } from "./uyTinNguon";

/** Điểm tối thiểu để một nội dung được coi là "chủ nhà thích", dùng làm mồi. */
const DIEM_LAM_MOI = 5.5;

/** Số chủ đề đem đi tìm mỗi đêm. Mỗi chủ đề tốn 100 đơn vị hạn mức. */
export const SO_CHU_DE_MOI_DEM = 6;

/** Số kết quả lấy về mỗi chủ đề. */
const KET_QUA_MOI_CHU_DE = 10;

/** Mỗi kênh lạ tối đa ngần này video trong một đêm. */
const TOI_DA_MOI_KENH_LA = 2;

/** Chỉ tìm nội dung đăng trong ngần này ngày. */
const SO_NGAY_GAN_DAY = 14;

interface KetQuaTim {
  id?: { videoId?: string };
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
  statistics?: { viewCount?: string; likeCount?: string; commentCount?: string };
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

export interface ChuDeDemTim {
  chuDe: string;
  /** Chuyên mục mà chủ đề này đến từ — để biết nội dung tìm được thuộc mảng nào */
  nhom: ContentGroup;
  /** Chủ đề này xuất hiện trong bao nhiêu nội dung điểm cao */
  soLanXuatHien: number;
}

/**
 * Chọn chủ đề để đem đi tìm.
 *
 * Ưu tiên chủ đề **xuất hiện nhiều lần** trong nhóm nội dung điểm cao: xuất
 * hiện một lần có thể là ngẫu nhiên, lặp lại nhiều lần mới là mối quan tâm.
 *
 * Bỏ chủ đề đã đem đi tìm trong bảy ngày qua — tìm lại đúng từ khoá cũ chỉ ra
 * đúng kết quả cũ, mà vẫn tốn nguyên 100 đơn vị hạn mức.
 */
export async function chonChuDeDeTim(
  soChuDe = SO_CHU_DE_MOI_DEM,
): Promise<ChuDeDemTim[]> {
  const diemCao = await prisma.contentItem.findMany({
    where: {
      status: "classified",
      score: { compositeScore: { gte: DIEM_LAM_MOI } },
      contentGroup: { notIn: ["other", "new_search"] },
    },
    orderBy: { score: { compositeScore: "desc" } },
    take: 60,
    select: {
      contentGroup: true,
      classification: { select: { extractedTopics: true } },
    },
  });

  // Đếm chủ đề, nhớ luôn nó hay đi với chuyên mục nào
  const dem = new Map<string, { so: number; nhom: ContentGroup }>();
  for (const muc of diemCao) {
    for (const chuDe of muc.classification?.extractedTopics ?? []) {
      const sach = chuDe.trim();
      // Chủ đề một chữ thường quá rộng để tìm ("AI", "học")
      if (sach.length < 4) continue;
      const cu = dem.get(sach.toLowerCase());
      dem.set(sach.toLowerCase(), {
        so: (cu?.so ?? 0) + 1,
        nhom: cu?.nhom ?? muc.contentGroup,
      });
    }
  }

  // Bỏ chủ đề vừa tìm gần đây
  const bayNgayTruoc = new Date(Date.now() - 7 * 86_400_000);
  const daTim = await prisma.adHocInterest.findMany({
    where: { note: "tự tìm", lastScannedAt: { gte: bayNgayTruoc } },
    select: { keyword: true },
  });
  const boQua = new Set(daTim.map((d) => d.keyword.toLowerCase()));

  return [...dem.entries()]
    .filter(([chuDe]) => !boQua.has(chuDe))
    .sort((a, b) => b[1].so - a[1].so)
    .slice(0, soChuDe)
    .map(([chuDe, v]) => ({
      chuDe,
      nhom: v.nhom,
      soLanXuatHien: v.so,
    }));
}

export interface KetQuaTimMotChuDe {
  chuDe: string;
  soTimThay: number;
  soDaCo: number;
  soBiLoc: number;
  soThemMoi: number;
  soKenhMoi: number;
  lyDoBiLoc: string[];
  loi?: string;
}

export interface KetQuaTimNguonMoi {
  cacChuDe: KetQuaTimMotChuDe[];
  tongThemMoi: number;
  tongKenhMoi: number;
  hanMucDaTieu: number;
  soNguonBiBo: number;
}

/** Tìm theo một chủ đề. */
async function timMotChuDe(
  chuDe: ChuDeDemTim,
  idNguonBoQua: Set<string>,
): Promise<KetQuaTimMotChuDe> {
  const tuLuc = new Date(Date.now() - SO_NGAY_GAN_DAY * 86_400_000);

  const timDuoc = await goiYouTube<{ items?: KetQuaTim[] }>(
    "search.list",
    "search",
    {
      part: "snippet",
      q: chuDe.chuDe,
      type: "video",
      order: "relevance",
      publishedAfter: tuLuc.toISOString(),
      maxResults: KET_QUA_MOI_CHU_DE,
    },
  );

  const maVideo = (timDuoc.items ?? [])
    .map((k) => k.id?.videoId)
    .filter((m): m is string => Boolean(m));

  const kq: KetQuaTimMotChuDe = {
    chuDe: chuDe.chuDe,
    soTimThay: maVideo.length,
    soDaCo: 0,
    soBiLoc: 0,
    soThemMoi: 0,
    soKenhMoi: 0,
    lyDoBiLoc: [],
  };

  if (maVideo.length === 0) return kq;

  const daCo = await prisma.contentItem.findMany({
    where: { externalId: { in: maVideo } },
    select: { externalId: true },
  });
  const daCoSet = new Set(daCo.map((m) => m.externalId));
  kq.soDaCo = daCoSet.size;

  const canLay = maVideo.filter((m) => !daCoSet.has(m));
  if (canLay.length === 0) return kq;

  const chiTiet = await goiYouTube<{ items?: ChiTietVideo[] }>(
    "videos.list",
    "videos",
    { part: "snippet,contentDetails,statistics", id: canLay.join(",") },
  );

  const demTheoKenh = new Map<string, number>();

  for (const video of chiTiet.items ?? []) {
    const idKenh = video.snippet?.channelId;
    if (!video.id || !idKenh) continue;

    // ----- Chốt 1: nguồn đã bị chê thì thôi -----
    if (idNguonBoQua.has(idKenh)) {
      kq.soBiLoc += 1;
      kq.lyDoBiLoc.push("kênh đã bị đánh giá thấp trước đó");
      continue;
    }

    const thoiLuong = docThoiLuong(video.contentDetails?.duration);

    // ----- Chốt 2: lọc sơ bộ bằng số liệu -----
    const loc = locSoBo({
      tieuDe: video.snippet?.title ?? "",
      thoiLuongGiay: thoiLuong,
      luotXem: docSo(video.statistics?.viewCount),
      luotThich: docSo(video.statistics?.likeCount),
      kieuPhat: video.snippet?.liveBroadcastContent,
      ngonNguAmThanh:
        video.snippet?.defaultAudioLanguage ??
        video.snippet?.defaultLanguage ??
        null,
    });
    if (!loc.qua) {
      kq.soBiLoc += 1;
      if (loc.lyDo) kq.lyDoBiLoc.push(loc.lyDo);
      continue;
    }

    // ----- Chốt 3: mỗi kênh lạ tối đa hai video -----
    const daLay = demTheoKenh.get(idKenh) ?? 0;
    if (daLay >= TOI_DA_MOI_KENH_LA) {
      kq.soBiLoc += 1;
      kq.lyDoBiLoc.push("đã lấy đủ số video cho kênh này");
      continue;
    }

    // Tìm-hoặc-tạo nguồn. Gặp lại kênh đã có thì KHÔNG đụng gì tới nó — nhất
    // là không được hạ một kênh đang theo dõi xuống thành "chưa theo dõi"
    const nguonTruoc = await prisma.source.findUnique({
      where: {
        type_externalId: { type: "youtube_channel", externalId: idKenh },
      },
      select: { id: true },
    });

    const nguon =
      nguonTruoc ??
      (await prisma.source.create({
        data: {
          type: "youtube_channel",
          externalId: idKenh,
          title: video.snippet?.channelTitle ?? "(kênh không rõ tên)",
          url: `https://www.youtube.com/channel/${idKenh}`,
          subscriptionStatus: "not_subscribed",
          contentGroupHint: chuDe.nhom,
        },
        select: { id: true },
      }));

    if (!nguonTruoc) kq.soKenhMoi += 1;

    const luu = await prisma.contentItem.createMany({
      data: [
        {
          sourceId: nguon.id,
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
          // KHÔNG gán chuyên mục sẵn. Chủ đề chỉ là cái cớ để đi tìm; nội dung
          // tìm được vẫn phải để Claude đọc rồi tự xếp như mọi thứ khác.
          contentGroup: "other" as ContentGroup,
          ingestSource: "discovery" as const,
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

    if (luu.count > 0) {
      kq.soThemMoi += 1;
      demTheoKenh.set(idKenh, daLay + 1);
    }
  }

  return kq;
}

/**
 * Đi tìm nguồn mới cho cả đêm.
 *
 * Một chủ đề hỏng không làm chết những chủ đề còn lại. Hết hạn mức thì dừng
 * hẳn — những chủ đề sau cũng sẽ hỏng nốt.
 */
export async function timNguonMoi(
  soChuDe = SO_CHU_DE_MOI_DEM,
): Promise<KetQuaTimNguonMoi> {
  const [cacChuDe, idBoQua] = await Promise.all([
    chonChuDeDeTim(soChuDe),
    idNguonNenBo(),
  ]);

  // `idNguonNenBo` trả về id trong kho; cần mã kênh YouTube để so lúc tìm
  const nguonBoQua = await prisma.source.findMany({
    where: { id: { in: idBoQua } },
    select: { externalId: true },
  });
  const maKenhBoQua = new Set(nguonBoQua.map((n) => n.externalId));

  const ketQua: KetQuaTimNguonMoi = {
    cacChuDe: [],
    tongThemMoi: 0,
    tongKenhMoi: 0,
    hanMucDaTieu: 0,
    soNguonBiBo: idBoQua.length,
  };

  for (const chuDe of cacChuDe) {
    try {
      const kq = await timMotChuDe(chuDe, maKenhBoQua);
      ketQua.cacChuDe.push(kq);
      ketQua.tongThemMoi += kq.soThemMoi;
      ketQua.tongKenhMoi += kq.soKenhMoi;
      ketQua.hanMucDaTieu += GIA_LENH["search.list"] + 1;

      // Ghi lại đã tìm chủ đề này, để bảy ngày tới không tìm lại
      await prisma.adHocInterest.upsert({
        where: { keyword: chuDe.chuDe },
        create: {
          keyword: chuDe.chuDe,
          note: "tự tìm",
          // KHÔNG bật tự quét: đây là chủ đề máy tự suy ra, không phải thứ chủ
          // nhà gõ vào. Bật lên thì nó chiếm hạn mức của chuyên mục "New" và
          // lẫn vào danh sách từ khoá chủ nhà tự đặt.
          autoScan: false,
          active: false,
          lastScannedAt: new Date(),
          resultCount: kq.soThemMoi,
        },
        update: {
          lastScannedAt: new Date(),
          resultCount: { increment: kq.soThemMoi },
        },
      });
    } catch (e) {
      ketQua.cacChuDe.push({
        chuDe: chuDe.chuDe,
        soTimThay: 0,
        soDaCo: 0,
        soBiLoc: 0,
        soThemMoi: 0,
        soKenhMoi: 0,
        lyDoBiLoc: [],
        loi: e instanceof Error ? e.message : String(e),
      });
      if (e instanceof Error && e.name === "HetHanMuc") break;
    }
  }

  return ketQua;
}
