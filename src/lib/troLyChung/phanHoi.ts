/**
 * Vỏ chung cho mọi tuyến của Cổng API trợ lý.
 *
 * Gom bốn việc lặp lại ở mọi endpoint vào một chỗ: xác thực token, đo thời gian
 * phản hồi, bắt lỗi, ghi nhật ký. Nhờ vậy mỗi file route chỉ còn đúng phần
 * nghiệp vụ của nó.
 *
 * Dùng chung cả ba trang.
 */

import type { MaLoi, PhanHoiLoi } from "./kieuDuLieu";
import { xacThucTokenTroLy } from "./xacThucTokenTroLy";

/** Mã lỗi nào ứng với mã trạng thái HTTP nào */
const MA_HTTP: Record<MaLoi, number> = {
  thieu_token: 401,
  token_sai: 401,
  goi_qua_nhieu: 429,
  tham_so_sai: 400,
  khong_tim_thay: 404,
  loi_he_thong: 500,
};

export function phanHoiLoi(ma: MaLoi, thongDiep: string): Response {
  const than: PhanHoiLoi = { loi: { ma, thongDiep } };
  return Response.json(than, { status: MA_HTTP[ma] });
}

/**
 * Lỗi có mã rõ ràng, ném ra từ trong lớp nghiệp vụ.
 *
 * Lớp nghiệp vụ không nên biết gì về HTTP, nên nó ném lỗi này còn vỏ HTTP ở dưới
 * mới dịch sang mã trạng thái.
 */
export class LoiTroLy extends Error {
  constructor(
    readonly ma: MaLoi,
    thongDiep: string,
  ) {
    super(thongDiep);
    this.name = "LoiTroLy";
  }
}

export interface ThongTinGoi {
  endpoint: string;
  nhanToken: string;
  thoiGianPhanHoiMs: number;
  maTrangThai: number;
  /** Số token AI tiêu thụ, chỉ có ở endpoint gọi Claude */
  tokenAiVao?: number;
  tokenAiRa?: number;
}

/** Hàm ghi nhật ký. Truyền từ ngoài vào để file này không phụ thuộc database. */
export type HamGhiNhatKy = (thongTin: ThongTinGoi) => Promise<void>;

let ghiNhatKy: HamGhiNhatKy | null = null;

/** Gắn hàm ghi nhật ký một lần lúc khởi động */
export function dangKyGhiNhatKy(ham: HamGhiNhatKy): void {
  ghiNhatKy = ham;
}

/** Thông tin phụ mà endpoint muốn ghi thêm vào nhật ký */
export interface KetQuaTuyen {
  than: unknown;
  tokenAiVao?: number;
  tokenAiRa?: number;
}

/**
 * Bọc một hàm xử lý thành tuyến hoàn chỉnh.
 *
 * Hàm xử lý chỉ cần trả về dữ liệu (hoặc `{ than, tokenAiVao, tokenAiRa }` nếu
 * có gọi Claude); phần còn lại vỏ này lo.
 *
 * @param endpoint Tên endpoint, dùng để ghi nhật ký
 * @param xuLy     Phần nghiệp vụ thật
 */
export function tuyenTroLy(
  endpoint: string,
  xuLy: (request: Request) => Promise<unknown | KetQuaTuyen>,
) {
  return async function (request: Request): Promise<Response> {
    const batDau = Date.now();

    const xacThuc = xacThucTokenTroLy(request);
    if (!xacThuc.hopLe) {
      const ma = xacThuc.maLoi ?? "token_sai";
      // Chưa qua được cửa thì chưa biết là thiết bị nào, ghi "?" cho nhất quán
      void ghiNhatKy?.({
        endpoint,
        nhanToken: xacThuc.nhanToken ?? "?",
        thoiGianPhanHoiMs: Date.now() - batDau,
        maTrangThai: MA_HTTP[ma],
      }).catch(() => {});
      return phanHoiLoi(ma, xacThuc.thongDiep ?? "Không xác thực được.");
    }

    try {
      const ketQua = await xuLy(request);
      const coBocThem =
        typeof ketQua === "object" && ketQua !== null && "than" in ketQua;
      const { than, tokenAiVao, tokenAiRa } = coBocThem
        ? (ketQua as KetQuaTuyen)
        : { than: ketQua, tokenAiVao: undefined, tokenAiRa: undefined };

      void ghiNhatKy?.({
        endpoint,
        nhanToken: xacThuc.nhanToken ?? "?",
        thoiGianPhanHoiMs: Date.now() - batDau,
        maTrangThai: 200,
        tokenAiVao,
        tokenAiRa,
      }).catch(() => {});

      return Response.json(than);
    } catch (loi) {
      const laLoiTroLy = loi instanceof LoiTroLy;
      const ma: MaLoi = laLoiTroLy ? loi.ma : "loi_he_thong";
      const thongDiep = laLoiTroLy
        ? loi.message
        : "Máy chủ gặp lỗi khi xử lý yêu cầu.";

      // Lỗi ngoài dự kiến thì in ra để còn lần được, lỗi có mã thì không cần
      if (!laLoiTroLy) console.error(`[tro-ly] ${endpoint}:`, loi);

      void ghiNhatKy?.({
        endpoint,
        nhanToken: xacThuc.nhanToken ?? "?",
        thoiGianPhanHoiMs: Date.now() - batDau,
        maTrangThai: MA_HTTP[ma],
      }).catch(() => {});

      return phanHoiLoi(ma, thongDiep);
    }
  };
}
