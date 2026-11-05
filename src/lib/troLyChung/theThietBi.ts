/**
 * Ghép app Android với máy chủ Am: mã ghép dùng một lần, đổi lấy "thẻ thiết bị".
 *
 * ## Luồng
 *
 *   1. Chủ dự án đăng nhập Google trên web, bấm "Tạo mã ghép" ở trang Vận hành.
 *   2. Máy chủ sinh một mã ngắn (dạng `K7M2-QX9P`), sống 5 phút, dùng một lần.
 *   3. Gõ mã vào app → app gọi `POST /api/v1/tro-ly/ghep-app` → nhận thẻ thiết bị.
 *   4. Từ đó app gửi thẻ trong header `Authorization: Bearer am1.…`, không phải
 *      gõ `TOKEN_TRO_LY`.
 *
 * Người duy nhất cấp được mã là người đã đăng nhập Google đúng email chủ dự án,
 * nên không ai khác ghép được app.
 *
 * ## Thẻ thiết bị
 *
 * Là chuỗi tự mang thông tin và có chữ ký (HMAC-SHA256), nên máy chủ KHÔNG cần
 * bảng database để nhớ. Khoá ký suy ra từ `AUTH_SECRET`:
 *
 *   - Đổi `AUTH_SECRET` → mọi thẻ cũ mất hiệu lực (cách thu hồi cả loạt).
 *   - Đổi `EMAIL_CHU_DU_AN` → thẻ của email cũ mất hiệu lực.
 *   - Thẻ tự hết hạn sau 90 ngày, app ghép lại bằng mã mới.
 *
 * Hạn chế cần biết: chưa thu hồi riêng được từng thiết bị. Với một người dùng,
 * vài chiếc điện thoại, chấp nhận được; cần thì thêm bảng sau.
 *
 * Mã ghép nằm trong bộ nhớ máy chủ, khởi động lại là mất (không sao: mã chỉ sống
 * 5 phút, tạo lại là có).
 */

import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

/** Thẻ thiết bị luôn bắt đầu bằng chuỗi này, để phân biệt với token tĩnh. */
export const TIEN_TO_THE = "am1.";

export const HAN_THE_MS = 90 * 24 * 60 * 60_000;
export const HAN_MA_GHEP_MS = 5 * 60_000;

/** Bỏ các chữ dễ nhầm nhau: I, O, 0, 1. */
const BANG_CHU = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const DO_DAI_MA = 8;
const TOI_DA_MA_CHO = 5;
const SAI_TOI_DA_MOI_PHUT = 10;

interface DuLieuThe {
  /** email chủ dự án */
  e: string;
  /** lúc cấp, giây */
  t: number;
  /** hết hạn, giây */
  x: number;
}

export type KetQuaKiemThe =
  | { hopLe: true; email: string; hetHanLuc: number }
  | { hopLe: false; lyDo: "khong_phai_the" | "sai_chu_ky" | "het_han" | "sai_chu_nhan" | "thieu_khoa" };

function emailChu(): string | undefined {
  return process.env.EMAIL_CHU_DU_AN?.trim().toLowerCase() || undefined;
}

function khoaKy(): Buffer | null {
  const goc = process.env.AUTH_SECRET;
  if (!goc) return null;
  // Suy ra khoá riêng cho thẻ, không dùng thẳng AUTH_SECRET làm khoá ký
  return createHmac("sha256", goc).update("am-the-thiet-bi-v1").digest();
}

const b64 = (b: Buffer | string) => Buffer.from(b).toString("base64url");

function chuKy(khoa: Buffer, phanDuLieu: string): string {
  return createHmac("sha256", khoa).update(phanDuLieu).digest("base64url");
}

/** Cấp một thẻ thiết bị cho `email`. Trả `null` nếu máy chủ chưa có `AUTH_SECRET`. */
export function taoThe(email: string, bayGioMs = Date.now()): { the: string; hetHanLuc: number } | null {
  const khoa = khoaKy();
  if (!khoa) return null;
  const hetHanLuc = bayGioMs + HAN_THE_MS;
  const du: DuLieuThe = {
    e: email.trim().toLowerCase(),
    t: Math.floor(bayGioMs / 1000),
    x: Math.floor(hetHanLuc / 1000),
  };
  const phan = b64(JSON.stringify(du));
  return { the: `${TIEN_TO_THE}${phan}.${chuKy(khoa, phan)}`, hetHanLuc };
}

