/**
 * Nhờ Claude đọc các ghi chú chưa có nhãn rồi xếp vào ngăn chủ đề.
 *
 *   npx tsx scripts/gan-nhan-ghi-chu.ts
 *
 * Chạy được nhiều lần: ghi chú đã có nhãn thì bỏ qua, nên không đè lên nhãn
 * bạn đã sửa tay.
 */

import "dotenv/config";

import { prisma } from "../src/lib/db/prisma";
import { ganNhanHangLoat } from "../src/lib/ghiChu/ganNhan";

async function main() {
  const kq = await ganNhanHangLoat(50);

  if (kq.daXet === 0) {
    console.log("Không có ghi chú nào chưa gắn nhãn.");
    await prisma.$disconnect();
    return;
  }

  console.log(`Đã xét ${kq.daXet} ghi chú, gắn nhãn được ${kq.thanhCong}.`);

  if (kq.boSuuTapMoi.length > 0) {
    console.log(`\nNgăn chủ đề mới lập:`);
    for (const ten of kq.boSuuTapMoi) console.log(`  · ${ten}`);
  }

  if (kq.soViecCanLam > 0) {
    console.log(`\nTách ra ${kq.soViecCanLam} việc cần làm.`);
  }

  if (kq.loi.length > 0) {
    console.log(`\n${kq.loi.length} ghi chú lỗi:`);
    for (const l of kq.loi) console.log(`  ✗ "${l.ghiChu}…" — ${l.lyDo}`);
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
