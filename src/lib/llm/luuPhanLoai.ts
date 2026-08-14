/**
 * Chạy phân loại cho các nội dung đang chờ trong kho, rồi lưu kết quả.
 *
 * Đây là lớp dịch giữa hai thế giới: khung trả lời của Claude đặt tên tiếng Việt
 * (`nhom`, `theLoaiTruyen`…), còn database dùng tiếng Anh (`contentGroup`,
 * `storyGenre`…). Mọi việc quy đổi gom hết vào đây, không rải rác khắp nơi.
 */

import type {
  AiSubtopic,
  BpmConfidence,
  ContentGroup,
  ListenerLevel,
  MusicGenre,
  NarrationType,
  PhilosophyContentForm,
  PhilosophySchool,
  StoryGenre,
  StoryIntensity,
  StoryOrigin,
} from "@/generated/prisma/enums";
import { prisma } from "@/lib/db/prisma";

import type { KetQuaPhanLoai } from "./khungPhanLoai";
import {
  phanLoaiMotNoiDung,
  PHIEN_BAN_HUONG_DAN,
  type NoiDungCanPhanLoai,
} from "./phanLoai";

/** Nghỉ giữa hai lần gọi, tránh chạm giới hạn tần suất của Anthropic. */
const NGHI_GIUA_HAI_LAN_MS = 300;

/**
 * Xếp số nhịp vào dải 5 nhịp, chỉ trong khoảng 140–180 mà người dùng quan tâm.
 *
 * Ngoài khoảng đó trả `null`: một bản nhạc 90 nhịp không dùng để chạy bộ được,
 * xếp dải cho nó chỉ làm rối bộ lọc.
 */
export function xepDaiBpm(bpm: number | null): string | null {
  if (bpm === null || bpm < 140 || bpm >= 180) return null;
  const dau = Math.floor(bpm / 5) * 5;
  return `${dau}-${dau + 5}`;
}

/** Xếp độ dài bản mix vào nhóm, chỉ áp dụng cho nhạc tập thể thao. */
export function xepDaiThoiLuong(giay: number | null): string | null {
  if (giay === null) return null;
  if (giay > 3600) return ">1h";
  if (giay > 2400) return ">40ph";
  if (giay > 1200) return ">20ph";
  return null;
}

/** Đổi kết quả Claude trả về thành đúng các trường của bảng database. */
function dichSangDatabase(kq: KetQuaPhanLoai, thoiLuongGiay: number | null) {
  const laNhac = kq.nhom === "music";
  const laWorkout = laNhac && kq.theLoaiNhac === "workout_bpm";

  return {
    extractedTopics: kq.chuDe,
    extractedAuthorNameRaw: kq.tenTacGiaThoNhat,
    authorCreditedInDescription: kq.tacGiaDuocGhiTrongMoTa,
    contentQualityNotes: kq.nhanXetChatLuong,

    aiSubtopic: (kq.aiChuDeCon as AiSubtopic | null) ?? null,

    philosophySchool: (kq.truongPhai as PhilosophySchool | null) ?? null,
    philosophyContentForm:
      (kq.dangTrinhBay as PhilosophyContentForm | null) ?? null,
    listenerLevel: (kq.mucDoNguoiNghe as ListenerLevel | null) ?? null,
    misleadingContentFlag: kq.coDauHieuMeTin,

    storyGenre: (kq.theLoaiTruyen as StoryGenre | null) ?? null,
    storyOrigin: (kq.xuatXuTruyen as StoryOrigin | null) ?? null,
    storyIntensity: (kq.doCangThang as StoryIntensity | null) ?? null,
    basedOnTrueStory: kq.duaTrenChuyenThat,
    aiGeneratedSuspicionScore: kq.nghiNgoDoAiViet,

    musicGenre: (kq.theLoaiNhac as MusicGenre | null) ?? null,
    bpm: kq.bpm,
    bpmBucket: xepDaiBpm(kq.bpm),
    bpmConfidence: (kq.doTinCayBpm as BpmConfidence | null) ?? null,
    // Chỉ nhạc tập thể thao mới khống chế thời lượng — piano hay nhạc vàng
    // ngắn dài đều được
    mixLengthBucket: laWorkout ? xepDaiThoiLuong(thoiLuongGiay) : null,
    isContinuousMix: kq.laMixLienMach,

    promptVersion: PHIEN_BAN_HUONG_DAN,
  };
}

