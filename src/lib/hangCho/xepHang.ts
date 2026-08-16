/**
 * Hàng chờ — "tôi có 20 phút" thì xếp cho vừa khít 20 phút.
 *
 * ## Vì sao đây là tính năng riêng chứ không phải một kiểu sắp xếp
 *
 * Danh sách xếp theo điểm trả lời câu "cái nào hay nhất". Nhưng người đang lái
 * xe về nhà không hỏi câu đó — họ hỏi "từ giờ tới lúc về, nghe hết được cái
 * gì". Hai câu khác nhau và câu sau không giải bằng cách sắp xếp: bài hay nhất
 * dài 2 tiếng thì với 20 phút nó là câu trả lời sai, dù điểm cao nhất.
 *
 * ## Thuật toán: tham lam theo điểm, rồi vá phần thừa
 *
 * Xếp balô kiểu chuẩn (quy hoạch động) cho ra kết quả khít nhất về mặt toán
 * học, nhưng khít nhất **không phải** thứ cần: nó sẵn sàng bỏ bài 9 điểm để
 * nhét hai bài 5 điểm chỉ vì cộng lại vừa hơn 40 giây. Người nghe thấy ngay là
 * hàng chờ dở đi.
 *
 * Nên làm ngược lại: **ưu tiên bài hay, chỉ dùng độ khít để chọn giữa những bài
 * hay ngang nhau**. Đi từ trên xuống, bài nào còn nhét vừa thì nhét; hết lượt
 * mà vẫn thừa nhiều thì quét thêm một vòng tìm bài ngắn lấp vào. Kết quả hơi
 * lệch vài phút nhưng toàn bài đáng nghe — đúng thứ tự ưu tiên của người thật.
 *
 * ## Hàng chờ nhạc thì xếp theo nhịp, không theo điểm
 *
 * Nhạc tập thể thao có yêu cầu ngược hẳn: **nhịp phải liền mạch**. Nhảy từ 145
 * sang 175 rồi về 150 là hỏng buổi tập, dù cả ba bài đều hay. Nên nhánh nhạc
 * bỏ qua điểm và xếp theo đường cong khởi động → cao trào → giãn cơ.
 */

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { chuaLuotQua } from "@/lib/lichSu/loc";
import { TOI_THIEU_GIAY } from "@/lib/nghiepVu/timVaLoc";

/** Các mốc thời gian bấm được. Phút. */
export const CAC_MOC_PHUT = [15, 30, 45, 60, 90] as const;
export type MocPhut = (typeof CAC_MOC_PHUT)[number];

/**
 * Cho phép vượt quá ngân sách bao nhiêu.
 *
 * Bằng 0 thì hàng chờ luôn hụt: bài cuối gần như không bao giờ dài đúng bằng
 * phần thời gian còn lại, nên "20 phút" hay thành 14 phút. Chừa 10% thì bài
 * cuối được phép tràn một chút, và người nghe hoặc nghe nốt hoặc tắt giữa
 * chừng — cả hai đều tốt hơn là ngồi không 6 phút.
 */
const CHO_TRAN = 0.1;

/** Phần thừa còn dưới mức này thì coi như đã khít, không quét thêm nữa. */
const COI_NHU_KHIT_GIAY = 120;

/** Không lôi cả nghìn bản ghi về để xếp — bấy nhiêu là thừa sức lấp 90 phút. */
const SO_UNG_VIEN = 200;

export type CheDoNghe = "tat_ca" | "chi_nghe";

export interface MucHangCho {
  id: string;
  tieuDe: string;
  anh: string | null;
  thoiLuong: number;
  tenNguon: string;
  nhom: string;
  diem: number | null;
  /** File âm thanh phát thẳng được — podcast gốc hoặc bản đọc tiếng Việt */
  amThanh: string | null;
  /** Bản đọc tiếng Việt (khác podcast giọng người thật) */
  laBanDoc: boolean;
  bpm: number | null;
}

export interface HangCho {
  cacMuc: MucHangCho[];
  tongGiay: number;
  nganSachGiay: number;
  /** Thiếu bao nhiêu so với ngân sách. Âm nghĩa là tràn */
  thieuGiay: number;
}

/** Nội dung lấy về để xếp — đủ dựng thẻ, không hơn. */
const CHON_UNG_VIEN = {
  id: true,
  title: true,
  thumbnailUrl: true,
  durationSeconds: true,
  audioUrl: true,
  contentGroup: true,
  source: { select: { title: true } },
  score: { select: { compositeScore: true } },
  classification: { select: { titleVi: true, bpm: true } },
  narrationAsset: { select: { ttsAudioUrl: true, durationSeconds: true } },
} satisfies Prisma.ContentItemSelect;

type UngVien = Prisma.ContentItemGetPayload<{ select: typeof CHON_UNG_VIEN }>;

