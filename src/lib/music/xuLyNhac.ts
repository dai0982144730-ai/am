/**
 * Xử lý nhánh nhạc — hoàn toàn bằng luật, không cho mô hình đọc sâu.
 *
 * Đây là nguyên tắc số hai của bản thiết kế. Lý do rất thực tế: đánh giá một
 * bản nhạc bằng chữ là vô nghĩa. Lời thoại của nhạc chỉ là mấy chục ký tự lộn
 * xộn, còn hỏi mô hình "bản nhạc này hay không" thì nó chỉ đoán từ tiêu đề chứ
 * có nghe được đâu.
 *
 * Nên nhánh nhạc chỉ lấy những gì đọc được từ chữ có sẵn:
 *   - Số nhịp: đọc từ tiêu đề hoặc mô tả, KHÔNG BAO GIỜ đoán
 *   - Thể loại: đoán bằng luật từ khoá
 *   - Độ dài bản mix, mix liền mạch hay playlist ghép
 *
 * Nhờ vậy nhánh nhạc gần như không tốn gì, dù số lượng bản nhạc quét về có thể
 * rất lớn.
 */

import { prisma } from "@/lib/db/prisma";

import {
  doanTheLoai,
  docBpm,
  xepDaiBpm,
  xepDaiThoiLuong,
} from "./docBpm";

const HAN_GHI_MS = 60_000;
const HAN_CHO_MS = 30_000;

/** Dấu hiệu bản mix liền mạch, khác với playlist ghép nhiều bài rời. */
const DAU_HIEU_LIEN_MACH = [
  "nonstop",
  "non-stop",
  "continuous",
  "liền mạch",
  "không nghỉ",
  "seamless",
  "dj mix",
  "mixtape",
];

/** Dấu hiệu là playlist ghép nhiều bài. */
const DAU_HIEU_GHEP = [
  "playlist",
  "tuyển tập",
  "tổng hợp",
  "best of",
  "top ",
  "compilation",
  "album",
];

function laMixLienMach(tieuDe: string, moTa: string | null): boolean | null {
  const chu = `${tieuDe} ${moTa?.slice(0, 300) ?? ""}`.toLowerCase();

  if (DAU_HIEU_LIEN_MACH.some((tu) => chu.includes(tu))) return true;
  if (DAU_HIEU_GHEP.some((tu) => chu.includes(tu))) return false;
  return null;
}

export interface KetQuaXuLyNhac {
  daXet: number;
  daGhi: number;
  docDuocBpm: number;
  doanDuocTheLoai: number;
  khongRoTheLoai: number;
}

/**
 * Chấm và điền thông tin cho các video nhạc trong kho.
 *
 * Chỉ chạy với video Claude đã xếp vào nhóm nhạc. Việc nhận diện sớm ở
 * `nhanDienNhac.ts` chỉ để bỏ qua bước lấy lời thoại, không thay Claude quyết
 * định chuyên mục.
 */
export async function xuLyNhacHangLoat(
  gioiHan = 100,
  bao?: (dong: string) => void,
): Promise<KetQuaXuLyNhac> {
  const cacBan = await prisma.contentItem.findMany({
    where: { contentGroup: "music" },
    take: gioiHan,
    select: {
      id: true,
      title: true,
      description: true,
      durationSeconds: true,
      source: { select: { title: true } },
      classification: { select: { id: true } },
    },
  });

  let daGhi = 0;
  let docDuocBpm = 0;
  let doanDuocTheLoai = 0;
  let khongRoTheLoai = 0;

  for (const ban of cacBan) {
    const nhip = docBpm(ban.title, ban.description);
    const theLoai = doanTheLoai(ban.title, ban.source.title);
    const lienMach = laMixLienMach(ban.title, ban.description);

    if (nhip.bpm !== null) docDuocBpm += 1;
    if (theLoai) doanDuocTheLoai += 1;
    else khongRoTheLoai += 1;

    const duLieu = {
      musicGenre: theLoai,
      bpm: nhip.bpm,
      bpmBucket: xepDaiBpm(nhip.bpm),
      bpmConfidence: nhip.doTinCay,
      // Chỉ nhạc tập luyện mới khống chế thời lượng — piano hay nhạc vàng thì
      // ngắn dài đều được, khống chế chỉ làm rối bộ lọc
      mixLengthBucket:
        theLoai === "workout_bpm"
          ? xepDaiThoiLuong(ban.durationSeconds)
          : null,
      isContinuousMix: lienMach,
    };

    if (ban.classification) {
      await prisma.contentClassification.update({
        where: { contentItemId: ban.id },
        data: duLieu,
      });
    } else {
      await prisma.$transaction(
        [
          prisma.contentClassification.create({
            data: { contentItemId: ban.id, ...duLieu, promptVersion: "luat-v1" },
          }),
          prisma.contentItem.update({
            where: { id: ban.id },
            data: { status: "classified", narrationType: "instrumental" },
          }),
        ],
        { timeout: HAN_GHI_MS, maxWait: HAN_CHO_MS },
      );
    }

    daGhi += 1;

    const phan = [
      theLoai ?? "chưa rõ thể loại",
      nhip.bpm ? `${nhip.bpm} nhịp (${nhip.doTinCay})` : null,
      lienMach === true ? "mix liền mạch" : lienMach === false ? "playlist ghép" : null,
    ].filter(Boolean);

    bao?.(`  ${ban.title.slice(0, 46)}\n      ${phan.join(" · ")}`);
  }

  return {
    daXet: cacBan.length,
    daGhi,
    docDuocBpm,
    doanDuocTheLoai,
    khongRoTheLoai,
  };
}
