/**
 * Các giọng đọc chọn được, và trần miễn phí đi kèm từng loại.
 *
 * **TRẦN MIỄN PHÍ PHẢI ĐI THEO GIỌNG, KHÔNG ĐỂ NGƯỜI DÙNG TỰ NHỚ.** Google cho
 * giọng Standard 4 triệu ký tự mỗi tháng nhưng giọng Wavenet chỉ 1 triệu. Nếu
 * để trần là một con số cấu hình riêng thì chỉ cần đổi sang Wavenet mà quên sửa
 * trần là cái phanh 90% đặt sai chỗ — tưởng còn nhiều, thực ra đã vượt từ lâu
 * và đang tính tiền vào thẻ.
 *
 * Buộc hai thứ vào nhau ở đây thì không có cách nào sai được.
 *
 * DANH SÁCH NÀY LÀ BA GIỌNG CHỦ DỰ ÁN ĐÃ NGHE VÀ DUYỆT (2026-08-15), sau khi
 * so sáu mẫu. Đừng tự ý thêm giọng khác vào — mỗi giọng là một lựa chọn về
 * cảm giác nghe, không phải một tuỳ chọn kỹ thuật.
 */

export interface GiongDoc {
  ma: string;
  ten: string;
  gioiTinh: "nữ" | "nam";
  /** Ký tự miễn phí mỗi tháng của LOẠI giọng này */
  tranMienPhi: number;
  moTa: string;
}

/** Giọng Standard: 4 triệu ký tự miễn phí mỗi tháng. */
const TRAN_STANDARD = 4_000_000;

/** Giọng Wavenet: chỉ 1 triệu, tức bằng một phần tư. */
const TRAN_WAVENET = 1_000_000;

export const CAC_GIONG: GiongDoc[] = [
  {
    ma: "vi-VN-Standard-C",
    ten: "Giọng nữ (Standard C)",
    gioiTinh: "nữ",
    tranMienPhi: TRAN_STANDARD,
    moTa: "Miễn phí 4 triệu ký tự mỗi tháng — đủ khoảng 88 giờ nghe",
  },
  {
    ma: "vi-VN-Standard-D",
    ten: "Giọng nam (Standard D)",
    gioiTinh: "nam",
    tranMienPhi: TRAN_STANDARD,
    moTa: "Miễn phí 4 triệu ký tự mỗi tháng — đủ khoảng 88 giờ nghe",
  },
  {
    ma: "vi-VN-Wavenet-A",
    ten: "Giọng nữ tự nhiên hơn (Wavenet A)",
    gioiTinh: "nữ",
    tranMienPhi: TRAN_WAVENET,
    moTa:
      "Nghe mượt hơn nhưng chỉ miễn phí 1 triệu ký tự mỗi tháng — khoảng 22 " +
      "giờ nghe. Vượt phần đó là tính tiền.",
  },
];

/** Giọng dùng khi chưa chọn gì. */
export const GIONG_MAC_DINH = CAC_GIONG[0]!.ma;

/** Tìm giọng theo mã. Mã lạ thì trả về giọng mặc định, không ném lỗi. */
export function timGiong(ma: string | null | undefined): GiongDoc {
  return CAC_GIONG.find((g) => g.ma === ma) ?? CAC_GIONG[0]!;
}
