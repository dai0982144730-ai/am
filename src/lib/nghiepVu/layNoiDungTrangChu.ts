/**
 * Lấy nội dung cho trang chủ, gom sẵn theo chuyên mục.
 *
 * Trang chủ bám theo bản demo (`docs/demo-ui.html`): mỗi chuyên mục một hàng
 * thẻ, xếp cái đáng xem nhất lên trước.
 *
 * Tạm xếp theo lượt xem, vì engine chấm chất lượng là việc của Phase 4. Khi có
 * `ContentScore` rồi thì chỉ phải đổi mỗi phần `orderBy` ở đây.
 */

import type { ContentGroup } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db/prisma";

/** Các trường cần cho một thẻ nội dung trên trang chủ. */
const TRUONG_CAN_LAY = {
  id: true,
  title: true,
  url: true,
  thumbnailUrl: true,
  publishedAt: true,
  durationSeconds: true,
  viewOrPlayCount: true,
  contentGroup: true,
  narrationType: true,
  source: { select: { title: true } },
  classification: {
    select: {
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
  ReturnType<typeof prisma.contentItem.findFirst<{ select: typeof TRUONG_CAN_LAY }>>
>;

/** Bốn chuyên mục hiện lên trang chủ, theo đúng thứ tự trong bản demo. */
export const CHUYEN_MUC: { ma: ContentGroup; ten: string }[] = [
  { ma: "ai", ten: "AI" },
  { ma: "triet_hoc", ten: "Triết học" },
  { ma: "truyen", ten: "Truyện" },
  { ma: "music", ten: "Music" },
];

export interface MucTrangChu {
  ma: ContentGroup;
  ten: string;
  cacThe: NonNullable<TheNoiDung>[];
  tongSo: number;
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
  const dieuKien = {
    contentGroup: ma,
    status: "classified" as const,
    ...(ma === "truyen"
      ? {
          classification: {
            OR: [
              { aiGeneratedSuspicionScore: null },
              { aiGeneratedSuspicionScore: { lt: 0.6 } },
            ],
          },
        }
      : {}),
    // Nội dung mê tín bị đẩy ra khỏi mục triết học theo đúng bản thiết kế
    ...(ma === "triet_hoc"
      ? { classification: { misleadingContentFlag: false } }
      : {}),
  };

  const [cacThe, tongSo] = await Promise.all([
    prisma.contentItem.findMany({
      where: dieuKien,
      select: TRUONG_CAN_LAY,
      orderBy: [{ viewOrPlayCount: "desc" }, { publishedAt: "desc" }],
      take: soThe,
    }),
    prisma.contentItem.count({ where: dieuKien }),
  ]);

  return { ma, ten, cacThe, tongSo };
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
