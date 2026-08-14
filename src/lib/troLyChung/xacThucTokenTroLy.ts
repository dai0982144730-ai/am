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

import type { MaLoi } from "./kieuDuLieu";

export interface KetQuaXacThuc {
  hopLe: boolean;
  /** Vài ký tự đầu của token, để ghi log mà không lộ token thật */
  nhanToken?: string;
  maLoi?: MaLoi;
  thongDiep?: string;
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
function soSanhAnToan(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let khac = 0;
  for (let i = 0; i < a.length; i++) {
    khac |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return khac === 0;
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
  const danhSach = docDanhSachToken();

  if (danhSach.length === 0) {
    return {
      hopLe: false,
      maLoi: "loi_he_thong",
      thongDiep:
        "Máy chủ chưa cấu hình TOKEN_TRO_LY. Thêm biến này vào file .env rồi khởi động lại.",
    };
  }

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
  const hopLe = danhSach.some((t) => soSanhAnToan(t, token));

  if (!hopLe) {
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
