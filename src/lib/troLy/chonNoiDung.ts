/**
 * Chắt lọc nội dung cho bản tin hằng sáng.
 *
 * VẤN ĐỀ CẦN GIẢI: mỗi đêm quét ra hơn trăm nội dung mới. Đưa cả danh sách đó
 * ra là vô dụng — người dùng lướt qua rồi bỏ, đúng như những gì họ đang gặp với
 * YouTube. Bản thiết kế nói rõ: *"chắt còn vài lựa chọn nổi bật nhất mỗi chủ đề,
 * phần còn lại gấp gọn 'xem thêm nếu rảnh'"*.
 *
 * CÁCH CHỌN — hai lớp:
 *
 *   - **Nổi bật nhất**: tối đa 2 mục mỗi chuyên mục, lấy theo điểm chất lượng
 *   - **Xem thêm nếu rảnh**: 4 mục tiếp theo, gộp chung
 *
 * MỘT QUYẾT ĐỊNH QUAN TRỌNG: **bản tin chỉ lấy bốn chuyên mục chính**, bỏ hẳn
 * nhóm "khác". Kho hằng đêm phần lớn là tin thời sự và giải trí — nếu để chúng
 * vào, bản tin sẽ toàn tin giật gân, đúng thứ người dùng muốn tránh khi lập ra
 * cái web này.
 */

import type { ContentGroup } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db/prisma";
import { ngheDuocTiengViet } from "@/lib/tiengViet/loc";

/** Bốn chuyên mục vào bản tin. Nhóm "khác" cố ý không có mặt. */
const CHUYEN_MUC_VAO_BAN_TIN: { ma: ContentGroup; ten: string }[] = [
  { ma: "ai", ten: "AI" },
  { ma: "triet_hoc", ten: "Triết học" },
  { ma: "khoa_hoc", ten: "Khoa học" },
  { ma: "truyen", ten: "Truyện" },
  { ma: "music", ten: "Music" },
];

/** Số mục nổi bật mỗi chuyên mục. */
const SO_NOI_BAT_MOI_MUC = 2;

/** Số mục gấp gọn vào phần "xem thêm nếu rảnh". */
const SO_XEM_THEM = 4;

const TRUONG_CAN_LAY = {
  id: true,
  title: true,
  url: true,
  durationSeconds: true,
  viewOrPlayCount: true,
  contentGroup: true,
  publishedAt: true,
  source: { select: { title: true } },
  score: { select: { compositeScore: true } },
  narrationAsset: { select: { id: true } },
  classification: {
    select: {
      contentQualityNotes: true,
      extractedTopics: true,
      extractedAuthorNameRaw: true,
      philosophyContentForm: true,
      storyGenre: true,
      musicGenre: true,
      bpm: true,
    },
  },
  commentAnalysis: { select: { discussionQualityScore: true } },
} as const;

export type MucDuocChon = Awaited<
  ReturnType<typeof prisma.contentItem.findFirst<{ select: typeof TRUONG_CAN_LAY }>>
>;

export interface MucTheoChuyenMuc {
  ma: ContentGroup;
  ten: string;
  cacMuc: NonNullable<MucDuocChon>[];
}

export interface NoiDungBanTin {
  noiBat: MucTheoChuyenMuc[];
  xemThemNeuRanh: NonNullable<MucDuocChon>[];
  /** Tổng số nội dung mới trong khoảng thời gian xét */
  tongMoi: number;
  tuLuc: Date;
}

/**
 * Chọn nội dung cho bản tin.
 *
 * @param soGioGanDay Chỉ xét nội dung được quét về trong ngần này giờ. Mặc định
 *   36 tiếng — rộng hơn một ngày một chút, để đêm nào máy tắt không quét được
 *   thì sáng hôm sau vẫn có bài.
 */
export async function chonNoiDungChoBanTin(
  soGioGanDay = 36,
): Promise<NoiDungBanTin> {
  const tuLuc = new Date(Date.now() - soGioGanDay * 3_600_000);

  // Bản tin tuyệt đối không được nhắc tới thứ chủ nhà nghe không hiểu
  const dieuKienChung = ngheDuocTiengViet({
    status: "classified" as const,
    createdAt: { gte: tuLuc },
  });

  const noiBat: MucTheoChuyenMuc[] = [];
  const daChon = new Set<string>();

  for (const muc of CHUYEN_MUC_VAO_BAN_TIN) {
    const cacMuc = await prisma.contentItem.findMany({
      where: {
        ...dieuKienChung,
        contentGroup: muc.ma,
        // Hai bộ lọc của bản thiết kế, áp dụng luôn ở đây
        ...(muc.ma === "truyen"
          ? {
              classification: {
                OR: [
                  { aiGeneratedSuspicionScore: null },
                  { aiGeneratedSuspicionScore: { lt: 0.6 } },
                ],
              },
            }
          : {}),
        ...(muc.ma === "triet_hoc"
          ? { classification: { misleadingContentFlag: false } }
          : {}),
      },
      select: TRUONG_CAN_LAY,
      orderBy: [
        { score: { compositeScore: { sort: "desc", nulls: "last" } } },
        { publishedAt: "desc" },
      ],
      take: SO_NOI_BAT_MOI_MUC,
    });

    if (cacMuc.length > 0) {
      cacMuc.forEach((m) => daChon.add(m.id));
      noiBat.push({ ma: muc.ma, ten: muc.ten, cacMuc });
    }
  }

  // Phần "xem thêm nếu rảnh": lấy tiếp trong bốn chuyên mục chính, bỏ những
  // mục đã vào phần nổi bật
  const xemThemNeuRanh = await prisma.contentItem.findMany({
    where: {
      ...dieuKienChung,
      contentGroup: { in: CHUYEN_MUC_VAO_BAN_TIN.map((m) => m.ma) },
      id: { notIn: [...daChon] },
    },
    select: TRUONG_CAN_LAY,
    orderBy: [
      { score: { compositeScore: { sort: "desc", nulls: "last" } } },
      { publishedAt: "desc" },
    ],
    take: SO_XEM_THEM,
  });

  const tongMoi = await prisma.contentItem.count({
    where: { createdAt: { gte: tuLuc } },
  });

  return { noiBat, xemThemNeuRanh, tongMoi, tuLuc };
}
