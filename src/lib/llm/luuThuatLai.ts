/**
 * Chạy thuật lại hàng loạt cho các bài viết tiếng nước ngoài trong kho.
 *
 * Chỉ làm với bài **không phải tiếng Việt** — bài tiếng Việt thì đọc thẳng bản
 * gốc, thuật lại chỉ tốn công vô ích.
 */

import { prisma } from "@/lib/db/prisma";
import { CHO_LONG_TIENG } from "@/lib/tiengViet/loc";

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
  const TRUONG = {
    id: true,
    title: true,
    source: { select: { title: true } },
    transcript: { select: { rawText: true } },
  } as const;

  /**
   * CHỈ LẤY THỨ CLAUDE ĐÃ ĐỌC VÀ KẾT LUẬN LÀ TIẾNG NƯỚC NGOÀI.
   *
   * ĐÃ ĐO VÀ SỬA (2026-08-15). Bản đầu chỉ lọc "chưa có bản thuật lại" rồi để
   * code tự nhận ra bài tiếng Việt mà bỏ qua — tức là bắt database trả về mấy
   * chục bài rồi vứt gần hết. Chạy thật một lượt: **xét 57 bài, thuật lại được
   * 2, bỏ 55 vì vốn đã là tiếng Việt**. Trong khi hàng chờ có 26 bài blog cần
   * dịch mà không lượt nào chạm tới.
   *
   * Cột `originalLanguage` đã chứa sẵn kết luận của Claude từ bước phân loại.
   * Không dùng nó ở đây là bỏ phí thứ đã tốn công để biết.
   *
   * Hàm `laTiengViet` bên dưới vẫn giữ làm lưới chắn cuối: cột kia có thể còn
   * trống với nội dung vào kho theo đường khác.
   */
  const dieuKienChung = {
    ...CHO_LONG_TIENG,
    narrationAsset: null,
    transcript: { fetchStatus: "success" as const },
  };

  // Thuật lại thứ đáng thuật trước. Mỗi bản tốn hơn chục giây của Claude nên
  // thứ tự quan trọng: xếp theo ngày đăng thì có đêm dùng hết lượt cho mấy
  // bài tầm thường mà bỏ sót bài hay đăng hôm trước.
  const thuTu = [
    {
      score: {
        compositeScore: { sort: "desc" as const, nulls: "last" as const },
      },
    },
    { publishedAt: "desc" as const },
  ];

  /**
   * BÀI VIẾT ĐI TRƯỚC VIDEO — lý do mới có từ 2026-08-15.
   *
   * Chủ dự án xác nhận tiện ích lồng tiếng của họ chạy được trong khung phát
   * của am. Nghĩa là **video YouTube tiếng Anh đã có đường nghe rồi**. Còn bài
   * blog và bài diễn đàn thì tiện ích đó không giúp được gì — chúng là trang
   * web thường, không phải video.
   *
   * Nên khi phải chọn, dành lượt cho thứ chỉ am làm được.
   */
  const baiViet = await prisma.contentItem.findMany({
    where: { ...dieuKienChung, type: { in: ["blog_article", "forum_post"] } },
    orderBy: thuTu,
    take: gioiHan,
    select: TRUONG,
  });

  const conThieu = gioiHan - baiViet.length;
  const video =
    conThieu > 0
      ? await prisma.contentItem.findMany({
          where: { ...dieuKienChung, type: "video" },
          orderBy: thuTu,
          take: conThieu,
          select: TRUONG,
        })
      : [];

  const cacBai = [...baiViet, ...video];

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
