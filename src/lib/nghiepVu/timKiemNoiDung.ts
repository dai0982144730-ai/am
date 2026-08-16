/**
 * Tìm nội dung trong kho của trang `am`.
 *
 * Đây là lớp dịch giữa hai thế giới: bên trong database tên cột bằng tiếng Anh
 * (`ContentItem`, `compositeScore`…), bên ngoài API trả về tiếng Việt không dấu
 * theo đúng khung chung của ba trang. Không đổi tên schema — app Android không
 * bao giờ nhìn thấy tên cột, nó chỉ thấy JSON.
 *
 * Xem docs/plan.md, mục "Cổng API trợ lý".
 */

import type { Prisma } from "@/generated/prisma/client";
import type { ContentGroup } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db/prisma";
import type { KetQuaTimKiem, LoaiKetQua, MucKetQua } from "@/lib/troLyChung/kieuDuLieu";
import { LoiTroLy } from "@/lib/troLyChung/phanHoi";

export interface ThamSoTimKiem {
  tuKhoa: string;
  /** ai | triet_hoc | truyen | music | khoa_hoc | new_search | other */
  chuyenMuc?: string;
  /** Chỉ lấy nội dung đăng từ ngày này (yyyy-mm-dd) */
  tuNgay?: string;
  soLuong?: number;
  /** Trả về cả lời thoại / toàn văn bài viết */
  kemNoiDung?: boolean;
}

const SO_LUONG_MAC_DINH = 10;
const SO_LUONG_TOI_DA = 50;

/** Danh sách chuyên mục hợp lệ — khớp enum ContentGroup trong schema */
const CHUYEN_MUC_HOP_LE: ContentGroup[] = [
  "ai",
  "triet_hoc",
  "khoa_hoc",
  "truyen",
  "music",
  "new_search",
  "other",
];

/**
 * Kiểm tra chuỗi người gọi gửi lên có phải chuyên mục thật không.
 *
 * Viết dạng "type guard" để TypeScript hiểu rằng sau khi kiểm tra xong thì chuỗi
 * đó chắc chắn là một giá trị của enum — nhờ vậy không phải ép kiểu bừa khi đưa
 * vào truy vấn Prisma.
 */
function laChuyenMucHopLe(gia: string): gia is ContentGroup {
  return (CHUYEN_MUC_HOP_LE as string[]).includes(gia);
}

/**
 * Đổi `ContentItem.type` sang `loai` của khung chung.
 *
 * Khung chung chỉ có `video` và `baiViet` cho trang này. Podcast và nhạc đều là
 * thứ để nghe nên gộp vào `video` — app điện thoại chỉ cần biết "cái này bấm là
 * phát được", còn chi tiết nằm trong `duLieuRieng.loaiGoc`.
 */
function doiLoai(loaiGoc: string): LoaiKetQua {
  return loaiGoc === "blog_article" || loaiGoc === "forum_post" ? "baiViet" : "video";
}

/**
 * Tính độ liên quan 0–1.
 *
 * Ưu tiên điểm chất lượng đã chấm (`compositeScore` thang 0–10, xem
 * lib/scoring/normalize.ts). Nội dung chưa được chấm điểm — chuyện bình thường
 * khi vừa quét về — thì trả 0.5 thay vì 0: chưa chấm không có nghĩa là dở, và
 * cho 0 sẽ đẩy nội dung mới xuống cuối một cách oan uổng.
 */
function tinhDoLienQuan(diem: number | null | undefined): number {
  if (diem === null || diem === undefined) return 0.5;
  return Math.round(Math.min(1, Math.max(0, diem / 10)) * 100) / 100;
}

/** Cắt mô tả dài thành đoạn tóm tắt đọc được */
function tomTatTu(moTa: string | null, tieuDe: string): string {
  if (!moTa) return tieuDe;
  const gon = moTa.replace(/\s+/g, " ").trim();
  return gon.length <= 300 ? gon : `${gon.slice(0, 297)}…`;
}

/** Đổi Date sang chuỗi yyyy-mm-dd */
function doiNgay(ngay: Date | null): string | null {
  return ngay ? ngay.toISOString().slice(0, 10) : null;
}

/**
 * Các trường cần lấy kèm.
 *
 * Tách ra hằng số để `timKiemNoiDung` và `layNoiDung` dùng chung một hình dạng
 * dữ liệu, tránh hai chỗ trả về hai kiểu khác nhau.
 */