/**
 * Điều kiện "chỉ nghe": phải có file âm thanh phát thẳng được.
 *
 * KHÔNG gồm video YouTube. Nghe video YouTube mà tắt màn hình thì trình duyệt
 * dừng phát — đó là cách YouTube muốn, và app không lách. Nên chế độ chỉ nghe
 * chỉ nhận podcast (file gốc của nhà làm podcast) và bài đã có bản đọc tiếng
 * Việt.
 */
function dieuKienChiNghe(): Prisma.ContentItemWhereInput {
  return {
    OR: [
      { audioUrl: { not: null } },
      { narrationAsset: { ttsAudioUrl: { not: null } } },
    ],
  };
}

/**
 * Đủ dài để xếp vào hàng chờ — theo đúng luật 5 phút của trang Khám phá.
 *
 * Hai đường vào, và đường thứ hai mới là chỗ dễ làm sai:
 *
 *   1. Clip gốc dài từ 5 phút trở lên.
 *   2. **Bài blog có bản đọc tiếng Việt dài từ 5 phút.** Bài viết không có
 *      `durationSeconds` — chỉ hỏi cột đó thì toàn bộ blog bị loại, mà blog đã
 *      có mp3 lại chính là thứ hợp với chế độ chỉ nghe nhất. Đã vấp thật: bản
 *      đầu chỉ hỏi `durationSeconds` và hàng chờ "chỉ nghe" 60 phút chỉ ra 3
 *      bài, trong khi kho có 29 bản đọc.
 *
 * Không có nhánh `durationSeconds: null` chung chung: cả bài toán ở đây là cộng
 * thời lượng lại cho vừa ngân sách, nên thứ không đo được bằng cách nào thì
 * không xếp vào được.
 */
function dieuKienDuThoiLuong(): Prisma.ContentItemWhereInput {
  return {
    OR: [
      { durationSeconds: { gte: TOI_THIEU_GIAY } },
      { narrationAsset: { durationSeconds: { gte: TOI_THIEU_GIAY } } },
    ],
  };
}

function doiSangMuc(u: UngVien): MucHangCho {
  const amThanh = u.narrationAsset?.ttsAudioUrl ?? u.audioUrl ?? null;
  return {
    id: u.id,
    tieuDe: u.classification?.titleVi ?? u.title,
    anh: u.thumbnailUrl,
    // Bản đọc tiếng Việt dài ngắn khác hẳn bản gốc — lấy đúng con số sẽ phát
    thoiLuong:
      u.narrationAsset?.ttsAudioUrl && u.narrationAsset.durationSeconds
        ? u.narrationAsset.durationSeconds
        : (u.durationSeconds ?? 0),
    tenNguon: u.source.title,
    nhom: u.contentGroup,
    diem: u.score?.compositeScore ?? null,
    amThanh,
    laBanDoc: Boolean(u.narrationAsset?.ttsAudioUrl),
    bpm: u.classification?.bpm ?? null,
  };
}

/**
 * Xếp hàng chờ cho một khoảng thời gian.
 *
 * @param phut Có bấy nhiêu phút
 * @param nhom Giới hạn trong một chuyên mục. Bỏ trống thì lấy mọi chuyên mục
 * @param cheDo `chi_nghe` thì chỉ lấy thứ phát được bằng tai
 */
export async function xepHangTheoThoiGian(
  phut: number,
  nhom?: string,
  cheDo: CheDoNghe = "tat_ca",
): Promise<HangCho> {
  const nganSachGiay = phut * 60;

  const cacUngVien = await prisma.contentItem.findMany({
    where: chuaLuotQua({
      status: "classified",
      ...(nhom ? { contentGroup: nhom as never } : {}),
      // GÓI VÀO `AND`, KHÔNG TRẢI RA. Cả hai điều kiện dưới đây đều trả về một
      // `OR`; trải thẳng vào cùng một object thì cái sau đè mất cái trước và
      // một trong hai bộ lọc âm thầm biến mất — đúng cái bẫy đã ghi trong
      // `lichSu/loc.ts`.
      AND: [
        dieuKienDuThoiLuong(),
        ...(cheDo === "chi_nghe" ? [dieuKienChiNghe()] : []),
      ],
    }),
    select: CHON_UNG_VIEN,
    orderBy: [
      { score: { compositeScore: { sort: "desc", nulls: "last" } } },
      { publishedAt: { sort: "desc", nulls: "last" } },
    ],
    take: SO_UNG_VIEN,
  });

  const cacMuc = cacUngVien.map(doiSangMuc).filter((m) => m.thoiLuong > 0);
  return lapDayNganSach(cacMuc, nganSachGiay);
}

/**
 * Nhét cho đầy ngân sách, ưu tiên thứ tự đã sắp sẵn (tức là theo điểm).
 *
 * Hai vòng: vòng một đi từ trên xuống nhét mọi thứ còn vừa; nếu vẫn thừa nhiều
 * thì vòng hai tìm bài ngắn nhất còn lại mà lấp được, lặp tới khi hết chỗ hoặc
 * hết bài.
 */
