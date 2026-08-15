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
  type CachGoi,
  type NoiDungCanPhanLoai,
} from "./phanLoai";

/** Nghỉ giữa hai lần gọi, tránh chạm giới hạn tần suất của Anthropic. */
const NGHI_GIUA_HAI_LAN_MS = 300;

/**
 * Thời gian tối đa cho một lượt ghi vào database. Mặc định 5 giây của Prisma
 * là quá ngắn khi database nằm trên mạng — đã vấp ở bước lấy lời thoại.
 */
const HAN_GHI_MS = 60_000;

/**
 * Thời gian tối đa chờ để BẮT ĐẦU một lượt ghi — khác với hạn chạy ở trên.
 * Prisma mặc định chỉ chờ 2 giây rồi bỏ cuộc với lỗi "Unable to start a
 * transaction in the given time". Khi database ở xa và đang bận, ngần đó không
 * đủ. Đã vấp thật lúc phân loại hàng loạt.
 */
const HAN_CHO_MS = 30_000;

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
    titleVi: kq.tieuDeTiengViet,
    contentQualityNotes: kq.nhanXetChatLuong,
    contentQualityScore: kq.diemChatLuong,

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
  /** Đã gọi qua đường nào — để biết có tốn tiền theo chữ hay không */
  cachGoi: CachGoi | null;
}

function nghi(ms: number): Promise<void> {
  return new Promise((xong) => setTimeout(xong, ms));
}

/**
 * Chạy một lượt ghi; hỏng vì đứt kết nối thì thử lại.
 *
 * Neon là database "tự ngủ khi rảnh", nên thỉnh thoảng cắt ngang kết nối đang
 * nhàn rỗi — đã vấp thật: một mẻ 30 video chết ngay từ lệnh đếm đầu tiên với
 * `Connection terminated unexpectedly`, chạy lại ngay sau đó thì trôi. Việc này
 * chạy hàng giờ nên phải chịu được, không thể để cả mẻ hỏng vì mạng chớp một
 * cái.
 */
async function ghiCoThuLai<T>(viec: () => Promise<T>): Promise<T> {
  const LOI_DUT_KET_NOI =
    /Connection terminated|ECONNRESET|socket hang up|terminated unexpectedly|Closed/i;

  for (let lan = 0; ; lan += 1) {
    try {
      return await viec();
    } catch (e) {
      const thongDiep = e instanceof Error ? e.message : String(e);
      if (lan >= 2 || !LOI_DUT_KET_NOI.test(thongDiep)) throw e;
      // Chờ tăng dần rồi thử lại: 2 giây, rồi 5 giây
      await nghi(lan === 0 ? 2_000 : 5_000);
    }
  }
}

/**
 * Từ khoá của những video *có triển vọng* thuộc bốn chuyên mục chính.
 *
 * Chỉ là bộ lọc thô ở bước chọn việc, không phải bộ phân loại — Claude vẫn là
 * người quyết định cuối cùng, và vẫn thường xếp nhiều video trong số này vào
 * nhóm "khác". Cái nó tiết kiệm là công đọc: phần lớn nội dung quét về hằng
 * ngày là tin thời sự và giải trí, đọc hết cũng chỉ ra "khác".
 */
const TU_KHOA_TRIEN_VONG = [
  // Triết học, tâm lý, Phật giáo
  "thầy", "sư ", "pháp", "thiền", "phật", "kinh ", "tâm lý", "triết",
  "khắc kỷ", "stoic", "hiện sinh", "giảng", "vấn đáp", "buông",
  // AI
  "AI", "Claude", "ChatGPT", "Gemini", "trí tuệ nhân tạo", "chatbot",
  "lập trình", "code", "prompt", "agent",
  // Truyện
  "truyện", "kể chuyện", "kinh dị", "ma ", "quỷ", "linh hồn", "bí ẩn",
  "viễn tưởng", "phiêu lưu", "tập ",
  // Nhạc
  "nhạc", "BPM", "mix", "playlist", "piano", "guitar", "lofi", "remix",
  "bolero", "acoustic",
];

/**
 * Phân loại các nội dung đang chờ.
 *
 * Lấy cả video đã có lời thoại lẫn video không lấy được lời thoại — với video
 * không có lời thoại thì tiêu đề và mô tả cũng đủ để xếp nhóm, và bỏ hẳn chúng
 * ra ngoài kho sẽ làm mất nội dung tốt chỉ vì kênh không bật phụ đề.
 *
 * @param chiLayCoTrienVong Chỉ xét video có từ khoá gợi ý thuộc bốn chuyên mục
 *   chính. Dùng khi muốn nhanh chóng có đủ dữ liệu mỗi nhóm để dựng giao diện,
 *   thay vì đọc tuần tự cả kho mà phần lớn là tin thời sự.
 */
export async function phanLoaiHangLoat(
  gioiHan = 50,
  bao?: (dong: string) => void,
  chiLayCoTrienVong = false,
  chiLayBaiViet = false,
): Promise<KetQuaPhanLoaiHangLoat> {
  const cacMuc = await prisma.contentItem.findMany({
    where: {
      status: { in: ["pending_classification", "transcript_unavailable"] },
      classification: null,
      ...(chiLayBaiViet
        ? { type: { in: ["blog_article" as const, "forum_post" as const] } }
        : {}),
      ...(chiLayCoTrienVong
        ? {
            OR: TU_KHOA_TRIEN_VONG.map((tu) => ({
              title: { contains: tu, mode: "insensitive" as const },
            })),
          }
        : {}),
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
  let cachGoi: CachGoi | null = null;

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

      await ghiCoThuLai(() =>
        prisma.$transaction(
        [
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
              // Claude đọc nội dung nên biết chắc hơn siêu dữ liệu của
              // YouTube, vốn để trống ở phần lớn video
              originalLanguage: kq.ngonNguNoiDung === "vi" ? "vi" : "khac",
              status: "classified",
            },
          }),
        ],
        { timeout: HAN_GHI_MS, maxWait: HAN_CHO_MS },
        ),
      );

      thanhCong += 1;
      cachGoi = goi.cachGoi;
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
    cachGoi,
  };
}
