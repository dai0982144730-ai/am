/**
 * Tủ sách — theo dõi một tác giả xuyên nhiều kênh.
 *
 * ## Vì sao "xuyên nhiều kênh" mới là điểm chính
 *
 * Một giảng sư có thể xuất hiện trên năm kênh khác nhau: kênh chính thức của
 * chùa, kênh của một Phật tử ghi hình lại, kênh tổng hợp, kênh cắt đoạn ngắn.
 * Theo dõi kênh thì phải theo cả năm và vẫn sót; theo dõi *người* thì bắt được
 * hết, vì tên tác giả do Claude rút ra từ chính nội dung chứ không phải từ tên
 * kênh.
 *
 * Đây cũng là lý do phải gom tên trước (`gomTen.ts`): cùng một vị mà kênh này
 * ghi "Thầy Thích Pháp Hoà", kênh kia ghi "Thích Pháp Hoà" thì Tủ sách bày ra
 * hai người, và theo dõi một người là mất một nửa.
 */

import type { AuthorDomain } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db/prisma";
import { chuaLuotQua } from "@/lib/lichSu/loc";

/** Số nội dung mới nhất hiện dưới mỗi tác giả trong Tủ sách. */
const SO_BAI_MOI_TAC_GIA = 4;

export const TEN_LINH_VUC: Record<AuthorDomain, string> = {
  philosophy_teacher: "Giảng sư",
  story_writer: "Nhà văn",
  ai_blog_source: "Nguồn AI",
  music_curator: "Kênh nhạc",
};

export interface BaiCuaTacGia {
  id: string;
  tieuDe: string;
  anh: string | null;
  thoiLuong: number | null;
  dangLuc: Date | null;
  tenNguon: string;
}

export interface TacGiaTrongTuSach {
  id: string;
  ten: string;
  bietDanh: string[];
  linhVuc: AuthorDomain;
  theoDoi: boolean;
  daCongNhan: boolean;
  soBai: number;
  /** Nguồn đã đăng nội dung của người này — cái làm nên "xuyên nhiều kênh" */
  cacNguon: string[];
  baiMoi: BaiCuaTacGia[];
}

/**
 * Đọc Tủ sách.
 *
 * @param chiTheoDoi Chỉ lấy người đang theo dõi. Bỏ trống thì lấy tất cả, để
 *   dùng cho phần "thêm vào tủ".
 */
export async function docTuSach(
  chiTheoDoi = false,
): Promise<TacGiaTrongTuSach[]> {
  const cacTacGia = await prisma.author.findMany({
    where: chiTheoDoi ? { theoDoi: true } : {},
    select: {
      id: true,
      canonicalName: true,
      aliases: true,
      domain: true,
      theoDoi: true,
      approvedByUser: true,
    },
  });
  if (cacTacGia.length === 0) return [];

  // Lấy nội dung của mọi tác giả trong MỘT truy vấn rồi chia ra, thay vì hỏi
  // database một lần cho mỗi người. Với 77 tác giả thì đó là 77 lượt đi về.
  const cacBai = await prisma.contentItem.findMany({
    where: chuaLuotQua({
      status: "classified",
      classification: { authorId: { in: cacTacGia.map((t) => t.id) } },
    }),
    select: {
      id: true,
      title: true,
      thumbnailUrl: true,
      durationSeconds: true,
      publishedAt: true,
      source: { select: { title: true } },
      classification: { select: { authorId: true, titleVi: true } },
    },
    orderBy: { publishedAt: { sort: "desc", nulls: "last" } },
  });

  const theoTacGia = new Map<string, typeof cacBai>();
  for (const b of cacBai) {
    const id = b.classification?.authorId;
    if (!id) continue;
    const ds = theoTacGia.get(id) ?? [];
    ds.push(b);
    theoTacGia.set(id, ds);
  }

  return cacTacGia
    .map((t) => {
      const bai = theoTacGia.get(t.id) ?? [];
      return {
        id: t.id,
        ten: t.canonicalName,
        bietDanh: t.aliases,
        linhVuc: t.domain,
        theoDoi: t.theoDoi,
        daCongNhan: t.approvedByUser,
        soBai: bai.length,
        cacNguon: [...new Set(bai.map((b) => b.source.title))],
        baiMoi: bai.slice(0, SO_BAI_MOI_TAC_GIA).map((b) => ({
          id: b.id,
          tieuDe: b.classification?.titleVi ?? b.title,
          anh: b.thumbnailUrl,
          thoiLuong: b.durationSeconds,
          dangLuc: b.publishedAt,
          tenNguon: b.source.title,
        })),
      };
    })
    .filter((t) => t.soBai > 0)
    .sort((a, b) => {
      // Người đang theo dõi lên trước, rồi tới người có nhiều nội dung hơn
      if (a.theoDoi !== b.theoDoi) return a.theoDoi ? -1 : 1;
      return b.soBai - a.soBai;
    });
}
