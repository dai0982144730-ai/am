/**
 * Xác thực và giới hạn tần suất cho Cổng API trợ lý.
 *
 * Dùng chung cả ba trang — chép nguyên file này, chỉ đổi giá trị mặc định trong
 * `GIOI_HAN` nếu trang đó cần chặt hơn (tiendo và phaply chứa dữ liệu nội bộ
 * công ty, nên cân nhắc siết xuống).
 *
 * Vì sao token tĩnh chứ không phải đăng nhập đầy đủ: đây là hệ thống của một
 * người, mỗi thiết bị một token, lộ cái nào thu hồi cái đó bằng cách xoá khỏi
 * biến môi trường. Dựng cả hệ thống tài khoản cho một người dùng là thừa.
 */

import { createHash, timingSafeEqual } from "node:crypto";

import type { MaLoi } from "./kieuDuLieu";
import { kiemThe, TIEN_TO_THE } from "./theThietBi";

export interface KetQuaXacThuc {
  hopLe: boolean;
  /** Vài ký tự đầu của token, để ghi log mà không lộ token thật */
  nhanToken?: string;
  maLoi?: MaLoi;
  thongDiep?: string;
  /**
   * true khi người gọi dùng thẻ thiết bị (ghép app bằng mã, xem `theThietBi.ts`)
   * chứ không phải `TOKEN_TRO_LY`. Việc quản trị chỉ nhận thẻ thiết bị.
   */
  laTheThietBi?: boolean;
}

/** Mỗi token gọi tối đa bao nhiêu lần trong bao lâu */
const GIOI_HAN = {
  soLanToiDa: 60,
  trongKhoangMs: 60_000,
};

/**
 * Bộ đếm tần suất, để trong bộ nhớ.
 *
 * Hạn chế cần biết: bộ đếm này mất khi khởi động lại máy chủ, và nếu sau này
 * chạy nhiều tiến trình song song thì mỗi tiến trình đếm riêng. Với hệ thống một
 * người dùng thì chấp nhận được — mục đích ở đây là chặn app lỗi vòng lặp gọi
 * hàng nghìn lần làm cháy hoá đơn Claude API, không phải chống tấn công.
 */
const boDem = new Map<string, number[]>();

/**
 * So sánh hai chuỗi trong thời gian không đổi.
 *
 * So bằng `===` sẽ dừng ngay ở ký tự đầu tiên khác nhau, nên thời gian trả lời
 * hé lộ token đúng được bao nhiêu ký tự đầu. Hàm này luôn duyệt hết cả chuỗi.
 */
export function soSanhAnToan(a: string, b: string): boolean {
  // So băm của hai chuỗi: băm luôn dài đúng 32 byte nên thời gian trả lời
  // không hé lộ độ dài token thật (so thẳng thì chuỗi khác độ dài bị loại ngay).
  const bamA = createHash("sha256").update(a).digest();
  const bamB = createHash("sha256").update(b).digest();
  return timingSafeEqual(bamA, bamB);
}

/** Dò token sai: tối đa bao nhiêu lần mỗi phút từ cùng một nguồn gọi. */
const SO_LAN_SAI_TOI_DA = 20;
const boDemSai = new Map<string, number[]>();

/** Nhận diện nguồn gọi: địa chỉ do proxy/tunnel gắn vào, không có thì gộp chung. */
export function nguonGoi(request: Request): string {
  const xff = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return xff || request.headers.get("x-real-ip") || "khong-ro";
}

/** Ghi nhận một lần sai; trả `true` nếu nguồn này đã sai quá nhiều lần. */
function saiQuaNhieu(nguon: string): boolean {
  const bayGio = Date.now();
  const conHieuLuc = (boDemSai.get(nguon) ?? []).filter(
    (t) => bayGio - t < GIOI_HAN.trongKhoangMs,
  );
  conHieuLuc.push(bayGio);
  boDemSai.set(nguon, conHieuLuc);

  // Dọn định kỳ để bộ đếm không phình mãi khi bị quét từ nhiều địa chỉ
  if (boDemSai.size > 1_000) {
    for (const [khoa, ds] of boDemSai) {
      if (ds.every((t) => bayGio - t >= GIOI_HAN.trongKhoangMs)) boDemSai.delete(khoa);
    }
  }
  return conHieuLuc.length > SO_LAN_SAI_TOI_DA;
}

