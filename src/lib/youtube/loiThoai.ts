/**
 * Lấy lời thoại (phụ đề) của video YouTube.
 *
 * YouTube **không có cách chính thức** để đọc lời thoại video của người khác —
 * lệnh `captions.download` trong API chính thức chỉ chạy với video do chính mình
 * đăng. Nên chỗ này buộc phải dùng thư viện ngoài, và phải chấp nhận rằng nó có
 * thể gãy bất cứ lúc nào khi YouTube đổi API ngầm.
 *
 * Vì vậy có ba nguyên tắc:
 *
 *   1. **Lưu vĩnh viễn.** Đã lấy được một lần thì không bao giờ lấy lại. Lời
 *      thoại không đổi theo thời gian, mà mỗi lần gọi lại là thêm một lần rủi ro
 *      bị YouTube chặn.
 *   2. **Gọi thưa.** Nghỉ giữa các video, không bắn hàng loạt.
 *   3. **Hỏng thì đi tiếp.** Video không có phụ đề là chuyện rất thường. Đánh
 *      dấu rồi bỏ qua, tuyệt đối không để chết cả mẻ.
 *
 * *Ghi chú lịch sử*: `docs/plan.md` ban đầu định dùng `youtubei.js` làm chính.
 * Tới lúc làm thật (2026-08-14) thì thư viện đó không lấy được lời thoại nữa —
 * YouTube đã chặn endpoint `get_transcript` với mọi loại client. `youtube-transcript`
 * thì vẫn chạy, nên đổi thành thư viện chính.
 */

import { YoutubeTranscript } from "youtube-transcript";

import { prisma } from "@/lib/db/prisma";

/** Nghỉ giữa hai lần gọi, tính bằng mili giây. */
const NGHI_GIUA_HAI_LAN_MS = 1_200;

/**
 * Thời gian tối đa cho một lượt ghi vào database.
 *
 * Mặc định của Prisma là 5 giây, và đã vấp thật: ghi một bản lời thoại 74.000
 * ký tự lên Neon (database đặt trên mạng, không phải máy này) mất hơn 8 giây.
 * Nới rộng hẳn ra, vì đây là lượt ghi hiếm chứ không phải việc chạy liên tục.
 */
const HAN_GHI_MS = 60_000;

/**
 * Thời gian tối đa chờ để BẮT ĐẦU một lượt ghi — khác với hạn chạy ở trên.
 * Prisma mặc định chỉ chờ 2 giây rồi bỏ cuộc.
 */
const HAN_CHO_MS = 30_000;

/**
 * Video dài quá thì lời thoại rất lớn (một video 2,5 tiếng cho ra ~127.000 ký
 * tự). Vẫn lưu đủ, nhưng cắt ở mức này để một video hỏng định dạng không làm
 * phình database vô hạn.
 */
const TOI_DA_KY_TU = 500_000;

interface DoanLoiThoai {
  text: string;
  /** Mốc bắt đầu, tính bằng mili giây */
  offset: number;
  duration: number;
  lang?: string;
}

export interface KetQuaLoiThoai {
  rawText: string;
  /** Mảng {start, text} để sau này nhảy đúng phút trong video */
  segments: { start: number; text: string }[];
  language: string | null;
  soDoan: number;
}

function nghi(ms: number): Promise<void> {
  return new Promise((xong) => setTimeout(xong, ms));
}

/**
 * Lấy lời thoại một video.
 *
 * Thử theo ngôn ngữ gốc của video trước; không được thì để thư viện tự chọn
 * bản phụ đề nào có. Trả `null` khi video không có phụ đề nào.
 */
export async function layLoiThoai(
  idVideo: string,
  ngonNguGoc?: string | null,
): Promise<KetQuaLoiThoai | null> {
  // Mã ngôn ngữ của YouTube đôi khi có đuôi vùng ("en-US"), phụ đề thì thường
  // đặt theo mã gọn ("en") — cắt đuôi trước khi hỏi.
  const maGon = ngonNguGoc?.split("-")[0];

  const cachThu: (Record<string, string> | undefined)[] = maGon
    ? [{ lang: maGon }, undefined]
    : [undefined];

  for (const tuyChon of cachThu) {
    try {
      const cacDoan = (await YoutubeTranscript.fetchTranscript(
        idVideo,
        tuyChon,
      )) as DoanLoiThoai[];

      if (cacDoan.length === 0) continue;

      const segments = cacDoan.map((doan) => ({
        start: Math.round(doan.offset / 1000),
        text: doan.text,
      }));

      const rawText = cacDoan
        .map((doan) => doan.text)
        .join(" ")
        .slice(0, TOI_DA_KY_TU);

      return {
        rawText,
        segments,
        language: cacDoan[0]?.lang ?? maGon ?? null,
        soDoan: cacDoan.length,
      };
    } catch {
      // Thử cách tiếp theo. Lỗi ở lần cuối cùng nghĩa là video không có phụ đề.
    }
  }

  return null;
}

