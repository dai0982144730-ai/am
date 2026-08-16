/**
 * Xếp các kênh YouTube vào chuyên mục — việc hằng tuần.
 *
 *   npx tsx scripts/xep-kenh.ts            # xem tình hình, chưa chạy
 *   npx tsx scripts/xep-kenh.ts --chay     # xếp những kênh chưa có chuyên mục
 *   npx tsx scripts/xep-kenh.ts --chay --lam-lai   # xếp lại từ đầu tất cả
 *
 * Chủ dự án chốt 2026-08-16: *"các kênh của tôi nó theo chủ đề. nên cứ mỗi tuần
 * quét một lần xem kênh nào nằm trong các chuyên đề cố định và đưa vào danh
 * sách. các kênh còn lại dùng khi đột nhiên cần chủ đề ngẫu hứng"*.
 *
 * Kênh xếp vào năm mảng cố định thì được quét mỗi đêm. Kênh còn lại KHÔNG bị
 * xoá — chúng nằm chờ, chỉ được lấy ra khi chủ nhà muốn xem thứ ngẫu hứng.
 */

import "dotenv/config";

import { prisma } from "../src/lib/db/prisma";
import { xemTinhHinh } from "../src/lib/youtube/hanMuc";
import { xepKenhHangLoat } from "../src/lib/youtube/xepKenh";

const TEN_NHOM: Record<string, string> = {
  ai: "AI",
  triet_hoc: "Triết học",
  truyen: "Truyện",
  music: "Nhạc",
  khoa_hoc: "Khoa học",
  other: "Ngoài năm mảng",
};

async function main() {
  const chay = process.argv.includes("--chay");
  const lamLai = process.argv.includes("--lam-lai");

  const dem = await prisma.source.groupBy({
    by: ["contentGroupHint"],
    where: { type: "youtube_channel" },
    _count: { _all: true },
  });

  console.log("Tình hình hiện tại — 269 kênh YouTube trong kho:");
  for (const d of dem.sort((a, b) => b._count._all - a._count._all)) {
    const ten = d.contentGroupHint
      ? (TEN_NHOM[d.contentGroupHint] ?? d.contentGroupHint)
      : "CHƯA XẾP";
    console.log(`  ${ten.padEnd(16)} ${d._count._all}`);
  }

  if (!chay) {
    console.log("\nThêm --chay để xếp thật.");
    await prisma.$disconnect();
    return;
  }

  const truoc = await xemTinhHinh();
  console.log(`\nHạn mức YouTube trước: ${truoc.daDung}/${truoc.nganSach}\n`);

  const kq = await xepKenhHangLoat(1_000, (dong) => console.log(dong), lamLai);

  const sau = await xemTinhHinh();
  console.log("\n" + "=".repeat(58));
  console.log(`Đã xét:  ${kq.daXet} kênh`);
  console.log(`Xếp được: ${kq.daXep}`);
  console.log(`Lỗi:     ${kq.loi}`);
  console.log("\nKết quả:");
  for (const [nhom, so] of Object.entries(kq.theoNhom).sort(
    (a, b) => b[1] - a[1],
  )) {
    console.log(`  ${(TEN_NHOM[nhom] ?? nhom).padEnd(16)} ${so}`);
  }
  console.log(`\nHạn mức tiêu thêm: ${sau.daDung - truoc.daDung} đơn vị`);

  const trongMang = await prisma.source.count({
    where: {
      type: "youtube_channel",
      contentGroupHint: { in: ["ai", "triet_hoc", "truyen", "music", "khoa_hoc"] },
    },
  });
  console.log(
    `\nTừ giờ lượt quét đêm chỉ đụng tới ${trongMang} kênh thuộc năm mảng cố định.`,
  );

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("Lỗi:", e instanceof Error ? e.message : e);
  await prisma.$disconnect();
  process.exit(1);
});