export interface KetQuaPhanLoaiHangLoat {
  daXet: number;
  thanhCong: number;
  loi: number;
  tongTokenVao: number;
  tongTokenRa: number;
  tongTokenNhoLai: number;
  theoNhom: Record<string, number>;
}

function nghi(ms: number): Promise<void> {
  return new Promise((xong) => setTimeout(xong, ms));
}

/**
 * Phân loại các nội dung đang chờ.
 *
 * Lấy cả video đã có lời thoại lẫn video không lấy được lời thoại — với video
 * không có lời thoại thì tiêu đề và mô tả cũng đủ để xếp nhóm, và bỏ hẳn chúng
 * ra ngoài kho sẽ làm mất nội dung tốt chỉ vì kênh không bật phụ đề.
 */
export async function phanLoaiHangLoat(
  gioiHan = 50,
  bao?: (dong: string) => void,
): Promise<KetQuaPhanLoaiHangLoat> {
  const cacMuc = await prisma.contentItem.findMany({
    where: {
      status: { in: ["pending_classification", "transcript_unavailable"] },
      classification: null,
    },
    orderBy: { publishedAt: "desc" },
    take: gioiHan,
    include: {
      source: { select: { title: true } },
      transcript: { select: { rawText: true, fetchStatus: true } },
    },
  });

  const theoNhom: Record<string, number> = {};
  let thanhCong = 0;
  let loi = 0;
  let tongTokenVao = 0;
  let tongTokenRa = 0;
  let tongTokenNhoLai = 0;

  for (const [thuTu, muc] of cacMuc.entries()) {
    if (thuTu > 0) await nghi(NGHI_GIUA_HAI_LAN_MS);

    const noiDung: NoiDungCanPhanLoai = {
      tieuDe: muc.title,
      moTa: muc.description,
      tenKenh: muc.source.title,
      thoiLuongGiay: muc.durationSeconds,
      loiThoai:
        muc.transcript?.fetchStatus === "success"
          ? muc.transcript.rawText
          : null,
    };

    try {
      const goi = await phanLoaiMotNoiDung(noiDung);
      const kq = goi.ketQua;

      await prisma.$transaction([
        prisma.contentClassification.create({
          data: {
            contentItemId: muc.id,
            modelUsed: goi.modelDaDung,
            ...dichSangDatabase(kq, muc.durationSeconds),
          },
        }),
        prisma.contentItem.update({
          where: { id: muc.id },
          data: {
            contentGroup: kq.nhom as ContentGroup,
            narrationType: kq.loaiGiongDoc as NarrationType,
            status: "classified",
          },
        }),
      ]);

      thanhCong += 1;
      theoNhom[kq.nhom] = (theoNhom[kq.nhom] ?? 0) + 1;
      tongTokenVao += goi.tokenVao;
      tongTokenRa += goi.tokenRa;
      tongTokenNhoLai += goi.tokenNhoLai;

      bao?.(`  ${kq.nhom.padEnd(10)} ${muc.title.slice(0, 48)}`);
    } catch (e) {
      loi += 1;
      bao?.(
        `  ✗ ${muc.title.slice(0, 40)} — ${e instanceof Error ? e.message : e}`,
      );
    }
  }

  return {
    daXet: cacMuc.length,
    thanhCong,
    loi,
    tongTokenVao,
    tongTokenRa,
    tongTokenNhoLai,
    theoNhom,
  };
}
