/**
 * Tầng lọc thứ nhất: chặn rác bằng số liệu, **không dùng Claude**.
 *
 * VÌ SAO PHẢI CÓ TẦNG NÀY: Claude đọc một video mất khoảng mười nghìn chữ và
 * hơn chục giây. Kết quả tìm kiếm trên YouTube thì phần lớn là thứ nhìn tiêu đề
 * đã biết không đáng. Cho tất cả qua Claude là đốt hạn mức gói Pro vào việc
 * chứng minh thứ đã hiển nhiên.
 *
 * NGUYÊN TẮC KHI ĐẶT LUẬT Ở ĐÂY: **thà lọt vài cái xấu còn hơn chặn nhầm cái
 * tốt.** Chặn nhầm thì mất hẳn, không ai biết mà tiếc; lọt thì còn hai tầng sau
 * (Claude đọc, rồi chấm điểm) gạt tiếp. Nên mọi ngưỡng dưới đây đều đặt rộng
 * tay, chỉ nhắm vào thứ rác rõ ràng.
 */

/** Ngắn hơn ngần này giây thì không đủ nội dung để nói gì. */
const NGAN_NHAT_GIAY = 120;

/** Dài hơn ngần này thì thường là phát trực tiếp nhiều giờ hoặc nhạc lặp. */
const DAI_NHAT_GIAY = 5 * 3600;

/** Ít hơn ngần này lượt xem thì chưa có đủ tín hiệu nào để tin. */
const IT_NHAT_LUOT_XEM = 500;

/**
 * Tỉ lệ thích trên lượt xem thấp hơn ngần này là dấu hiệu xấu.
 *
 * Đặt rất thấp có chủ đích. Video tử tế thường đạt 2–8%; 0,3% là mức chỉ những
 * video bị đẩy đi khắp nơi mà không ai ưa mới rơi xuống.
 */
const TY_LE_THICH_TOI_THIEU = 0.003;

/**
 * Dấu hiệu tiêu đề giật gân.
 *
 * Chỉ bắt mẫu rõ ràng: viết hoa cả cụm dài, dày đặc dấu chấm than, và mấy công
 * thức câu view quen thuộc. Không bắt từ khoá đơn lẻ như "sốc" hay "bí mật" —
 * nhiều video tử tế vẫn dùng.
 */
const MAU_GIAT_GAN: { mau: RegExp; ten: string }[] = [
  { mau: /[!?]{3,}/, ten: "dày đặc dấu chấm than hoặc hỏi" },
  { mau: /\b(SỐC|CHẤN ĐỘNG|KINH HOÀNG|GÂY SỐC)\b/u, ten: "chữ giật gân viết hoa" },
  { mau: /không\s+tin\s+(nổi|được)/iu, ten: 'mẫu "không tin nổi"' },
  { mau: /sự\s+thật\s+(kinh|khủng|động\s+trời)/iu, ten: 'mẫu "sự thật động trời"' },
  { mau: /\b(bạn\s+sẽ\s+không\s+tin|xem\s+ngay\s+kẻo)\b/iu, ten: "mẫu câu view" },
];

export interface UngVienThoLoc {
  tieuDe: string;
  thoiLuongGiay: number | null;
  luotXem: number | null;
  luotThich: number | null;
  /** Video phát trực tiếp: "live" | "upcoming" | "none" */
  kieuPhat?: string;
  /** Số người theo dõi kênh, nếu biết */
  nguoiTheoDoiKenh?: number | null;
  /** Ngôn ngữ âm thanh YouTube khai báo, thường để trống */
  ngonNguAmThanh?: string | null;
}

/**
 * Nội dung không phải tiếng Việt thì chủ nhà nghe không hiểu.
 *
 * Chủ dự án nói thẳng: nguồn của họ đều là tiếng Việt vì họ không biết tiếng
 * Anh, và nội dung tiếng Anh là *"vô tri, không có ý nghĩa gì hết"*.
 *
 * CHỈ LOẠI KHI BIẾT CHẮC. YouTube để trống trường ngôn ngữ ở phần lớn video —
 * loại luôn khi không biết thì gạt oan gần hết, kể cả video Việt. Trường hợp
 * không rõ để Claude quyết lúc phân loại (nó đọc được nội dung thật), rồi bộ
 * lọc hiển thị trong `tiengViet/loc.ts` giấu đi nếu quả thật là tiếng nước
 * ngoài mà chưa có bản thuật lại.
 */
function laTiengVietHoacChuaRo(ma: string | null | undefined): boolean {
  if (!ma) return true;
  return ma.toLowerCase().startsWith("vi");
}

export interface KetQuaLoc {
  qua: boolean;
  /** Vì sao bị loại — để ghi lại và xem về sau luật nào đang gạt nhiều nhất */
  lyDo: string | null;
}

/**
 * Một ứng viên có đáng để Claude đọc không.
 *
 * Thiếu số liệu thì **cho qua**, không loại. Blog và diễn đàn không có lượt xem
 * hay lượt thích nào cả; loại vì thiếu số liệu là loại nhầm cả một loại nguồn.
 */
export function locSoBo(uv: UngVienThoLoc): KetQuaLoc {
  // Phát trực tiếp chưa xong thì chưa có gì để đọc, để chấm
  if (uv.kieuPhat === "live" || uv.kieuPhat === "upcoming") {
    return { qua: false, lyDo: "buổi phát trực tiếp chưa xong" };
  }

  // Chặn sớm nhất có thể: nghe không hiểu thì hay tới mấy cũng vô dụng
  if (!laTiengVietHoacChuaRo(uv.ngonNguAmThanh)) {
    return {
      qua: false,
      lyDo: `âm thanh tiếng "${uv.ngonNguAmThanh}", không phải tiếng Việt`,
    };
  }

  if (uv.thoiLuongGiay !== null) {
    if (uv.thoiLuongGiay < NGAN_NHAT_GIAY) {
      return { qua: false, lyDo: `chỉ ${uv.thoiLuongGiay} giây, quá ngắn` };
    }
    if (uv.thoiLuongGiay > DAI_NHAT_GIAY) {
      return {
        qua: false,
        lyDo: `dài ${Math.round(uv.thoiLuongGiay / 3600)} giờ, gần như chắc chắn là phát trực tiếp hoặc nhạc lặp`,
      };
    }
  }

  if (uv.luotXem !== null && uv.luotXem < IT_NHAT_LUOT_XEM) {
    return { qua: false, lyDo: `mới ${uv.luotXem} lượt xem, chưa đủ tín hiệu` };
  }

  if (
    uv.luotXem !== null &&
    uv.luotThich !== null &&
    uv.luotXem > 0 &&
    uv.luotThich / uv.luotXem < TY_LE_THICH_TOI_THIEU
  ) {
    return {
      qua: false,
      lyDo: `tỉ lệ thích ${((uv.luotThich / uv.luotXem) * 100).toFixed(2)}% — bị đẩy đi khắp nơi mà không ai ưa`,
    };
  }

  for (const { mau, ten } of MAU_GIAT_GAN) {
    if (mau.test(uv.tieuDe)) {
      return { qua: false, lyDo: `tiêu đề giật gân — ${ten}` };
    }
  }

  return { qua: true, lyDo: null };
}
