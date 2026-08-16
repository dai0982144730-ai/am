/**
 * Suất phân loại — phần HẰNG SỐ VÀ TÍNH TOÁN THUẦN, không đụng database.
 *
 * ## Vì sao phải tách khỏi `suatPhanLoai.ts`
 *
 * Chín thanh trượt chạy ở trình duyệt và cần đọc tên chuyên mục, tên nhóm
 * nguồn, mức mặc định. Nếu mấy thứ đó nằm chung file với hàm hỏi database thì
 * nhập một cái là kéo cả prisma và `pg` xuống trình duyệt — mà `pg` cần `net`,
 * `tls`, `dns`, những thứ trình duyệt không có, và trang trắng bóc.
 *
 * **Đã vấp hai lần trong cùng một ngày** (2026-08-16): lần đầu với thanh cường
 * độ, và ngay sau đó lặp lại với chín thanh này, dù lý do đã được ghi rõ ở đầu
 * `mucCuongDo.ts`. Quy tắc rút ra: **component `"use client"` chỉ được nhập từ
 * file `muc*.ts`**, không bao giờ nhập thẳng file có prisma.
 */

/** Sáu chuyên mục có suất riêng. */
export const CAC_CHUYEN_MUC = [
  "ai",
  "triet_hoc",
  "truyen",
  "music",
  "khoa_hoc",
  "ngau_hung",
] as const;
export type MaChuyenMuc = (typeof CAC_CHUYEN_MUC)[number];

export const TEN_CHUYEN_MUC: Record<MaChuyenMuc, string> = {
  ai: "AI",
  triet_hoc: "Triết học",
  truyen: "Truyện",
  music: "Nhạc",
  khoa_hoc: "Khoa học",
  ngau_hung: "Ngẫu hứng",
};

/** Ba nhóm nguồn, gộp đúng cách bộ lọc ở trang Khám phá đã gộp. */
export const CAC_NHOM_NGUON = ["youtube", "nghe", "viet"] as const;
export type MaNhomNguon = (typeof CAC_NHOM_NGUON)[number];

export const TEN_NHOM_NGUON: Record<MaNhomNguon, string> = {
  youtube: "YouTube",
  nghe: "Podcast & SoundCloud",
  viet: "Blog & Diễn đàn",
};

/** Đơn vị đếm của từng nhóm, dùng trong câu chữ hiện lên màn hình. */
export const DON_VI_NGUON: Record<MaNhomNguon, string> = {
  youtube: "video",
  nghe: "tập nghe",
  viet: "bài viết",
};

const LOAI_NGUON_THEO_NHOM: Record<MaNhomNguon, string[]> = {
  youtube: ["youtube_channel"],
  nghe: ["podcast_rss", "soundcloud_channel"],
  viet: ["blog_feed", "forum_community"],
};

export function nhomCuaLoaiNguon(loai: string): MaNhomNguon {
  for (const nhom of CAC_NHOM_NGUON) {
    if (LOAI_NGUON_THEO_NHOM[nhom].includes(loai)) return nhom;
  }
  return "youtube";
}

/** Mặc định: 10 bài mỗi mục, tổng 60. Chủ dự án chốt 2026-08-16. */
export const SUAT_MAC_DINH: Record<MaChuyenMuc, number> = {
  ai: 10,
  triet_hoc: 10,
  truyen: 10,
  music: 10,
  khoa_hoc: 10,
  ngau_hung: 10,
};

/**
 * Mặc định 45 / 45 / 10.
 *
 * Con số 10% cho bài viết không phải chọn bừa: mỗi đêm chỉ thuật lại được 5
 * bài, mà 10% của 60 là 6 bài viết, trong đó khoảng 80% là ngoại ngữ cần
 * thuyết minh — tức đúng khoảng 5 bài. Hai con số khớp nhau nên phần bài viết
 * không bị dồn ứ chờ đọc.
 */
export const TY_LE_MAC_DINH: Record<MaNhomNguon, number> = {
  youtube: 45,
  nghe: 45,
  viet: 10,
};

/** Mỗi thanh kéo được tới ngần này lần mức mặc định. */
export const SO_LAN_TOI_DA = 6;

export interface CaiDatSuat {
  chuyenMuc: Record<MaChuyenMuc, number>;
  tyLeNguon: Record<MaNhomNguon, number>;
}

/**
 * Suất thật sự của đêm nay = suất đã đặt × hệ số cường độ.
 *
 * Phép làm tròn ở đây phải **khớp từng chữ** với `chiaSuatPhanLoai` bên
 * `suatPhanLoai.ts`. Màn hình và máy chạy dùng chung một công thức thì mới
 * không có chuyện hứa 120 bài rồi chạy ra 118.
 */
export function suatSauCuongDo(
  muc: Record<MaChuyenMuc, number>,
  heSo: number,
): Record<MaChuyenMuc, number> {
  const kq = {} as Record<MaChuyenMuc, number>;
  for (const m of CAC_CHUYEN_MUC) kq[m] = Math.round(muc[m] * heSo);
  return kq;
}

export function tongSuat(muc: Record<MaChuyenMuc, number>): number {
  return CAC_CHUYEN_MUC.reduce((t, m) => t + muc[m], 0);
}

export function doSo(x: unknown, mac: number, tran: number): number {
  const n = typeof x === "number" ? x : Number(x);
  if (!Number.isFinite(n)) return mac;
  return Math.max(0, Math.min(tran, Math.round(n)));
}

/**
 * Ép ba phần trăm cộng đúng 100.
 *
 * Ô thứ ba **luôn bằng phần còn lại**, không bao giờ tự do. Chủ dự án chốt
 * 2026-08-16: kéo hai ô đầu rồi ô cuối tự về cho đủ 100. Hai ô đầu vượt quá
 * 100 thì ô thứ hai bị đẩy xuống, chứ không để ô ba âm.
 */
export function chuanHoaTyLe(
  tho: Partial<Record<MaNhomNguon, number>>,
): Record<MaNhomNguon, number> {
  const youtube = doSo(tho.youtube, TY_LE_MAC_DINH.youtube, 100);
  const nghe = Math.min(doSo(tho.nghe, TY_LE_MAC_DINH.nghe, 100), 100 - youtube);
  return { youtube, nghe, viet: 100 - youtube - nghe };
}