function lapDayNganSach(cacMuc: MucHangCho[], nganSachGiay: number): HangCho {
  const tran = Math.round(nganSachGiay * (1 + CHO_TRAN));
  const daChon: MucHangCho[] = [];
  const conLai: MucHangCho[] = [];
  let tong = 0;

  for (const m of cacMuc) {
    if (tong + m.thoiLuong <= tran) {
      daChon.push(m);
      tong += m.thoiLuong;
    } else {
      conLai.push(m);
    }
  }

  // Vòng hai: còn thừa nhiều thì lấp bằng bài ngắn nhất vừa chỗ trống
  conLai.sort((a, b) => a.thoiLuong - b.thoiLuong);
  while (nganSachGiay - tong > COI_NHU_KHIT_GIAY) {
    const i = conLai.findIndex((m) => tong + m.thoiLuong <= tran);
    if (i === -1) break;
    const [them] = conLai.splice(i, 1);
    daChon.push(them);
    tong += them.thoiLuong;
  }

  return {
    cacMuc: daChon,
    tongGiay: tong,
    nganSachGiay,
    thieuGiay: nganSachGiay - tong,
  };
}

/**
 * Hàng chờ nhạc tập theo nhịp: khởi động → cao trào → giãn cơ.
 *
 * VÌ SAO KHÔNG XẾP TĂNG DẦN TỪ ĐẦU TỚI CUỐI: buổi tập không kết thúc ở lúc mệt
 * nhất. Tăng dần rồi dừng phắt ở 180 nhịp là bỏ mất đoạn hạ nhiệt, mà đoạn đó
 * mới là lúc người ta cần nhạc chậm lại để thở. Nên nửa đầu tăng, nửa sau giảm.
 *
 * Bài **không ghi rõ nhịp thì không lọt vào đây** — đúng nguyên tắc trong bản
 * thiết kế: thà để trống còn hơn gắn nhịp đoán mò làm hỏng buổi tập.
 */
export async function xepHangTheoNhip(
  phut: number,
  bpmTu: number,
  bpmDen: number,
): Promise<HangCho> {
  const nganSachGiay = phut * 60;

  const cacUngVien = await prisma.contentItem.findMany({
    where: chuaLuotQua({
      status: "classified",
      contentGroup: "music",
      durationSeconds: { gte: TOI_THIEU_GIAY },
      classification: {
        bpm: { gte: bpmTu, lte: bpmDen },
        // Chỉ nhận nhịp ghi rõ trong tiêu đề hoặc mô tả. `inferred` là đoán,
        // và đoán sai một bài là cả buổi tập lệch nhịp
        bpmConfidence: { in: ["stated_in_title", "stated_in_description"] },
      },
    }),
    select: CHON_UNG_VIEN,
    orderBy: [{ score: { compositeScore: { sort: "desc", nulls: "last" } } }],
    take: SO_UNG_VIEN,
  });

  const cacMuc = cacUngVien
    .map(doiSangMuc)
    .filter((m) => m.thoiLuong > 0 && m.bpm !== null);

  const daChon = lapDayNganSach(cacMuc, nganSachGiay);
  return { ...daChon, cacMuc: xepDuongCongNhip(daChon.cacMuc) };
}

/** Nửa đầu nhịp tăng dần, nửa sau nhịp giảm dần. */
function xepDuongCongNhip(cacMuc: MucHangCho[]): MucHangCho[] {
  const theoNhip = [...cacMuc].sort((a, b) => (a.bpm ?? 0) - (b.bpm ?? 0));
  const len: MucHangCho[] = [];
  const xuong: MucHangCho[] = [];

  // Chia đôi theo kiểu xen kẽ để cả hai nhánh đều trải hết dải nhịp, thay vì
  // nhánh lên toàn bài chậm còn nhánh xuống toàn bài nhanh
  theoNhip.forEach((m, i) => (i % 2 === 0 ? len : xuong).push(m));

  return [...len, ...xuong.reverse()];
}

/** Dải nhịp bấm được, khớp `bpmBucket` trong bản thiết kế. */
export const CAC_DAI_NHIP = [
  { ma: "140-150", nhan: "140–150 · khởi động", tu: 140, den: 150 },
  { ma: "150-160", nhan: "150–160 · chạy đều", tu: 150, den: 160 },
  { ma: "160-170", nhan: "160–170 · đẩy nhịp", tu: 160, den: 170 },
  { ma: "170-180", nhan: "170–180 · nước rút", tu: 170, den: 180 },
  { ma: "140-180", nhan: "Cả dải 140–180", tu: 140, den: 180 },
] as const;

export type MaDaiNhip = (typeof CAC_DAI_NHIP)[number]["ma"];
