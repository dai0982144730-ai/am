/**
 * Chủ đề con của từng chuyên mục — chủ nhà tự cấu hình.
 *
 * ## Một danh sách, hai công dụng
 *
 * Đây là chỗ dễ hiểu nhầm nhất trong module này: danh sách chủ đề con KHÔNG
 * chỉ là mấy nút lọc trên màn hình.
 *
 *   1. **Nút lọc** ở hàng dưới trang Khám phá
 *   2. **Lời dặn cho Claude** lúc phân loại — chính danh sách này được nhét
 *      vào khung JSON mà Claude phải điền theo
 *
 * Nên thêm một chủ đề vào đây là dạy Claude nhận ra nó từ lượt quét sau, chứ
 * không phải chỉ thêm một cái nút. Và `moTa` cũng đi thẳng vào lời dặn: viết
 * "Tin Claude" mà không nói rõ ranh giới thì Claude xếp cả tin OpenAI vào.
 *
 * ## Vì sao nhạc BPM không nằm ở đây
 *
 * Nhạc chạy bộ theo nhịp là nhóm đặc thù: nó cần dải BPM cụ thể và độ dài đủ
 * lớn, đo bằng luật chứ không phải bằng cách Claude đọc hiểu (xem
 * `music/xuLyNhac.ts`). Chủ dự án chốt 2026-08-19 giữ nó tách riêng, cấu hình
 * thủ công như cũ.
 */

import type { ContentGroup } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db/prisma";

/** Năm chuyên mục có chủ đề con cấu hình được. */
export const CHUYEN_MUC_CO_CHU_DE = [
  "ai",
  "triet_hoc",
  "truyen",
  "music",
  "khoa_hoc",
] as const;

export type MaChuyenMucChuDe = (typeof CHUYEN_MUC_CO_CHU_DE)[number];

/** Tên trường trong `ContentClassification` giữ chủ đề con của từng chuyên mục. */
export const TRUONG_CHU_DE: Record<MaChuyenMucChuDe, string> = {
  ai: "aiSubtopic",
  triet_hoc: "philosophySchool",
  truyen: "storyGenre",
  music: "musicGenre",
  khoa_hoc: "scienceField",
};

/** Tên hiện trên màn hình cho hàng nút lọc của từng chuyên mục. */
export const TEN_HANG_CHU_DE: Record<MaChuyenMucChuDe, string> = {
  ai: "Chủ đề con",
  triet_hoc: "Trường phái",
  truyen: "Thể loại",
  music: "Thể loại nhạc",
  khoa_hoc: "Lĩnh vực",
};

export interface ChuDeGon {
  id: string;
  ma: string;
  ten: string;
  moTa: string | null;
  viTri: number;
  bat: boolean;
}

/** Đọc chủ đề con của một chuyên mục. Mặc định chỉ lấy cái đang bật. */
export async function layChuDeCon(
  chuyenMuc: MaChuyenMucChuDe,
  caCaiTat = false,
): Promise<ChuDeGon[]> {
  return prisma.chuDeCon.findMany({
    where: { chuyenMuc: chuyenMuc as ContentGroup, ...(caCaiTat ? {} : { bat: true }) },
    orderBy: [{ viTri: "asc" }, { ten: "asc" }],
    select: { id: true, ma: true, ten: true, moTa: true, viTri: true, bat: true },
  });
}

/** Đọc chủ đề con của cả năm chuyên mục một lượt — cho trang Khám phá. */
export async function layChuDeConMoiMuc(
  caCaiTat = false,
): Promise<Record<MaChuyenMucChuDe, ChuDeGon[]>> {
  const tatCa = await prisma.chuDeCon.findMany({
    where: caCaiTat ? {} : { bat: true },
    orderBy: [{ viTri: "asc" }, { ten: "asc" }],
    select: {
      id: true,
      ma: true,
      ten: true,
      moTa: true,
      viTri: true,
      bat: true,
      chuyenMuc: true,
    },
  });

  const ra = {} as Record<MaChuyenMucChuDe, ChuDeGon[]>;
  for (const m of CHUYEN_MUC_CO_CHU_DE) ra[m] = [];
  for (const c of tatCa) {
    const m = c.chuyenMuc as MaChuyenMucChuDe;
    if (ra[m]) ra[m].push(c);
  }
  return ra;
}