export interface KetQuaLayHangLoat {
  daXet: number;
  layDuoc: number;
  khongCoPhuDe: number;
  tongKyTu: number;
}

/**
 * Lấy lời thoại cho các video đang chờ trong kho.
 *
 * Bỏ qua video đã có lời thoại (kể cả bản đã đánh dấu thất bại) — thử lại chỉ
 * tốn thời gian và tăng rủi ro bị chặn, trong khi video không có phụ đề thì mãi
 * mãi vẫn không có.
 *
 * @param gioiHan Số video xử lý trong một lần chạy
 */
export async function layLoiThoaiHangLoat(
  gioiHan = 50,
  bao?: (dong: string) => void,
): Promise<KetQuaLayHangLoat> {
  const cacVideo = await prisma.contentItem.findMany({
    where: {
      type: "video",
      transcript: null,
      status: "pending_transcript",
      // Video chỉ có mặt để xem trong playlist thì không lấy lời thoại —
      // không ai đọc tới, lấy về chỉ tốn công và phình database.
      chiTrongPlaylist: false,
      // Nhạc đi nhánh riêng, không lấy lời thoại — đánh giá nhạc bằng chữ là
      // vô nghĩa. Ở bước này chưa phân loại nên chưa lọc được nhóm nhạc, nhưng
      // giữ điều kiện sẵn để khi Claude phân loại xong là tự đúng.
      contentGroup: { not: "music" },
    },
    orderBy: { publishedAt: "desc" },
    take: gioiHan,
    select: {
      id: true,
      externalId: true,
      title: true,
      originalLanguage: true,
    },
  });

  let layDuoc = 0;
  let khongCoPhuDe = 0;
  let tongKyTu = 0;

  for (const [thuTu, video] of cacVideo.entries()) {
    if (thuTu > 0) await nghi(NGHI_GIUA_HAI_LAN_MS);

    const ketQua = await layLoiThoai(video.externalId, video.originalLanguage);

    if (ketQua) {
      await prisma.$transaction(
        [
          prisma.transcript.create({
            data: {
              contentItemId: video.id,
              source: "unofficial_scrape",
              language: ketQua.language,
              rawText: ketQua.rawText,
              segments: ketQua.segments,
              fetchStatus: "success",
            },
          }),
          prisma.contentItem.update({
            where: { id: video.id },
            data: { status: "pending_classification" },
          }),
        ],
        { timeout: HAN_GHI_MS, maxWait: HAN_CHO_MS },
      );

      layDuoc += 1;
      tongKyTu += ketQua.rawText.length;
      bao?.(
        `  ✓ ${video.title.slice(0, 45)} — ${ketQua.soDoan} đoạn, ${ketQua.rawText.length} ký tự`,
      );
    } else {
      // Ghi lại cả lần thất bại, để lần chạy sau không thử lại video này nữa
      await prisma.$transaction(
        [
          prisma.transcript.create({
            data: {
              contentItemId: video.id,
              source: "unofficial_scrape",
              rawText: "",
              fetchStatus: "failed",
            },
          }),
          prisma.contentItem.update({
            where: { id: video.id },
            data: { status: "transcript_unavailable" },
          }),
        ],
        { timeout: HAN_GHI_MS, maxWait: HAN_CHO_MS },
      );

      khongCoPhuDe += 1;
      bao?.(`  – ${video.title.slice(0, 45)} — không có phụ đề`);
    }
  }

  return {
    daXet: cacVideo.length,
    layDuoc,
    khongCoPhuDe,
    tongKyTu,
  };
}

/** Đếm tình hình lời thoại trong kho. */
export async function demTinhHinh(): Promise<Record<string, number>> {
  const nhom = await prisma.contentItem.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  return Object.fromEntries(nhom.map((n) => [n.status, n._count._all]));
}