/** Đọc danh sách token hợp lệ từ biến môi trường TOKEN_TRO_LY */
function docDanhSachToken(): string[] {
  const gia = process.env.TOKEN_TRO_LY ?? "";
  return gia
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

/** Nhãn ghi log: 6 ký tự đầu là đủ để biết thiết bị nào gọi, không đủ để dùng lại */
export function nhanToken(token: string): string {
  return `${token.slice(0, 6)}…`;
}

function vuotGioiHan(token: string): boolean {
  const bayGio = Date.now();
  const lichSu = boDem.get(token) ?? [];
  const conHieuLuc = lichSu.filter((t) => bayGio - t < GIOI_HAN.trongKhoangMs);

  if (conHieuLuc.length >= GIOI_HAN.soLanToiDa) {
    boDem.set(token, conHieuLuc);
    return true;
  }

  conHieuLuc.push(bayGio);
  boDem.set(token, conHieuLuc);
  return false;
}

/**
 * Kiểm tra header Authorization của một request.
 *
 * Chấp nhận đúng dạng `Authorization: Bearer <token>`.
 */
export function xacThucTokenTroLy(request: Request): KetQuaXacThuc {
  const header = request.headers.get("authorization") ?? "";
  const khop = header.match(/^Bearer\s+(.+)$/i);

  if (!khop) {
    return {
      hopLe: false,
      maLoi: "thieu_token",
      thongDiep: "Thiếu header Authorization: Bearer <token>.",
    };
  }

  const token = khop[1].trim();

  // Thẻ thiết bị (app đã ghép bằng mã): kiểm chữ ký, không cần TOKEN_TRO_LY
  if (token.startsWith(TIEN_TO_THE)) {
    const the = kiemThe(token);
    if (!the.hopLe) {
      if (saiQuaNhieu(nguonGoi(request))) {
        return {
          hopLe: false,
          maLoi: "goi_qua_nhieu",
          thongDiep: "Thử sai quá nhiều lần. Chờ một lát rồi thử lại.",
        };
      }
      return {
        hopLe: false,
        maLoi: "token_sai",
        thongDiep:
          the.lyDo === "het_han"
            ? "Thẻ thiết bị đã hết hạn. Ghép lại app bằng mã mới ở trang Vận hành."
            : "Thẻ thiết bị không hợp lệ. Ghép lại app bằng mã ở trang Vận hành.",
      };
    }
    // Nhãn ghi log lấy từ băm của thẻ, không lấy từ đầu chuỗi (đầu chuỗi giống hệt nhau)
    const nhan = `the:${createHash("sha256").update(token).digest("hex").slice(0, 6)}`;
    if (vuotGioiHan(token)) {
      return {
        hopLe: false,
        nhanToken: nhan,
        maLoi: "goi_qua_nhieu",
        thongDiep: `Gọi quá ${GIOI_HAN.soLanToiDa} lần mỗi phút. Chờ một lát rồi thử lại.`,
      };
    }
    return { hopLe: true, nhanToken: nhan, laTheThietBi: true };
  }

  const danhSach = docDanhSachToken();

  if (danhSach.length === 0) {
    return {
      hopLe: false,
      maLoi: "loi_he_thong",
      thongDiep:
        "Máy chủ chưa cấu hình TOKEN_TRO_LY. Thêm biến này vào file .env rồi khởi động lại.",
    };
  }

  const hopLe = danhSach.some((t) => soSanhAnToan(t, token));

  if (!hopLe) {
    // Token sai cũng phải bị đếm, không thì đoán mò được vô hạn lần
    if (saiQuaNhieu(nguonGoi(request))) {
      return {
        hopLe: false,
        maLoi: "goi_qua_nhieu",
        thongDiep: "Thử sai quá nhiều lần. Chờ một lát rồi thử lại.",
      };
    }
    return { hopLe: false, maLoi: "token_sai", thongDiep: "Token không hợp lệ." };
  }

  if (vuotGioiHan(token)) {
    return {
      hopLe: false,
      nhanToken: nhanToken(token),
      maLoi: "goi_qua_nhieu",
      thongDiep: `Gọi quá ${GIOI_HAN.soLanToiDa} lần mỗi phút. Chờ một lát rồi thử lại.`,
    };
  }

  return { hopLe: true, nhanToken: nhanToken(token) };
}