/** Kiểm một chuỗi có phải thẻ thiết bị còn hiệu lực của chủ dự án không. */
export function kiemThe(token: string, bayGioMs = Date.now()): KetQuaKiemThe {
  if (!token.startsWith(TIEN_TO_THE)) return { hopLe: false, lyDo: "khong_phai_the" };
  const khoa = khoaKy();
  if (!khoa) return { hopLe: false, lyDo: "thieu_khoa" };

  const [phan, chuKyGui, thua] = token.slice(TIEN_TO_THE.length).split(".");
  if (!phan || !chuKyGui || thua !== undefined) return { hopLe: false, lyDo: "sai_chu_ky" };

  // So hai chữ ký cùng độ dài, trong thời gian không đổi
  const dung = Buffer.from(chuKy(khoa, phan));
  const gui = Buffer.from(chuKyGui);
  if (dung.length !== gui.length || !timingSafeEqual(dung, gui)) {
    return { hopLe: false, lyDo: "sai_chu_ky" };
  }

  let du: DuLieuThe;
  try {
    du = JSON.parse(Buffer.from(phan, "base64url").toString("utf8")) as DuLieuThe;
  } catch {
    return { hopLe: false, lyDo: "sai_chu_ky" };
  }
  if (typeof du.e !== "string" || typeof du.x !== "number") {
    return { hopLe: false, lyDo: "sai_chu_ky" };
  }
  if (bayGioMs >= du.x * 1000) return { hopLe: false, lyDo: "het_han" };

  const chu = emailChu();
  if (!chu || du.e !== chu) return { hopLe: false, lyDo: "sai_chu_nhan" };

  return { hopLe: true, email: du.e, hetHanLuc: du.x * 1000 };
}

// ---------------------------------------------------------------------------
// Mã ghép
// ---------------------------------------------------------------------------

interface MaGhep {
  email: string;
  hetHanLuc: number;
}

// Giữ trên globalThis để sống qua việc nạp lại module của `next dev`
type ToanCuc = typeof globalThis & {
  __amMaGhep?: Map<string, MaGhep>;
  __amGhepSai?: Map<string, number[]>;
};
const kho = () => ((globalThis as ToanCuc).__amMaGhep ??= new Map<string, MaGhep>());
const dem = () => ((globalThis as ToanCuc).__amGhepSai ??= new Map<string, number[]>());

function donMaHetHan(bayGio: number): void {
  for (const [ma, v] of kho()) if (v.hetHanLuc <= bayGio) kho().delete(ma);
}

/** Chuẩn hoá mã người dùng gõ: bỏ dấu gạch và khoảng trắng, viết hoa. */
export function chuanHoaMaGhep(tho: unknown): string | null {
  const s = String(tho ?? "").replace(/[\s-]+/g, "").toUpperCase();
  return new RegExp(`^[${BANG_CHU}]{${DO_DAI_MA}}$`).test(s) ? s : null;
}

/** Sinh mã ghép mới cho `email`. Trả mã dạng `K7M2-QX9P` và lúc hết hạn. */
export function taoMaGhep(email: string, bayGioMs = Date.now()): { ma: string; hetHanLuc: number } {
  donMaHetHan(bayGioMs);
  // Giữ tối đa vài mã chờ: tạo thêm thì bỏ mã cũ nhất
  while (kho().size >= TOI_DA_MA_CHO) {
    const cuNhat = [...kho().entries()].sort((a, b) => a[1].hetHanLuc - b[1].hetHanLuc)[0];
    if (!cuNhat) break;
    kho().delete(cuNhat[0]);
  }
  let ma = "";
  do {
    ma = Array.from({ length: DO_DAI_MA }, () => BANG_CHU[randomInt(BANG_CHU.length)]).join("");
  } while (kho().has(ma));
  const hetHanLuc = bayGioMs + HAN_MA_GHEP_MS;
  kho().set(ma, { email: email.trim().toLowerCase(), hetHanLuc });
  return { ma: `${ma.slice(0, 4)}-${ma.slice(4)}`, hetHanLuc };
}

export type KetQuaDoiMa =
  | { ok: true; the: string; hetHanLuc: number; email: string }
  | { ok: false; lyDo: "sai_dang" | "khong_dung" | "goi_qua_nhieu" | "thieu_khoa" };

/**
 * Đổi mã ghép lấy thẻ thiết bị. Mã dùng một lần: đổi xong (hoặc đoán sai) đều
 * không dùng lại được. Đoán sai quá nhiều thì khoá nguồn gọi một lúc.
 */
export function doiMaLayThe(tho: unknown, nguon: string, bayGioMs = Date.now()): KetQuaDoiMa {
  const lichSu = (dem().get(nguon) ?? []).filter((t) => bayGioMs - t < 60_000);
  if (lichSu.length >= SAI_TOI_DA_MOI_PHUT) {
    dem().set(nguon, lichSu);
    return { ok: false, lyDo: "goi_qua_nhieu" };
  }

  const ma = chuanHoaMaGhep(tho);
  donMaHetHan(bayGioMs);
  const co = ma ? kho().get(ma) : undefined;

  if (!ma || !co) {
    lichSu.push(bayGioMs);
    dem().set(nguon, lichSu);
    // Dọn bộ đếm khi bị dò từ nhiều nguồn
    if (dem().size > 1_000) {
      for (const [k, ds] of dem()) if (ds.every((t) => bayGioMs - t >= 60_000)) dem().delete(k);
    }
    return { ok: false, lyDo: ma ? "khong_dung" : "sai_dang" };
  }

  kho().delete(ma);
  const the = taoThe(co.email, bayGioMs);
  if (!the) return { ok: false, lyDo: "thieu_khoa" };
  return { ok: true, the: the.the, hetHanLuc: the.hetHanLuc, email: co.email };
}