export const QUAN_HE_CAN_LAY = {
  source: { select: { title: true, type: true, url: true } },
  score: { select: { compositeScore: true } },
  classification: {
    select: {
      aiSubtopic: true,
      philosophySchool: true,
      storyGenre: true,
      musicGenre: true,
      bpm: true,
      bpmConfidence: true,
      extractedTopics: true,
    },
  },
} satisfies Prisma.ContentItemInclude;

/**
 * Kiểu của một bản ghi lấy về kèm quan hệ ở trên.
 *
 * Để Prisma tự suy ra thay vì viết tay: viết tay thì mỗi lần đổi `QUAN_HE_CAN_LAY`
 * lại phải nhớ sửa hai chỗ, và quên một chỗ thì TypeScript không báo gì.
 */
export type BanGhiNoiDung = Prisma.ContentItemGetPayload<{
  include: typeof QUAN_HE_CAN_LAY;
}>;

/** Đổi một bản ghi database thành mục kết quả theo khung chung */
export function doiSangMucKetQua(ban: BanGhiNoiDung): MucKetQua {
  return {
    id: ban.id,
    tieuDe: ban.title,
    loai: doiLoai(ban.type),
    tomTat: tomTatTu(ban.description, ban.title),
    ngay: doiNgay(ban.publishedAt),
    duongDan: ban.url,
    doLienQuan: tinhDoLienQuan(ban.score?.compositeScore),
    duLieuRieng: {
      chuyenMuc: ban.contentGroup,
      loaiGoc: ban.type,
      nguon: ban.source?.title ?? null,
      loaiNguon: ban.source?.type ?? null,
      thoiLuongGiay: ban.durationSeconds,
      luotXem: ban.viewOrPlayCount,
      loaiGiong: ban.narrationType,
      ngonNguGoc: ban.originalLanguage,
      diemChatLuong: ban.score?.compositeScore ?? null,
      chuDe: ban.classification?.extractedTopics ?? [],
      // Trường đặc thù theo chuyên mục — chỉ điền cái nào có
      ...(ban.classification?.aiSubtopic ? { nhanhAi: ban.classification.aiSubtopic } : {}),
      ...(ban.classification?.philosophySchool
        ? { truongPhaiTriet: ban.classification.philosophySchool }
        : {}),
      ...(ban.classification?.storyGenre
        ? { theLoaiTruyen: ban.classification.storyGenre }
        : {}),
      ...(ban.classification?.musicGenre
        ? {
            theLoaiNhac: ban.classification.musicGenre,
            bpm: ban.classification.bpm,
            doTinCayBpm: ban.classification.bpmConfidence,
          }
        : {}),
    },
  };
}

/**
 * Lấy toàn văn của một mục.
 *
 * Ưu tiên bản thuật lại tiếng Việt nếu có (bài blog nước ngoài đã được thuật
 * lại), không thì lấy lời thoại gốc. Nhạc thì không có gì để lấy — đúng theo
 * nguyên tắc "Music đi nhánh riêng, không transcript".
 */
export async function layToanVan(contentItemId: string): Promise<string | null> {
  const [thuatLai, loiThoai] = await Promise.all([
    prisma.narrationAsset.findUnique({
      where: { contentItemId },
      select: { scriptText: true },
    }),
    prisma.transcript.findUnique({
      where: { contentItemId },
      select: { rawText: true, fetchStatus: true },
    }),
  ]);

  if (thuatLai?.scriptText) return thuatLai.scriptText;
  if (loiThoai?.fetchStatus === "success" && loiThoai.rawText) return loiThoai.rawText;
  return null;
}

/**
 * Tìm nội dung theo từ khoá.
 *
 * Hiện tìm theo tiêu đề và mô tả. Khi Phase 6 làm xong full-text search trên
 * `Transcript.rawText` thì mở rộng thêm ở đây — khung câu trả lời không đổi, nên
 * app Android không phải sửa gì.
 */
