/**
 * Tìm kiếm và lọc nội dung — Phase 4b.
 *
 * NGUYÊN TẮC: **không gọi Claude trên đường đi của người dùng**. Người ta gõ ô
 * tìm kiếm là muốn thấy kết quả ngay, không phải chờ vài giây cho mô hình nghĩ.
 * Mọi thứ ở đây đều là truy vấn database thuần.
 *
 * BA KIỂU SẮP XẾP, đúng bản thiết kế:
 *
 * | Kiểu | Sắp theo | Dùng khi |
 * |---|---|---|
 * | Phù hợp nhất *(mặc định)* | điểm chất lượng | duyệt hằng ngày, để trợ lý quyết |
 * | Chất lượng cao nhất | cũng điểm chất lượng, nhưng bỏ qua gu | muốn thấy cái tốt nhất khách quan |
 * | Mới nhất trước | ngày đăng | theo tin nóng, nhất là mục AI |
 *
 * Hai kiểu đầu hiện cho kết quả giống nhau vì hệ số cá nhân hoá là việc của
 * Phase 9. Vẫn tách sẵn để khi có `UserTasteProfile` thì chỉ phải sửa một chỗ.
 */

import type {
  ContentGroup,
  ContentItemType,
  NarrationType,
} from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { chuaLuotQua } from "@/lib/lichSu/loc";

export type KieuSapXep = "phu_hop_nhat" | "chat_luong_cao_nhat" | "moi_nhat";

export interface BoLoc {
  /** Từ khoá tìm trong tiêu đề, mô tả, chủ đề và nhận xét của Claude */
  tuKhoa?: string;
  nhom?: ContentGroup;
  /** Lọc theo loại nội dung: video, bài viết, bài diễn đàn… */
  loai?: ContentItemType;
  /** Chỉ lấy nội dung có bản thuật lại tiếng Việt */
  daThuatLai?: boolean;
  /** Thời lượng tối đa, tính bằng phút */
  duoiBaoNhieuPhut?: number;
  /** Thời lượng tối thiểu, tính bằng phút */
  tuBaoNhieuPhut?: number;
  /** Loại giọng đọc */
  loaiGiong?: NarrationType;
  /** Chỉ lấy nội dung đăng trong ngần này ngày */
  trongBaoNhieuNgay?: number;
  sapXep?: KieuSapXep;
  trang?: number;
}

export const SO_MOI_TRANG = 24;

/** Các trường cần cho một thẻ nội dung. */
const TRUONG_THE = {
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
      title: true,
      reputationTier: true,
      subscriptionStatus: true,
    },
  },
  narrationAsset: { select: { id: true } },
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

/** Dựng điều kiện lọc từ những gì người dùng chọn. */
function dungDieuKien(loc: BoLoc): Prisma.ContentItemWhereInput {
  const dieuKien: Prisma.ContentItemWhereInput = {
    status: "classified",
  };

  // Chip "New" nghĩa là "tìm được nhờ từ khoá tôi gõ", không phải một chuyên
  // mục chủ đề — vì phân loại sẽ ghi đè `contentGroup` bằng chủ đề thật. Xem
  // lời giải thích dài hơn ở `app/quan-tam/page.tsx`.
  if (loc.nhom === "new_search") dieuKien.adHocInterestId = { not: null };
  else if (loc.nhom) dieuKien.contentGroup = loc.nhom;
  if (loc.loai) dieuKien.type = loc.loai;
  if (loc.loaiGiong) dieuKien.narrationType = loc.loaiGiong;
  if (loc.daThuatLai) dieuKien.narrationAsset = { isNot: null };

  if (loc.duoiBaoNhieuPhut || loc.tuBaoNhieuPhut) {
    dieuKien.durationSeconds = {
      ...(loc.tuBaoNhieuPhut ? { gte: loc.tuBaoNhieuPhut * 60 } : {}),
      ...(loc.duoiBaoNhieuPhut ? { lte: loc.duoiBaoNhieuPhut * 60 } : {}),
    };
  }

  if (loc.trongBaoNhieuNgay) {
    dieuKien.publishedAt = {
      gte: new Date(Date.now() - loc.trongBaoNhieuNgay * 86_400_000),
    };
  }

  // Truyện nghi do AI viết bị loại hẳn — bộ lọc cứng duy nhất trong hệ thống
  if (loc.nhom === "truyen") {
    dieuKien.classification = {
      OR: [
        { aiGeneratedSuspicionScore: null },
        { aiGeneratedSuspicionScore: { lt: 0.6 } },
      ],
    };
  }

  // Nội dung mê tín bị đẩy khỏi mục triết học
  if (loc.nhom === "triet_hoc") {
    dieuKien.classification = { misleadingContentFlag: false };
  }

  const tuKhoa = loc.tuKhoa?.trim();
  if (tuKhoa) {
    // Tìm trong nhiều chỗ, kể cả nhận xét và chủ đề Claude rút ra — nhờ vậy gõ
    // "khắc kỷ" vẫn tìm được video mà tiêu đề không hề có chữ đó
    dieuKien.OR = [
      { title: { contains: tuKhoa, mode: "insensitive" } },
      { description: { contains: tuKhoa, mode: "insensitive" } },
      { source: { title: { contains: tuKhoa, mode: "insensitive" } } },
      {
        classification: {
          contentQualityNotes: { contains: tuKhoa, mode: "insensitive" },
        },
      },
      { classification: { extractedTopics: { has: tuKhoa } } },
      {
        classification: {
          extractedAuthorNameRaw: { contains: tuKhoa, mode: "insensitive" },
        },
      },
    ];
  }

  return dieuKien;
}

