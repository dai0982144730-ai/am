/**
 * Chạy thuật lại hàng loạt cho các bài viết tiếng nước ngoài trong kho.
 *
 * Chỉ làm với bài **không phải tiếng Việt** — bài tiếng Việt thì đọc thẳng bản
 * gốc, thuật lại chỉ tốn công vô ích.
 */

import { prisma } from "@/lib/db/prisma";

import { thuatLaiMotBai } from "./thuatLai";

const HAN_GHI_MS = 60_000;
const HAN_CHO_MS = 30_000;

/** Nghỉ giữa hai bài, tránh dội liên tục. */
const NGHI_GIUA_HAI_LAN_MS = 500;

/** Bài ngắn hơn ngần này thì không đáng thuật lại. */
const TOI_THIEU_CHU = 600;

function nghi(ms: number): Promise<void> {
  return new Promise((xong) => setTimeout(xong, ms));
}

/**
 * Đoán xem bài có phải tiếng Việt không.
 *
 * Đếm tỷ lệ chữ cái riêng của tiếng Việt (ă, â, đ, ê, ô, ơ, ư và các dấu). Cách
 * này thô nhưng đủ dùng và không tốn một lần gọi mô hình chỉ để hỏi một câu
 * đơn giản.
 */
export function laTiengViet(vanBan: string): boolean {
  const mau = vanBan.slice(0, 3_000);
  const chuViet = mau.match(
    /[ăâđêôơưàáảãạằắẳẵặầấẩẫậèéẻẽẹềếểễệìíỉĩịòóỏõọồốổỗộờớởỡợùúủũụừứửữựỳýỷỹỵ]/gi,
  );
  return (chuViet?.length ?? 0) / mau.length > 0.02;
}

export interface KetQuaThuatLaiHangLoat {
  daXet: number;
  thanhCong: number;
  boQuaVietSan: number;
  loi: number;
  tongChuRa: number;
}

/** Thuật lại các bài viết chưa có bản tiếng Việt. */
export async function thuatLaiHangLoat(
  gioiHan = 5,
  bao?: (dong: string) => void,
): Promise<KetQuaThuatLaiHangLoat> {
  const cacBai = await prisma.contentItem.findMany({
    where: {
      type: { in: ["blog_article", "forum_post"] },
      narrationAsset: null,
      transcript: { fetchStatus: "success" },
    },
    orderBy: { publishedAt: "desc" },
    take: gioiHan * 2, // lấy dư vì sẽ bỏ bớt bài tiếng Việt
    select: {
      id: true,
      title: true,
      source: { select: { title: true } },
      transcript: { select: { rawText: true } },
    },
  });

  let thanhCong = 0;
  let boQuaVietSan = 0;
  let loi = 0;
  let tongChuRa = 0;
  let daXet = 0;

  for (const bai of cacBai) {
    if (thanhCong + loi >= gioiHan) break;

    const goc = bai.transcript?.rawText ?? "";
    if (goc.length < TOI_THIEU_CHU) continue;

    daXet += 1;

    if (laTiengViet(goc)) {
      boQuaVietSan += 1;
      bao?.(`  – ${bai.title.slice(0, 50)} — đã là tiếng Việt, bỏ qua`);
      continue;
    }

    if (daXet > 1) await nghi(NGHI_GIUA_HAI_LAN_MS);

    try {
      const kq = await thuatLaiMotBai(bai.title, goc, bai.source.title);

      await prisma.narrationAsset.create({
        data: {
          contentItemId: bai.id,
          scriptText: kq.banThuatLai,
          detailLevel: "full_retelling",
        },
      });

      thanhCong += 1;
      tongChuRa += kq.soChuRa;
      bao?.(
        `  ✓ ${bai.title.slice(0, 48)}\n` +
          `      ${goc.length} chữ gốc → ${kq.banThuatLai.length} chữ tiếng Việt`,
      );
    } catch (e) {
      loi += 1;
      bao?.(
        `  ✗ ${bai.title.slice(0, 44)} — ${e instanceof Error ? e.message.slice(0, 70) : e}`,
      );
    }
  }

  return { daXet, thanhCong, boQuaVietSan, loi, tongChuRa };
}

/** Chỉ dùng cho phần ghi transaction dài — giữ để nhất quán với các file khác. */
export const HAN_GHI = { timeout: HAN_GHI_MS, maxWait: HAN_CHO_MS };
