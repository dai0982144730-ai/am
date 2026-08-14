/**
 * Quét bài mới từ các nguồn blog và diễn đàn, đưa vào kho.
 *
 * Nhánh này dùng chung `Source`/`ContentItem` với nhánh YouTube — đúng nguyên
 * tắc số một của bản thiết kế: "thêm nguồn mới chỉ là thêm một adapter, không
 * sửa cấu trúc dữ liệu". Chỗ khác biệt chỉ nằm ở cách lấy nội dung:
 *
 *   - Video: lời thoại → bảng `Transcript`
 *   - Bài viết: chữ trong bài → cũng vào `Transcript`, đánh dấu nguồn là
 *     `blog_article_text`
 *
 * Nhờ vậy bước phân loại bằng Claude dùng lại được y nguyên, không phải viết
 * riêng cho bài viết.
 */

import type { SourceReputationTier } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db/prisma";

import { NGUON_KHOI_DAU } from "./danhSachNguon";
import { docFeed, layToanVan, type MucTrongFeed } from "./docFeed";

/** Nghỉ giữa hai lần tải trang — không dội liên tục vào một máy chủ. */
const NGHI_GIUA_HAI_LAN_MS = 1_500;

/** Thời gian tối đa cho một lượt ghi, và thời gian chờ để bắt đầu ghi. */
const HAN_GHI_MS = 60_000;
const HAN_CHO_MS = 30_000;

function nghi(ms: number): Promise<void> {
  return new Promise((xong) => setTimeout(xong, ms));
}

/** Dựng bảng `Source` cho các nguồn khởi đầu. Chạy lại an toàn. */
export async function dungDanhSachNguon(): Promise<{
  themMoi: number;
  daCo: number;
}> {
  let themMoi = 0;
  let daCo = 0;

  for (const nguon of NGUON_KHOI_DAU) {
    const laDienDan = nguon.tangUyTin === "community_forum";

    const truoc = await prisma.source.findUnique({
      where: {
        type_externalId: {
          type: laDienDan ? "forum_community" : "blog_feed",
          externalId: nguon.duongDanFeed,
        },
      },
      select: { id: true },
    });

    await prisma.source.upsert({
      where: {
        type_externalId: {
          type: laDienDan ? "forum_community" : "blog_feed",
          externalId: nguon.duongDanFeed,
        },
      },
      create: {
        type: laDienDan ? "forum_community" : "blog_feed",
        externalId: nguon.duongDanFeed,
        url: nguon.trangChu,
        title: nguon.ten,
        reputationTier: nguon.tangUyTin as SourceReputationTier,
        contentGroupHint: "ai",
        subscriptionStatus: "subscribed",
      },
      update: {
        title: nguon.ten,
        url: nguon.trangChu,
        reputationTier: nguon.tangUyTin as SourceReputationTier,
      },
    });

    if (truoc) daCo += 1;
    else themMoi += 1;
  }

  return { themMoi, daCo };
}

export interface KetQuaQuetBlog {
  soNguonQuet: number;
  soBaiXet: number;
  soBaiThemMoi: number;
  soLayDuocToanVan: number;
  soChiCoTomTat: number;
  nguonLoi: { ten: string; lyDo: string }[];
}

/**
 * Lưu một bài viết vào kho.
 *
 * Chữ trong bài lưu vào `Transcript` để dùng chung đường ống với video. Điểm số
 * diễn đàn (nếu có) lưu vào `ExternalDiscussion` — đây là thước đo chất lượng
 * thay thế cho blog, vốn không có lượt xem hay lượt thích nào.
 */
async function luuMotBai(
  idNguon: string,
  muc: MucTrongFeed,
  vanBan: string | null,
  duongDanFeed: string,
): Promise<boolean> {
  const daCo = await prisma.contentItem.findUnique({
    where: { sourceId_externalId: { sourceId: idNguon, externalId: muc.ma } },
    select: { id: true },
  });
  if (daCo) return false;

  const laDienDan = muc.diemDienDan !== null;

  await prisma.$transaction(
    async (tx) => {
      const bai = await tx.contentItem.create({
        data: {
          sourceId: idNguon,
          externalId: muc.ma,
          url: muc.duongDan,
          type: laDienDan ? "forum_post" : "blog_article",
          title: muc.tieuDe,
          description: muc.noiDungTrongFeed?.slice(0, 2_000) ?? null,
          publishedAt: muc.dangLuc,
          contentGroup: "other",
          ingestSource: "subscribed",
          narrationType: "text_only",
          status: vanBan ? "pending_classification" : "transcript_unavailable",
        },
      });

      if (vanBan) {
        await tx.transcript.create({
          data: {
            contentItemId: bai.id,
            source: "blog_article_text",
            rawText: vanBan,
            fetchStatus: "success",
          },
        });
      }

      // Điểm số trên diễn đàn — thước đo thay thế cho nội dung không có chỉ số
      if (muc.diemDienDan !== null || muc.soBinhLuanDienDan !== null) {
        await tx.externalDiscussion.create({
          data: {
            contentItemId: bai.id,
            platform: duongDanFeed.includes("hnrss") ? "hackernews" : "reddit",
            score: muc.diemDienDan,
            commentCount: muc.soBinhLuanDienDan,
            url: muc.duongDan,
          },
        });
      }
    },
    { timeout: HAN_GHI_MS, maxWait: HAN_CHO_MS },
  );

  return true;
}

