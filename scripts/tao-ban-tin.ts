/**
 * Tạo bản tin hằng sáng.
 *
 *   npx tsx scripts/tao-ban-tin.ts          # tạo mới
 *   npx tsx scripts/tao-ban-tin.ts --xem    # đọc bản tin gần nhất
 */

import "dotenv/config";

import { prisma } from "../src/lib/db/prisma";
import { taoBanTin } from "../src/lib/troLy/taoBanTin";

async function xemBanTinGanNhat() {
  const ban = await prisma.assistantBriefing.findFirst({
    orderBy: { deliveredAt: "desc" },
    include: { digestRun: true },
  });
  if (!ban) {
    console.log("Chưa có bản tin nào. Chạy không kèm --xem để tạo.");
    return;
  }
  console.log(`\n${"═".repeat(68)}`);
  console.log(`Bản tin ${ban.deliveredAt.toLocaleString("vi-VN")}`);
  console.log(`${ban.digestRun.newItemsFound} nội dung mới được quét về`);
  console.log(`${"═".repeat(68)}\n`);
  console.log(ban.conversationalScript);
  console.log(`\n${"═".repeat(68)}`);
}

async function main() {
  if (process.argv.includes("--xem")) {
    await xemBanTinGanNhat();
    return;
  }

  console.log("Đang chắt lọc nội dung và nhờ Claude viết bản tin…\n");
  const kq = await taoBanTin(false);

  console.log(`Chọn ra ${kq.soNoiBat} mục nổi bật + ${kq.soXemThem} mục xem thêm`);
  console.log(`(từ ${kq.tongMoi} nội dung mới)\n`);
  console.log("═".repeat(68));
  console.log(kq.banTin);
  console.log("═".repeat(68));
}

main().catch((loi) => {
  console.error("\n✗ Lỗi:", loi instanceof Error ? loi.message : loi);
  process.exit(1);
});