/** Dựng thứ tự sắp xếp. */
function dungThuTu(
  kieu: KieuSapXep,
): Prisma.ContentItemOrderByWithRelationInput[] {
  if (kieu === "moi_nhat") {
    return [{ publishedAt: { sort: "desc", nulls: "last" } }];
  }

  // "Phù hợp nhất" và "chất lượng cao nhất" hiện giống nhau. Khi có
  // UserTasteProfile (Phase 9) thì "phù hợp nhất" sẽ nhân thêm hệ số cá nhân
  // hoá, còn "chất lượng cao nhất" vẫn giữ nguyên điểm thuần.
  return [
    { score: { compositeScore: { sort: "desc", nulls: "last" } } },
    { publishedAt: { sort: "desc", nulls: "last" } },
  ];
}

export interface KetQuaTim {
  cacThe: Awaited<
    ReturnType<
      typeof prisma.contentItem.findMany<{ select: typeof TRUONG_THE }>
    >
  >;
  tongSo: number;
  trang: number;
  soTrang: number;
}

/** Tìm và lọc nội dung. */
export async function timNoiDung(loc: BoLoc): Promise<KetQuaTim> {
  const trang = Math.max(1, loc.trang ?? 1);
  // Đang tìm một thứ cụ thể thì KHÔNG giấu nội dung đã xem — người ta gõ vào
  // ô tìm kiếm thường là để lần lại đúng cái vừa xem hôm qua. Chỉ lúc lướt
  // không mục đích mới cần giấu.
  const dangTimCuThe = Boolean(loc.tuKhoa?.trim());
  const dieuKien = dangTimCuThe
    ? dungDieuKien(loc)
    : chuaLuotQua(dungDieuKien(loc));

  const [cacThe, tongSo] = await Promise.all([
    prisma.contentItem.findMany({
      where: dieuKien,
      select: TRUONG_THE,
      orderBy: dungThuTu(loc.sapXep ?? "phu_hop_nhat"),
      skip: (trang - 1) * SO_MOI_TRANG,
      take: SO_MOI_TRANG,
    }),
    prisma.contentItem.count({ where: dieuKien }),
  ]);

  return {
    cacThe,
    tongSo,
    trang,
    soTrang: Math.max(1, Math.ceil(tongSo / SO_MOI_TRANG)),
  };
}

/** Đếm số nội dung mỗi chuyên mục, để hiện cạnh chip lọc. */
export async function demTheoNhom(): Promise<Record<string, number>> {
  const nhom = await prisma.contentItem.groupBy({
    by: ["contentGroup"],
    where: { status: "classified" },
    _count: { _all: true },
  });
  return Object.fromEntries(nhom.map((n) => [n.contentGroup, n._count._all]));
}
