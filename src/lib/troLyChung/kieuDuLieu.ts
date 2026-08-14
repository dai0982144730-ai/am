/**
 * Khung dữ liệu chuẩn của Cổng API trợ lý.
 *
 * Ba trang (am / tiendo / phaply) có dữ liệu hoàn toàn khác nhau, nhưng với app
 * điện thoại chúng phải trông giống hệt nhau. File này định nghĩa cái "giống hệt
 * nhau" đó. Chép nguyên file này sang hai trang kia, đừng viết lại.
 *
 * Yêu cầu gốc: docs/yeu-cau-cong-api-tro-ly.md, mục 3.
 */

/** Đánh số ngay từ đầu để nâng cấp sau này không làm hỏng app đã cài */
export const PHIEN_BAN_API = "v1";

/** Tên trang này. App dùng để biết câu trả lời đến từ đâu. */
export const TEN_TRANG = "am";

/**
 * Loại của một mục kết quả.
 *
 * Đây là danh sách dùng chung cho cả ba trang — `am` chỉ sinh ra `video` và
 * `baiViet`, ba loại còn lại thuộc về `tiendo` và `phaply`. Giữ đủ trong kiểu dữ
 * liệu để app điện thoại chỉ cần học một danh sách.
 */
export type LoaiKetQua = "video" | "baiViet" | "duAn" | "vanBanLuat" | "hoSo";

/** Một mục trong danh sách kết quả tìm kiếm */
export interface MucKetQua {
  id: string;
  tieuDe: string;
  loai: LoaiKetQua;
  tomTat: string;
  /** Dạng yyyy-mm-dd, hoặc null khi nguồn không cho biết ngày */
  ngay: string | null;
  duongDan: string | null;
  /** 0–1. Càng gần 1 càng khớp với câu hỏi */
  doLienQuan: number;
  /** Chỗ mỗi trang nhét thêm thông tin đặc thù mà khung chung không có */
  duLieuRieng: Record<string, unknown>;
  /** Chỉ có khi gọi kèm tham số kemNoiDung */
  noiDung?: string;
}

export interface KetQuaTimKiem {
  ketQua: MucKetQua[];
  tongSo: number;
}

export interface NguonThamKhao {
  id: string;
  tieuDe: string;
  duongDan: string | null;
}

/**
 * Câu trả lời của trợ lý.
 *
 * Hai bản là điểm mấu chốt của cả thiết kế: nghe máy đọc một bài dài 400 chữ là
 * trải nghiệm rất tệ, nên `traLoiNgan` để đọc thành tiếng, `traLoiDay` để hiện
 * trên màn hình.
 */
export interface TraLoiTroLy {
  /** Tối đa 3–4 câu, không markdown, không URL — viết như lời nói */
  traLoiNgan: string;
  /** Bản đầy đủ, có markdown, bảng, link */
  traLoiDay: string;
  nguonThamKhao: NguonThamKhao[];
  trang: string;
}

export interface TinhTrangSucKhoe {
  trang: string;
  phienBanApi: string;
  database: "ok" | "loi";
  /** Số bản ghi của vài bảng chính — để biết trang có dữ liệu thật hay chưa */
  soBanGhi: Record<string, number>;
  thoiGianPhanHoiMs: number;
  /** Chỉ có khi database lỗi */
  loi?: string;
}

/**
 * Một công cụ, viết đúng định dạng `tools` của Claude API.
 *
 * Tên trường ở đây cố ý giữ tiếng Anh (`name`, `description`, `input_schema`) vì
 * đây không phải dữ liệu của mình — đây là định dạng Claude API quy định, app
 * điện thoại nhận được là đưa thẳng cho Claude, không sửa gì.
 *
 * QUY ƯỚC ĐẶT TÊN CÔNG CỤ: luôn mở đầu bằng tên trang (`am_`, `tiendo_`,
 * `phaply_`). App gom công cụ của cả ba trang vào một danh sách, trùng tên là
 * hỏng — Claude sẽ không biết gọi công cụ của trang nào.
 */
export interface CongCuTroLy {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface DanhSachCongCu {
  trang: string;
  phienBanApi: string;
  congCu: CongCuTroLy[];
}

/** Mã lỗi dùng chung cả ba trang */
export type MaLoi =
  | "thieu_token"
  | "token_sai"
  | "goi_qua_nhieu"
  | "tham_so_sai"
  | "khong_tim_thay"
  | "loi_he_thong";

export interface PhanHoiLoi {
  loi: {
    ma: MaLoi;
    thongDiep: string;
  };
}
