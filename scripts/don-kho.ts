/**
 * Dọn kho về đúng số bài mà Vận hành đặt ra.
 *
 * ## Vì sao cần
 *
 * Kho hiện chứa hơn 800 nội dung, phần lớn là thứ Claude đã chấm rồi loại —
 * tin tức thời sự, video ngắn, nội dung lặp. Chúng nằm lại chỉ vì trước đây
 * không có ai xoá. Chủ dự án chốt 2026-08-16: *"cứ xóa sạch không giữ gì cả …
 * Sau khi xóa tổng toàn bộ kho sẽ chỉ có 60 bài"* — để sáng hôm sau nhìn vào
 * biết chắc thứ mình thấy là kết quả của hệ thống mới chứ không phải rác cũ.
 *
 * ## Giữ lại cái gì
 *
 * Đúng `SUAT_MAC_DINH` mỗi chuyên mục (mặc định 10 bài × 6 mục = 60), chọn theo
 * **điểm chất lượng cao nhất** trong từng mục. Không đủ 10 thì lấy hết những gì
 * có — không bịa thêm.
 *
 * ## Chạy thử trước
 *
 * Mặc định chỉ IN RA, không xoá. Muốn xoá thật thì thêm `--that`.
 *
 * ```bash
 * npx tsx scripts/don-kho.ts          # xem trước
 * npx tsx scripts/don-kho.ts --that   # xoá thật
 * ```
 */

import "dotenv/config";

import type { ContentGroup } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db/prisma";
import {
  CAC_CHUYEN_MUC,
  SUAT_MAC_DINH,
  TEN_CHUYEN_MUC,
  type MaChuyenMuc,
} from "@/lib/vanHanh/mucSuat";

/**
 * Sáu thanh trượt và enum trong database KHÔNG trùng tên.
 *
 * Database có `new_search` (kết quả từ khoá tự nhập) và `other` (chưa xếp
 * được); màn hình gộp cả hai thành một mục "Ngẫu hứng". Đúng cách
 * `chiaSuatPhanLoai` đang gộp, nên giữ lại cũng phải gộp y hệt.
 */
const NHOM_DB: Record<MaChuyenMuc, ContentGroup[]> = {
  ai: ["ai"],
  triet_hoc: ["triet_hoc"],
  truyen: ["truyen"],
  music: ["music"],
  khoa_hoc: ["khoa_hoc"],
  ngau_hung: ["new_search", "other"],
};

const XOA_THAT = process.argv.includes("--that");

async function main() {
  const tong = await prisma.contentItem.count();
  console.log(`Kho đang có ${tong} nội dung.\n`);

  // Chọn bài giữ lại: cao điểm nhất trong từng chuyên mục.
  const giuLai = new Set<string>();
  for (const muc of CAC_CHUYEN_MUC) {
    const suat = SUAT_MAC_DINH[muc];
    const cacBai = await prisma.contentItem.findMany({
      where: {
        contentGroup: { in: NHOM_DB[muc] },
        status: { not: "rejected" },
        classification: { isNot: null },
      },
      select: { id: true },
      orderBy: [
        { score: { compositeScore: { sort: "desc", nulls: "last" } } },
        { publishedAt: { sort: "desc", nulls: "last" } },
      ],
      take: suat,
    });
    for (const b of cacBai) giuLai.add(b.id);
    console.log(
      `${TEN_CHUYEN_MUC[muc].padEnd(12)} giữ ${String(cacBai.length).padStart(2)}/${suat}`,
    );
  }

  const soXoa = tong - giuLai.size;
  console.log(`\nGiữ ${giuLai.size} · xoá ${soXoa}`);

  // Nói rõ những thứ sẽ mất theo, vì chúng không quét lại được.
  const conLai = { contentItemId: { notIn: [...giuLai] } };
  const [thuVien, lichSu, ghiChu] = await Promise.all([
    prisma.libraryItem.count({ where: conLai }),
    prisma.consumptionSession.count({ where: conLai }),
    prisma.note.count({ where: conLai }),
  ]);
  console.log(
    `Mất theo: ${thuVien} mục thư viện · ${lichSu} lượt nghe · ${ghiChu} ghi chú`,
  );

  if (!XOA_THAT) {
    console.log("\n(chạy thử — chưa xoá gì. Thêm --that để xoá thật)");
    return;
  }

  const kq = await prisma.contentItem.deleteMany({
    where: { id: { notIn: [...giuLai] } },
  });
  console.log(`\nĐã xoá ${kq.count} nội dung. Kho còn ${await prisma.contentItem.count()}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
