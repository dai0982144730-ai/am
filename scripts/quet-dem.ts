/**
 * Việc quét hằng đêm — một lệnh thay cho sáu.
 *
 *   npx tsx scripts/quet-dem.ts
 *
 * Đây là lệnh duy nhất cần chạy mỗi tối. Nó tự làm đủ bảy bước theo đúng thứ
 * tự: quét video → quét blog → lấy lời thoại → phân loại → thuật lại → chấm
 * điểm → đọc bình luận.
 *
 * Một bước hỏng không làm chết cả đêm; các bước sau vẫn chạy tiếp với dữ liệu
 * đang có, và phần hỏng được ghi lại ở cuối.
 *
 * Để máy tự chạy lúc 21:00 mỗi tối, xem `docs/tu-chay-hang-dem.md`.
 */

import "dotenv/config";

import { prisma } from "../src/lib/db/prisma";
import { quetDem } from "../src/lib/vanHanh/quetDem";

function docGio(luc: Date): string {
  return luc.toLocaleTimeString("vi-VN", { hour12: false });
}

async function main() {
  console.log(`Bắt đầu quét đêm lúc ${docGio(new Date())}`);
  console.log("─".repeat(64));

  const kq = await quetDem((dong) => console.log(dong));

  const tongGiay = Math.round(
    (kq.ketThuc.getTime() - kq.batDau.getTime()) / 1000,
  );
  const phut = Math.floor(tongGiay / 60);

  console.log(`\n${"─".repeat(64)}`);
  console.log(
    `Xong lúc ${docGio(kq.ketThuc)}, mất ${phut > 0 ? `${phut} phút ` : ""}${tongGiay % 60} giây`,
  );

  if (kq.soBuocHong === 0) {
    console.log(`Cả ${kq.cacBuoc.length} bước đều xong.`);
  } else {
    console.log(
      `${kq.cacBuoc.length - kq.soBuocHong}/${kq.cacBuoc.length} bước xong, ${kq.soBuocHong} bước hỏng:`,
    );
    kq.cacBuoc
      .filter((b) => !b.thanhCong)
      .forEach((b) => console.log(`  ✗ ${b.ten}\n      ${b.tomTat}`));
  }

  // Vài con số để biết sáng mai có gì xem
  const [tongKho, daPhanLoai, moiHomNay] = await Promise.all([
    prisma.contentItem.count(),
    prisma.contentItem.count({ where: { status: "classified" } }),
    prisma.contentItem.count({
      where: { createdAt: { gte: kq.batDau } },
    }),
  ]);

  console.log(`\nKho: ${tongKho} nội dung, ${daPhanLoai} đã phân loại`);
  console.log(`Đêm nay thêm mới: ${moiHomNay}`);
}

main().catch((loi) => {
  console.error("\n✗ Lỗi:", loi instanceof Error ? loi.message : loi);
  process.exit(1);
});
