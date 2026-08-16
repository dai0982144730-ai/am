/**
 * Nhận diện "đây là tập mấy của bộ nào" từ tiêu đề — phần TÍNH TOÁN THUẦN,
 * không đụng database.
 *
 * Chốt 2026-08-17: nội dung có cấu trúc tập (video nhiều phần, tập podcast,
 * truyện nhiều tập) đi một luồng theo dõi riêng — xem `quanLyBoTap.ts`. Bước
 * đầu tiên của luồng đó là nhận ra một tiêu đề CÓ phải một tập hay không, và
 * nếu có thì thuộc bộ nào.
 *
 * ## Vì sao khoá nhận diện là "tên đã bỏ số tập", không phải tên nguyên văn
 *
 * "Tập 7 — Đêm trắng" và "Tập 8 — Đêm trắng" phải nhận ra là CÙNG một bộ. Bỏ
 * cụm "Tập N" ra khỏi tiêu đề rồi so phần còn lại là cách rẻ nhất làm được
 * việc đó mà không cần gọi Claude.
 *
 * ## Rủi ro đã biết, chấp nhận cho bản đầu
 *
 * Mẫu `#N` dễ bắt nhầm hashtag không liên quan tập phim (`#1 xu hướng`). Bù
 * lại bằng cách xếp mẫu này SAU CÙNG — bốn mẫu tiếng Việt/Anh rõ nghĩa hơn
 * được thử trước.
 */

export interface TapNhanDang {
  soTap: number;
  /** Tên loạt đã chuẩn hoá — dùng làm khoá so khớp cùng bộ */
  khoaChuoi: string;
}

const MAU_TAP: RegExp[] = [
  /\btập\s*\.?\s*(\d{1,4})\b/i,
  /\bphần\s*\.?\s*(\d{1,4})\b/i,
  /\bepisode\s*\.?\s*(\d{1,4})\b/i,
  /\bep\s*\.?\s*(\d{1,4})\b/i,
  /#\s*(\d{1,4})\b/,
];

/** Bỏ dấu câu, gộp khoảng trắng, hạ chữ thường — để so khớp không nhạy dấu. */
function chuanHoaTen(tieuDe: string): string {
  return tieuDe
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Nhận diện một tiêu đề.
 *
 * KHOÁ CHỈ LẤY PHẦN ĐỨNG TRƯỚC "Tập N", không lấy toàn bộ phần còn lại.
 *
 * Đã thử toàn bộ phần còn lại trước, và sai ngay ở ví dụ đơn giản nhất:
 * "Đêm trắng - Tập 7" và "Đêm trắng - Tập 8: Kết thúc" phải là CÙNG một bộ,
 * nhưng phụ đề riêng của tập 8 ("Kết thúc") làm phần còn lại của hai tiêu đề
 * lệch nhau. Theo đúng quy ước phổ biến — tên bộ đứng TRƯỚC "Tập N", phụ đề
 * riêng từng tập đứng SAU — chỉ phần trước mới ổn định giữa các tập.
 *
 * Phần trước rỗng hoặc quá ngắn (tiêu đề kiểu "Tập 8: Đêm trắng", tên đứng
 * sau) thì đành lấy tạm phần sau — không hoàn hảo, nhưng còn hơn bỏ qua hẳn.
 */
export function nhanDangTap(tieuDe: string): TapNhanDang | null {
  for (const mau of MAU_TAP) {
    const khop = mau.exec(tieuDe);
    if (!khop) continue;

    const soTap = Number(khop[1]);
    if (!Number.isFinite(soTap) || soTap <= 0 || soTap > 9999) continue;

    const phanTruoc = chuanHoaTen(tieuDe.slice(0, khop.index));
    const phanSau = chuanHoaTen(tieuDe.slice(khop.index + khop[0].length));
    const khoaChuoi = phanTruoc.length >= 4 ? phanTruoc : phanSau;
    if (khoaChuoi.length < 4) continue;

    return { soTap, khoaChuoi };
  }
  return null;
}

/** Điểm chất lượng tối thiểu để tập 1 được coi là "hay", đáng theo tiếp. */
export const NGUONG_TAP_MOT = 6.0;

/** Trần tập mới thả mỗi ngày, tính riêng cho từng bộ. */
export const TRAN_TAP_MOI_NGAY = 2;

/** Không xem hết trong ngần này ngày kể từ lần thả gần nhất thì loại hẳn. */
export const SO_NGAY_CHO_XEM = 3;
