/**
 * Chấm điểm chất lượng cho nội dung trong kho.
 *
 * Đây là phần bản thiết kế gọi là **bài toán khó nhất** — không phải lọc theo
 * chủ đề, mà là: giữa hàng chục kết quả cùng chủ đề, cái nào thực sự hay.
 *
 * CÁI KHÓ NẰM Ở ĐÂU: mỗi loại nguồn có bộ chỉ số hoàn toàn khác nhau.
 *
 * | Loại nguồn | Có sẵn | Không có gì |
 * |---|---|---|
 * | YouTube | lượt xem, thích, bình luận, người đăng ký | lượt không thích |
 * | Diễn đàn | điểm, số bình luận | lượt xem |
 * | Blog | *(không có gì trên chính trang đó)* | tất cả |
 *
 * 500.000 lượt xem YouTube và 300 điểm Hacker News không cùng thang đo. Nên
 * **mọi tín hiệu đều được chuẩn hoá thành thứ hạng phần trăm TRONG CÙNG một
 * loại nguồn** trước khi đưa vào công thức. Đây là quy tắc không được phá.
 *
 * Phần tính toán nằm ở `normalize.ts` (viết từ Phase 0). File này lo phần lấy
 * dữ liệu, dựng tập tham chiếu, và ghi kết quả.
 */