/**
 * Đổi tên gọi thành mã máy: bỏ dấu, chữ thường, gạch dưới.
 *
 * Chủ nhà gõ "Tin Claude" thì mã là `tin_claude`. Giữ mã không dấu vì nó nằm
 * trong URL của bộ lọc và trong lời dặn cho Claude — dấu tiếng Việt ở hai chỗ
 * đó chỉ rước thêm rắc rối mã hoá.
 */
export function maTuTen(ten: string): string {
  return ten
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

/**
 * Danh sách gieo lần đầu — đúng những chủ đề đang khoá cứng trong code trước
 * khi có bảng này, để chuyển sang cấu hình được mà không mất gì.
 *
 * `moTa` viết mới cho những chỗ trước đây Claude phải tự đoán ranh giới.
 */
export const GIEO_LAN_DAU: Record<
  MaChuyenMucChuDe,
  { ma: string; ten: string; moTa?: string }[]
> = {
  ai: [
    { ma: "claude_news", ten: "Tin Claude", moTa: "Tin về chính Claude và Anthropic. Tin OpenAI, Google thì thuộc 'Tin AI chung'." },
    { ma: "ai_news_general", ten: "Tin AI chung", moTa: "Tin ngành AI nói chung: mô hình mới, hãng khác, chính sách." },
    { ma: "ai_agent_enterprise", ten: "AI doanh nghiệp", moTa: "Dùng AI trong công việc, quy trình, tổ chức." },
    { ma: "coding_experience_howto", ten: "Kinh nghiệm viết code", moTa: "Kinh nghiệm thật khi lập trình cùng AI." },
    { ma: "claude_usage_guide", ten: "Hướng dẫn dùng Claude", moTa: "Chỉ cách dùng, mẹo, cấu hình Claude." },
  ],
  triet_hoc: [
    { ma: "stoic", ten: "Khắc kỷ" },
    { ma: "hien_sinh", ten: "Hiện sinh" },
    { ma: "tam_ly_hoc_hien_dai", ten: "Tâm lý học hiện đại" },
    { ma: "phat_giao_nguyen_thuy", ten: "Phật giáo Nguyên thuỷ" },
    { ma: "khac", ten: "Khác" },
  ],
  truyen: [
    { ma: "kinh_di", ten: "Kinh dị" },
    { ma: "vien_tuong", ten: "Viễn tưởng" },
    { ma: "phieu_luu_mao_hiem", ten: "Phiêu lưu mạo hiểm" },
  ],
  music: [
    { ma: "workout_bpm", ten: "Tập thể thao (BPM)", moTa: "Nhạc chạy bộ theo nhịp. Nhóm này còn được lọc riêng theo dải BPM." },
    { ma: "dance", ten: "Dance" },
    { ma: "piano", ten: "Piano" },
    { ma: "guitar_rock", ten: "Guitar rock" },
    { ma: "nhac_vang", ten: "Nhạc vàng" },
  ],
  khoa_hoc: [
    { ma: "y_hoc_suc_khoe", ten: "Y học & sức khoẻ", moTa: "Bệnh tật, dinh dưỡng, tuổi thọ, thể chất, tâm thần." },
    { ma: "vat_ly_vu_tru", ten: "Vật lý & vũ trụ", moTa: "Vật lý, thiên văn, không gian." },
    { ma: "sinh_hoc", ten: "Sinh học", moTa: "Sinh vật, gen, tiến hoá, sinh thái." },
    { ma: "vat_lieu_nang_luong", ten: "Vật liệu & năng lượng", moTa: "Pin, chất bán dẫn, vật liệu mới, điện, nhiên liệu." },
    { ma: "ky_thuat", ten: "Kỹ thuật", moTa: "Chế tạo, xây dựng, giao thông, máy móc, cách làm khoa học nói chung." },
  ],
};

/** Gieo danh sách ban đầu. Bỏ qua cái đã có, không đè lên sửa đổi của chủ nhà. */
export async function gieoChuDeConLanDau(): Promise<number> {
  let them = 0;
  for (const muc of CHUYEN_MUC_CO_CHU_DE) {
    const cac = GIEO_LAN_DAU[muc];
    for (const [i, c] of cac.entries()) {
      const daCo = await prisma.chuDeCon.findUnique({
        where: { chuyenMuc_ma: { chuyenMuc: muc as ContentGroup, ma: c.ma } },
        select: { id: true },
      });
      if (daCo) continue;
      await prisma.chuDeCon.create({
        data: {
          chuyenMuc: muc as ContentGroup,
          ma: c.ma,
          ten: c.ten,
          moTa: c.moTa ?? null,
          viTri: i,
        },
      });
      them += 1;
    }
  }
  return them;
}