export async function timKiemNoiDung(thamSo: ThamSoTimKiem): Promise<KetQuaTimKiem> {
  const tuKhoa = (thamSo.tuKhoa ?? "").trim();
  if (!tuKhoa) {
    throw new LoiTroLy("tham_so_sai", "Thiếu tham số 'tuKhoa'.");
  }

  let chuyenMuc: ContentGroup | undefined;
  if (thamSo.chuyenMuc) {
    if (!laChuyenMucHopLe(thamSo.chuyenMuc)) {
      throw new LoiTroLy(
        "tham_so_sai",
        `Chuyên mục '${thamSo.chuyenMuc}' không có. Chọn một trong: ${CHUYEN_MUC_HOP_LE.join(", ")}.`,
      );
    }
    chuyenMuc = thamSo.chuyenMuc;
  }

  const soLuong = Math.min(thamSo.soLuong ?? SO_LUONG_MAC_DINH, SO_LUONG_TOI_DA);

  // TÌM Y HỆT TRANG WEB, kể cả trong lời thoại.
  //
  // ĐÃ VẤP THẬT (2026-08-16): bản trước chỉ tìm `title` và `description`, nên
  // gõ "chánh niệm" trên web ra **38 kết quả** còn qua API ra **0**. Cùng một
  // kho, hai câu trả lời khác hẳn nhau — và app Android chỉ nói chuyện qua API
  // nên nó sẽ mãi là bản kém hơn website, mà không ai nhận ra vì API vẫn trả
  // 200 kèm một danh sách rỗng trông rất bình thường.
  //
  // Danh sách các chỗ tìm phải khớp `timVaLoc.ts`. Bên đó có ghi kết quả đo:
  // 1.051 bản lời thoại, 23 MB, quét thẳng mất 150–330 ms nên không cần chỉ mục.
  const dieuKien = {
    OR: [
      { title: { contains: tuKhoa, mode: "insensitive" as const } },
      { description: { contains: tuKhoa, mode: "insensitive" as const } },
      { source: { title: { contains: tuKhoa, mode: "insensitive" as const } } },
      {
        classification: {
          titleVi: { contains: tuKhoa, mode: "insensitive" as const },
        },
      },
      {
        classification: {
          contentQualityNotes: {
            contains: tuKhoa,
            mode: "insensitive" as const,
          },
        },
      },
      { classification: { extractedTopics: { has: tuKhoa } } },
      {
        classification: {
          extractedAuthorNameRaw: {
            contains: tuKhoa,
            mode: "insensitive" as const,
          },
        },
      },
      {
        transcript: {
          rawText: { contains: tuKhoa, mode: "insensitive" as const },
        },
      },
      {
        narrationAsset: {
          scriptText: { contains: tuKhoa, mode: "insensitive" as const },
        },
      },
    ],
    ...(chuyenMuc ? { contentGroup: chuyenMuc } : {}),
    ...(thamSo.tuNgay ? { publishedAt: { gte: new Date(thamSo.tuNgay) } } : {}),
  } satisfies Prisma.ContentItemWhereInput;

  const [banGhi, tongSo] = await Promise.all([
    prisma.contentItem.findMany({
      where: dieuKien,
      include: QUAN_HE_CAN_LAY,
      // Điểm cao lên trước; chưa chấm điểm thì xét theo độ mới
      orderBy: [
        { score: { compositeScore: { sort: "desc", nulls: "last" } } },
        { publishedAt: { sort: "desc", nulls: "last" } },
      ],
      take: soLuong,
    }),
    prisma.contentItem.count({ where: dieuKien }),
  ]);

  const ketQua: MucKetQua[] = banGhi.map(doiSangMucKetQua);

  // Lấy toàn văn sau, và chỉ khi được yêu cầu — đây là phần nặng nhất của truy vấn
  if (thamSo.kemNoiDung) {
    const toanVan = await Promise.all(ketQua.map((m) => layToanVan(m.id)));
    ketQua.forEach((muc, i) => {
      if (toanVan[i]) muc.noiDung = toanVan[i] as string;
    });
  }

  return { ketQua, tongSo };
}

/** Lấy một mục theo id, kèm toàn văn */
export async function layNoiDungTheoId(id: string): Promise<MucKetQua> {
  const ban = await prisma.contentItem.findUnique({
    where: { id },
    include: QUAN_HE_CAN_LAY,
  });

  if (!ban) {
    throw new LoiTroLy("khong_tim_thay", `Không có nội dung nào với id '${id}'.`);
  }

  const muc = doiSangMucKetQua(ban);
  const toanVan = await layToanVan(id);
  if (toanVan) muc.noiDung = toanVan;

  return muc;
}