import type { SourceType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db/prisma";

import {
  compositeScore,
  DEFAULT_WEIGHTS,
  engagementDepthScore,
  popularityScore,
  sourceAuthorityScore,
  toPercentile,
  type SourceWeights,
} from "./normalize";

/** Đổi công thức thì tăng số này, để biết bản ghi nào tính bằng bản nào. */
export const PHIEN_BAN_CHAM_DIEM = "v1";

const HAN_GHI_MS = 60_000;
const HAN_CHO_MS = 30_000;

/**
 * Tập tham chiếu của một loại nguồn — dùng để xếp hạng phần trăm.
 *
 * Phải dựng riêng cho từng loại nguồn, vì đó chính là điểm mấu chốt: một video
 * chỉ được so với video khác, một bài diễn đàn chỉ so với bài diễn đàn khác.
 */
interface TapThamChieu {
  tyLeXemTrenNguoiTheoDoi: number[];
  tyLeBinhLuanTrenXem: number[];
  tyLeThichTrenXem: number[];
  soNguoiTheoDoi: number[];
  diemDienDan: number[];
}

/** Dựng tập tham chiếu cho một loại nguồn. */
async function dungTapThamChieu(
  loaiNguon: SourceType,
): Promise<TapThamChieu> {
  const cacMuc = await prisma.contentItem.findMany({
    where: { source: { type: loaiNguon } },
    select: {
      viewOrPlayCount: true,
      likeCount: true,
      commentCount: true,
      source: { select: { followerCount: true } },
      externalDiscussions: { select: { score: true } },
    },
    take: 5_000,
  });

  const tap: TapThamChieu = {
    tyLeXemTrenNguoiTheoDoi: [],
    tyLeBinhLuanTrenXem: [],
    tyLeThichTrenXem: [],
    soNguoiTheoDoi: [],
    diemDienDan: [],
  };

  for (const muc of cacMuc) {
    const xem = muc.viewOrPlayCount;
    const theoDoi = muc.source.followerCount;

    if (xem !== null && xem > 0) {
      tap.tyLeXemTrenNguoiTheoDoi.push(
        theoDoi && theoDoi > 0 ? xem / theoDoi : xem,
      );
      if (muc.commentCount !== null) {
        tap.tyLeBinhLuanTrenXem.push(muc.commentCount / xem);
      }
      if (muc.likeCount !== null) {
        tap.tyLeThichTrenXem.push(muc.likeCount / xem);
      }
    }

    if (theoDoi !== null) tap.soNguoiTheoDoi.push(theoDoi);

    for (const tl of muc.externalDiscussions) {
      if (tl.score !== null) tap.diemDienDan.push(tl.score);
    }
  }

  return tap;
}

/** Lấy trọng số của một loại nguồn, ưu tiên bản người dùng đã chỉnh. */
async function layTrongSo(loaiNguon: SourceType): Promise<SourceWeights> {
  const daChinh = await prisma.sourceQualityProfile.findUnique({
    where: { sourceType: loaiNguon },
  });

  if (daChinh) {
    return {
      popularity: daChinh.weightPopularity,
      engagementDepth: daChinh.weightEngagementDepth,
      discussion: daChinh.weightDiscussion,
      authority: daChinh.weightAuthority,
      contentQuality: daChinh.weightContentQuality,
    };
  }

  return (
    DEFAULT_WEIGHTS[loaiNguon] ?? {
      popularity: 0.25,
      engagementDepth: 0.25,
      discussion: 0.25,
      authority: 0.25,
      contentQuality: 0,
    }
  );
}

export interface KetQuaChamDiem {
  daCham: number;
  theoLoaiNguon: Record<string, number>;
  diemCaoNhat: number;
  diemThapNhat: number;
}

/**
 * Chấm điểm cho toàn bộ nội dung đã phân loại.
 *
 * Chấm lại từ đầu mỗi lần chạy, vì tập tham chiếu thay đổi khi kho lớn lên —
 * một video từng đứng đầu có thể tụt xuống khi có video tốt hơn vào kho.
 */
export async function chamDiemHangLoat(
  bao?: (dong: string) => void,
): Promise<KetQuaChamDiem> {
  const cacLoaiNguon = await prisma.source.groupBy({ by: ["type"] });

  const theoLoaiNguon: Record<string, number> = {};
  let daCham = 0;
  let diemCaoNhat = 0;
  let diemThapNhat = 10;

  for (const { type: loaiNguon } of cacLoaiNguon) {
    const tap = await dungTapThamChieu(loaiNguon);
    const trongSo = await layTrongSo(loaiNguon);

    const cacMuc = await prisma.contentItem.findMany({
      where: { source: { type: loaiNguon }, status: "classified" },
      select: {
        id: true,
        viewOrPlayCount: true,
        likeCount: true,
        commentCount: true,
        contentGroup: true,
        source: {
          select: {
            followerCount: true,
            isVerified: true,
            createdAt: true,
            authors: { select: { author: { select: { approvedByUser: true } } } },
          },
        },
        classification: {
          select: {
            misleadingContentFlag: true,
            aiGeneratedSuspicionScore: true,
          },
        },
        externalDiscussions: { select: { score: true, commentCount: true } },
        commentAnalysis: { select: { discussionQualityScore: true } },
      },
    });

    if (cacMuc.length === 0) continue;

    bao?.(`\n${loaiNguon}: ${cacMuc.length} nội dung`);

    for (const muc of cacMuc) {
      const nguon = muc.source;

      const tuoiNguonNgay = nguon.createdAt
        ? Math.floor((Date.now() - nguon.createdAt.getTime()) / 86_400_000)
        : null;

      const trongWhitelist = nguon.authors.some(
        (a) => a.author.approvedByUser,
      );

      // Điểm thảo luận, lấy theo thứ tự ưu tiên:
      //
      //   1. Claude đã đọc bình luận thật (vòng 2) — chính xác nhất, vì nó
      //      phân biệt được thảo luận thực chất với bình luận phẫn nộ vài chữ
      //   2. Điểm bàn luận trên Hacker News / Reddit — thước đo thay thế cho
      //      blog, loại nội dung vốn không có chỉ số nào của riêng nó
      //   3. Không có gì — trụ này bị loại khỏi công thức, trọng số chia lại
      //      cho các trụ còn lại
      const diemThaoLuan =
        muc.commentAnalysis?.discussionQualityScore ??
        (muc.externalDiscussions.length > 0
          ? toPercentile(
              Math.max(
                ...muc.externalDiscussions.map((tl) => tl.score ?? 0),
              ),
              tap.diemDienDan,
            )
          : null);

      const boonPhoBien = popularityScore({
        viewCount: muc.viewOrPlayCount,
        followerCount: nguon.followerCount,
        peerRatios: tap.tyLeXemTrenNguoiTheoDoi,
      });

      const boonTuongTac = engagementDepthScore({
        viewCount: muc.viewOrPlayCount,
        commentCount: muc.commentCount,
        likeCount: muc.likeCount,
        peerCommentRatios: tap.tyLeBinhLuanTrenXem,
        peerLikeRatios: tap.tyLeThichTrenXem,
      });

      const boonUyTin = sourceAuthorityScore({
        followerCount: nguon.followerCount,
        peerFollowerCounts: tap.soNguoiTheoDoi,
        isWhitelisted: trongWhitelist,
        isVerified: nguon.isVerified,
        sourceAgeDays: tuoiNguonNgay,
      });

      // Nhạc: bỏ hẳn trụ thảo luận, đúng bản thiết kế — "Music không có chất
      // lượng nội dung do LLM chấm". Bình luận dưới video nhạc gần như luôn là
      // "hay quá", đọc cũng không rút ra được gì.
      //
      // Không đặt bộ trọng số riêng cho nhạc: đã thử và ĐO THẤY TỆ HƠN. Dồn
      // trọng số sang trụ "phổ biến" khiến nhạc thiên về lượt xem và leo từ
      // hạng 2 lên hạng 1. Để  tự chia lại theo đúng tỷ lệ gốc
      // giữa các trụ còn lại là cách công bằng hơn.
      let diem = compositeScore(
        {
          popularity: boonPhoBien,
          engagementDepth: boonTuongTac,
          discussion: muc.contentGroup === "music" ? null : diemThaoLuan,
          authority: boonUyTin,
          contentQuality: null,
        },
        trongSo,
      );

      // Điều chỉnh theo chuyên mục, đúng bản thiết kế: nội dung mê tín bị đẩy
      // xuống mạnh. Đây là TRỪ ĐIỂM chứ không loại bỏ — vẫn xuất hiện, chỉ nằm
      // cuối. Riêng truyện nghi do AI viết mới bị loại hẳn, và việc đó làm ở
      // tầng truy vấn chứ không phải ở đây.
      if (muc.classification?.misleadingContentFlag) {
        diem = diem * 0.4;
      }

      diem = Math.round(diem * 10) / 10;

      await prisma.contentScore.upsert({
        where: { contentItemId: muc.id },
        create: {
          contentItemId: muc.id,
          popularityScore: boonPhoBien,
          engagementDepthScore: boonTuongTac,
          discussionQualityScore: diemThaoLuan,
          sourceAuthorityScore: boonUyTin,
          compositeScore: diem,
          scoreVersion: PHIEN_BAN_CHAM_DIEM,
        },
        update: {
          popularityScore: boonPhoBien,
          engagementDepthScore: boonTuongTac,
          discussionQualityScore: diemThaoLuan,
          sourceAuthorityScore: boonUyTin,
          compositeScore: diem,
          scoreVersion: PHIEN_BAN_CHAM_DIEM,
          computedAt: new Date(),
        },
      });

      daCham += 1;
      theoLoaiNguon[loaiNguon] = (theoLoaiNguon[loaiNguon] ?? 0) + 1;
      if (diem > diemCaoNhat) diemCaoNhat = diem;
      if (diem < diemThapNhat) diemThapNhat = diem;
    }
  }

  return { daCham, theoLoaiNguon, diemCaoNhat, diemThapNhat };
}

/** Dựng bộ trọng số mặc định vào database để người dùng chỉnh được. */
export async function dungTrongSoMacDinh(): Promise<number> {
  let so = 0;

  for (const [loaiNguon, trongSo] of Object.entries(DEFAULT_WEIGHTS)) {
    await prisma.sourceQualityProfile.upsert({
      where: { sourceType: loaiNguon as SourceType },
      create: {
        sourceType: loaiNguon as SourceType,
        weightPopularity: trongSo.popularity,
        weightEngagementDepth: trongSo.engagementDepth,
        weightDiscussion: trongSo.discussion,
        weightAuthority: trongSo.authority,
        weightContentQuality: trongSo.contentQuality,
      },
      // Không đụng vào bản người dùng đã chỉnh
      update: {},
    });
    so += 1;
  }

  return so;
}

export { HAN_GHI_MS, HAN_CHO_MS };