/**
 * Quét bài mới từ mọi nguồn blog và diễn đàn đã dựng.
 *
 * @param soBaiMoiNguon Số bài xét ở mỗi nguồn, tính từ mới nhất
 * @param soNgayGanDay  Chỉ lấy bài đăng trong ngần này ngày
 */
export async function quetBlog(
  soBaiMoiNguon = 10,
  soNgayGanDay = 7,
  bao?: (dong: string) => void,
): Promise<KetQuaQuetBlog> {
  const cacNguon = await prisma.source.findMany({
    where: { type: { in: ["blog_feed", "forum_community"] } },
    select: { id: true, title: true, externalId: true },
  });

  const moc = new Date(Date.now() - soNgayGanDay * 86_400_000);
  const nguonLoi: { ten: string; lyDo: string }[] = [];

  let soBaiXet = 0;
  let soBaiThemMoi = 0;
  let soLayDuocToanVan = 0;
  let soChiCoTomTat = 0;

  for (const nguon of cacNguon) {
    let cacMuc: MucTrongFeed[];
    try {
      cacMuc = await docFeed(nguon.externalId);
    } catch (e) {
      nguonLoi.push({
        ten: nguon.title,
        lyDo: e instanceof Error ? e.message : String(e),
      });
      continue;
    }

    const canXet = cacMuc
      .filter((m) => !m.dangLuc || m.dangLuc >= moc)
      .slice(0, soBaiMoiNguon);

    bao?.(`\n${nguon.title} — ${canXet.length}/${cacMuc.length} bài trong ${soNgayGanDay} ngày`);

    for (const muc of canXet) {
      soBaiXet += 1;

      try {
        const daCo = await prisma.contentItem.findUnique({
          where: {
            sourceId_externalId: { sourceId: nguon.id, externalId: muc.ma },
          },
          select: { id: true },
        });
        if (daCo) continue;

        // Nội dung trong feed đã đủ dài thì khỏi tải lại trang gốc — vừa nhanh
        // vừa đỡ làm phiền máy chủ người ta
        let vanBan = (muc.noiDungTrongFeed?.length ?? 0) >= 600
          ? muc.noiDungTrongFeed
          : null;
        let lyDo: string | null = null;

        if (!vanBan) {
          await nghi(NGHI_GIUA_HAI_LAN_MS);
          const lay = await layToanVan(muc.duongDan);
          vanBan = lay.vanBan;
          lyDo = lay.lyDoThatBai;
        }

        // Vẫn không có thì dùng tạm phần tóm tắt trong feed
        if (!vanBan && (muc.noiDungTrongFeed?.length ?? 0) >= 200) {
          vanBan = muc.noiDungTrongFeed;
          lyDo = null;
        }

        const themDuoc = await luuMotBai(
          nguon.id,
          muc,
          vanBan,
          nguon.externalId,
        );

        if (themDuoc) {
          soBaiThemMoi += 1;
          if (vanBan) {
            soLayDuocToanVan += 1;
            bao?.(`  ✓ ${muc.tieuDe.slice(0, 52)} — ${vanBan.length} ký tự`);
          } else {
            soChiCoTomTat += 1;
            bao?.(`  – ${muc.tieuDe.slice(0, 52)} — không lấy được chữ (${lyDo})`);
          }
        }
      } catch (e) {
        // Một bài hỏng không được làm chết cả mẻ quét
        bao?.(
          `  ✗ ${muc.tieuDe.slice(0, 46)} — ${e instanceof Error ? e.message.slice(0, 60) : e}`,
        );
      }
    }

    await prisma.source.update({
      where: { id: nguon.id },
      data: { lastCrawledAt: new Date() },
    });
  }

  return {
    soNguonQuet: cacNguon.length,
    soBaiXet,
    soBaiThemMoi,
    soLayDuocToanVan,
    soChiCoTomTat,
    nguonLoi,
  };
}
