/**
 * Lấy nội dung cho trang chủ, gom sẵn theo chuyên mục.
 *
 * Trang chủ bám theo bản demo (`docs/demo-ui.html`): mỗi chuyên mục một hàng
 * thẻ, xếp cái đáng xem nhất lên trước.
 *
 * Xếp theo **điểm chất lượng** (Phase 4) — bốn trụ tín hiệu đã chuẩn hoá thứ
 * hạng phần trăm trong cùng loại nguồn. Nội dung chưa được chấm thì rơi xuống
 * cuối và xếp theo lượt xem, để kho mới quét về vẫn hiện ra chứ không biến mất.
 */

import type { ContentGroup } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db/prisma";
import { chuaLuotQua } from "@/lib/lichSu/loc";
import { dungDieuKien, type MaChuyenMuc } from "@/lib/nghiepVu/timVaLoc";
import { layTronTheoTyLe } from "@/lib/nguonMoi/tron";

/**
 * Các trường cần cho một thẻ nội dung trên trang chủ.
 *
 * XUẤT RA NGOÀI để trang chi tiết playlist dùng lại y hệt — cùng một khuôn
 * `TheNoiDung` thì `TheNoiDungCard` mới nhận thẳng được, không phải viết một
 * kiểu thẻ riêng cho mỗi chỗ hiện lưới nội dung.
 */
export const TRUONG_CAN_LAY = {
  id: true,
  title: true,
  url: true,
  thumbnailUrl: true,
  publishedAt: true,
  durationSeconds: true,
  viewOrPlayCount: true,
  contentGroup: true,
  narrationType: true,
  score: { select: { compositeScore: true } },
  source: {
    select: {
      id: true,
      type: true,
      title: true,
      reputationTier: true,
      subscriptionStatus: true,
    },
  },
  // `originalLanguage` va `ttsAudioUrl`: de the biet dan nhan NGHE DUOC hay
  // CHO LONG TIENG. Xem `nhanGoc` trong components/TheNoiDung.tsx.
  originalLanguage: true,
  narrationAsset: { select: { id: true, ttsAudioUrl: true } },
  // Đã lưu vào (những) playlist nào — để thẻ hiện thẳng tên playlist thay vì
  // chỉ có ba chấm. Xem `nhanPlaylist` trong components/TheNoiDung.tsx.
  playlistItems: {
    select: { playlist: { select: { id: true, title: true } } },
  },
  // Để thẻ biết mà bỏ các nhãn của luồng tuyển chọn — video chỉ có mặt trong
  // playlist thì không chờ lồng tiếng, không phải "nguồn mới" gì cả.
  chiTrongPlaylist: true,
  classification: {
    select: {
      titleVi: true,
      contentQualityNotes: true,
      extractedTopics: true,
      extractedAuthorNameRaw: true,
      aiSubtopic: true,
      philosophySchool: true,
      philosophyContentForm: true,
      listenerLevel: true,
      misleadingContentFlag: true,
      storyGenre: true,
      storyIntensity: true,
      aiGeneratedSuspicionScore: true,
      musicGenre: true,
      bpm: true,
      bpmBucket: true,
    },
  },
} as const;

export type TheNoiDung = Awaited<
  ReturnType<
    typeof prisma.contentItem.findFirst<{ select: typeof TRUONG_CAN_LAY }>
  >
>;

/** Bốn chuyên mục hiện lên trang chủ, theo đúng thứ tự trong bản demo. */
export const CHUYEN_MUC: { ma: ContentGroup; ten: string }[] = [
  { ma: "ai", ten: "AI" },
  { ma: "triet_hoc", ten: "Triết học" },
  { ma: "khoa_hoc", ten: "Khoa học" },
  { ma: "truyen", ten: "Truyện" },
  { ma: "music", ten: "Music" },
];

export interface MucTrangChu {
  ma: ContentGroup;
  ten: string;
  cacThe: NonNullable<TheNoiDung>[];
  tongSo: number;
  /** Trong hàng này có mấy thẻ đến từ nguồn chưa theo dõi */
  soTuNguonLa: number;
  /** Tỉ lệ nguồn mới đã đặt cho chuyên mục này dành ra mấy suất */
  suatDanhChoNguonLa: number;
}

/**
 * Lấy nội dung của một chuyên mục.
 *
 * Truyện do AI viết bị loại thẳng — đây là bộ lọc CỨNG duy nhất trong hệ thống,
 * vì truyện AI sản xuất hàng loạt là thứ chủ dự án muốn loại hẳn chứ không phải
 * xếp cuối. Ngưỡng 0,6 chọn khá rộng tay, để không oan cho truyện thật.
 */
async function layMotMuc(
  ma: ContentGroup,
  ten: string,
  soThe: number,
): Promise<MucTrangChu> {
  // Dùng CHUNG điều kiện với Khám phá (`dungDieuKien`) — bản trước tự viết
  // điều kiện riêng ở đây, quên mất Luật 5 phút, nên trang chủ bày ra 10 video
  // nhạc thực chất là YouTube Shorts vài chục giây mà Khám phá đã lọc sạch.
  // Năm mã ở `CHUYEN_MUC` trùng khớp với `MaChuyenMuc` nên truyền thẳng được.
  const loc = chuaLuotQua(await dungDieuKien({ nhom: ma as MaChuyenMuc }));

  // Trộn nguồn quen với nguồn lạ theo tỉ lệ chủ nhà đặt cho chuyên mục này
  const [tron, tongSo] = await Promise.all([
    layTronTheoTyLe<NonNullable<TheNoiDung>>(ma, loc, TRUONG_CAN_LAY, soThe),
    prisma.contentItem.count({ where: loc }),
  ]);

  return {
    ma,
    ten,
    cacThe: tron.cacMuc,
    tongSo,
    soTuNguonLa: tron.soTuNguonLa,
    suatDanhChoNguonLa: tron.suatDanhChoNguonLa,
  };
}

/** Lấy toàn bộ nội dung cho trang chủ. Mục rỗng bị bỏ đi. */
export async function layNoiDungTrangChu(soThe = 4): Promise<MucTrangChu[]> {
  const cacMuc = await Promise.all(
    CHUYEN_MUC.map((m) => layMotMuc(m.ma, m.ten, soThe)),
  );
  return cacMuc.filter((m) => m.cacThe.length > 0);
}

export interface TinhHinhKho {
  tongNoiDung: number;
  daPhanLoai: number;
  choPhanLoai: number;
  soNguon: number;
  quetGanNhat: Date | null;
}

/** Vài con số để hiện ở đầu trang, cho biết kho đang có gì. */
export async function layTinhHinhKho(): Promise<TinhHinhKho> {
  const [tongNoiDung, daPhanLoai, soNguon, nguonMoiNhat] = await Promise.all([
    prisma.contentItem.count(),
    prisma.contentItem.count({ where: { status: "classified" } }),
    prisma.source.count({ where: { type: "youtube_channel" } }),
    prisma.source.findFirst({
      where: { lastCrawledAt: { not: null } },
      orderBy: { lastCrawledAt: "desc" },
      select: { lastCrawledAt: true },
    }),
  ]);

  return {
    tongNoiDung,
    daPhanLoai,
    choPhanLoai: tongNoiDung - daPhanLoai,
    soNguon,
    quetGanNhat: nguonMoiNhat?.lastCrawledAt ?? null,
  };
}
