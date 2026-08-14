/**
 * Vòng 2 của việc chấm chất lượng — Claude đọc bình luận thật.
 *
 * HAI VÒNG, VÌ SAO: gọi API bình luận và cho mô hình đọc cho *mọi* nội dung
 * quét được sẽ tốn hạn mức và công vô ích, vì phần lớn đã bị loại từ vòng đầu.
 *
 *   - **Vòng 1** (rẻ, chạy cho tất cả): chấm bằng số liệu thuần — lượt xem, tỷ
 *     lệ bình luận, uy tín nguồn. Không gọi API bình luận. Đã làm ở `chamDiem.ts`.
 *   - **Vòng 2** (chỉ ~20 ứng viên đứng đầu mỗi ngày): lấy bình luận thật rồi
 *     nhờ Claude chấm. Chính là file này.
 *
 * Chi phí một lần chạy vòng 2 cho 20 video: 20 đơn vị hạn mức YouTube (0,2%
 * ngân sách ngày) và 20 lần gọi Haiku. Rất rẻ so với giá trị mang lại.
 */

import { prisma } from "@/lib/db/prisma";
import { chamBinhLuanMotVideo } from "@/lib/llm/chamBinhLuan";
import { layBinhLuanNoiBat } from "@/lib/youtube/layBinhLuan";

const HAN_GHI_MS = 60_000;
const HAN_CHO_MS = 30_000;

/** Nghỉ giữa hai video. */
const NGHI_GIUA_HAI_LAN_MS = 400;

/** Video ít bình luận quá thì không đủ căn cứ để chấm. */
const TOI_THIEU_BINH_LUAN = 3;

function nghi(ms: number): Promise<void> {
  return new Promise((xong) => setTimeout(xong, ms));
}

export interface KetQuaVongHai {
  daXet: number;
  daCham: number;
  itBinhLuan: number;
  loi: number;
  toClickbait: number;
  toanEmoji: number;
  khenChiTiet: number;
  diemTrungBinh: number;
}

/**
 * Chạy vòng 2 cho các ứng viên đứng đầu.
 *
 * Chọn ứng viên theo điểm vòng 1, và chỉ lấy video YouTube — bài blog không có
 * phần bình luận để đọc (điểm thảo luận của chúng lấy từ Hacker News, đã làm ở
 * vòng 1).
 */
export async function chayVongHai(
  soUngVien = 20,
  bao?: (dong: string) => void,
): Promise<KetQuaVongHai> {
  const ungVien = await prisma.contentItem.findMany({
    where: {
      type: "video",
      status: "classified",
      commentAnalysis: null,
      // Nhạc không cần: bình luận dưới video nhạc gần như luôn là "hay quá",
      // và bản thiết kế cũng nói nhạc không dùng điểm chất lượng nội dung
      contentGroup: { not: "music" },
      commentCount: { gte: TOI_THIEU_BINH_LUAN },
    },
    orderBy: [
      { score: { compositeScore: { sort: "desc", nulls: "last" } } },
      { viewOrPlayCount: "desc" },
    ],
    take: soUngVien,
    select: {
      id: true,
      externalId: true,
      title: true,
      commentCount: true,
      score: { select: { compositeScore: true } },
    },
  });

  let daCham = 0;
  let itBinhLuan = 0;
  let loi = 0;
  let toClickbait = 0;
  let toanEmoji = 0;
  let khenChiTiet = 0;
  let tongDiem = 0;

  for (const [thuTu, video] of ungVien.entries()) {
    if (thuTu > 0) await nghi(NGHI_GIUA_HAI_LAN_MS);

    try {
      const cacBinhLuan = await layBinhLuanNoiBat(video.externalId, 20);

      if (cacBinhLuan.length < TOI_THIEU_BINH_LUAN) {
        itBinhLuan += 1;
        bao?.(
          `  – ${video.title.slice(0, 46)} — chỉ có ${cacBinhLuan.length} bình luận, bỏ qua`,
        );
        continue;
      }

      const kq = await chamBinhLuanMotVideo(video.title, cacBinhLuan);

      const coCo: string[] = [];
      if (kq.binhLuanToanEmoji) {
        coCo.push("spam_emoji_only");
        toanEmoji += 1;
      }
      if (kq.toTieuDeSaiNoiDung) {
        coCo.push("clickbait_complaint");
        toClickbait += 1;
      }
      if (kq.khenChiTietCuThe) {
        coCo.push("praised_specific_detail");
        khenChiTiet += 1;
      }

      await prisma.$transaction(
        [
          prisma.commentAnalysis.create({
            data: {
              contentItemId: video.id,
              sampledCount: cacBinhLuan.length,
              discussionQualityScore: kq.diemThaoLuan,
              signals: { coCo, nhanXet: kq.nhanXet },
            },
          }),
          prisma.contentScore.update({
            where: { contentItemId: video.id },
            data: { discussionQualityScore: kq.diemThaoLuan },
          }),
        ],
        { timeout: HAN_GHI_MS, maxWait: HAN_CHO_MS },
      );

      daCham += 1;
      tongDiem += kq.diemThaoLuan;

      const nhanCo = [
        kq.toTieuDeSaiNoiDung ? "TỐ CLICKBAIT" : null,
        kq.binhLuanToanEmoji ? "toàn emoji" : null,
        kq.khenChiTietCuThe ? "khen chi tiết cụ thể" : null,
      ].filter(Boolean);

      bao?.(
        `  ${kq.diemThaoLuan.toFixed(2)} ${video.title.slice(0, 44)}\n` +
          `       ${cacBinhLuan.length} bình luận${nhanCo.length ? ` · ${nhanCo.join(" · ")}` : ""}\n` +
          `       ${kq.nhanXet.slice(0, 100)}`,
      );
    } catch (e) {
      loi += 1;
      bao?.(
        `  ✗ ${video.title.slice(0, 42)} — ${e instanceof Error ? e.message.slice(0, 70) : e}`,
      );
    }
  }

  return {
    daXet: ungVien.length,
    daCham,
    itBinhLuan,
    loi,
    toClickbait,
    toanEmoji,
    khenChiTiet,
    diemTrungBinh: daCham > 0 ? tongDiem / daCham : 0,
  };
}
