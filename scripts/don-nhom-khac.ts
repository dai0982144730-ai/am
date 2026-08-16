/**
 * Loại những nội dung không thuộc chuyên mục nào ra khỏi phần hiển thị.
 *
 *   npx tsx scripts/don-nhom-khac.ts        # xem sẽ loại bao nhiêu, chưa ghi
 *   npx tsx scripts/don-nhom-khac.ts --ghi  # ghi thật
 *
 * ## Vì sao
 *
 * Am đi tìm sáu thứ cụ thể: AI, triết học, khoa học, truyện, nhạc, và từ khoá
 * chủ nhà tự gõ. Một nội dung không thuộc thứ nào trong sáu thứ đó nghĩa là nó
 * **lọt vào**, chứ không phải một loại nội dung hợp lệ tên là "khác".
 *
 * Chủ dự án chỉ ra đúng chỗ này (2026-08-15): *"cấu trúc tìm là tìm ai, triết
 * học, khoa học, music, Tùy chọn — thì lấy đâu ra cái gì là khác???"*
 *
 * Đo lúc phát hiện: **304 trên 417 nội dung đã phân loại rơi vào "other"** —
 * tức 73% những gì bày ra là thứ chẳng ai yêu cầu. Bày chúng ra là bắt chủ nhà
 * tự lọc lại bằng mắt, đúng cái việc app này sinh ra để làm thay.
 *
 * ## Loại chứ không xoá
 *
 * Chuyển `status` sang `rejected` chứ không xoá bản ghi. Ba lý do:
 *
 *   1. Xoá rồi thì lượt quét sau lại lôi về, lại tốn hạn mức đọc lần nữa
 *   2. Giữ lại thì đếm được tỷ lệ lọt vào, biết bộ lọc có đang tốt lên không
 *   3. Sửa nhầm còn quay lại được
 *
 * NGOẠI LỆ: nội dung tìm được từ từ khoá chủ nhà tự gõ (`adHocInterestId`)
 * luôn được giữ — nó thuộc "Tùy chọn", chính chủ nhà đòi thì không thể gọi là
 * lọt vào.
 */

import "dotenv/config";

import { prisma } from "../src/lib/db/prisma";

const DIEU_KIEN = {
  status: "classified" as const,
  contentGroup: "other" as const,
  adHocInterestId: null,
};

async function main() {
  const ghiThat = process.argv.includes("--ghi");

  const so = await prisma.contentItem.count({ where: DIEU_KIEN });
  const giuLai = await prisma.contentItem.count({
    where: {
      status: "classified",
      contentGroup: "other",
      adHocInterestId: { not: null },
    },
  });

  if (so === 0) {
    console.log("Không còn nội dung 'khác' nào lọt trong phần hiển thị.");
    await prisma.$disconnect();
    return;
  }

  console.log(`Sẽ loại:  ${so} nội dung không thuộc chuyên mục nào`);
  console.log(`Giữ lại:  ${giuLai} nội dung từ từ khoá bạn gõ (thuộc Tùy chọn)`);

  const viDu = await prisma.contentItem.findMany({
    where: DIEU_KIEN,
    select: { title: true, classification: { select: { titleVi: true } } },
    orderBy: { score: { compositeScore: { sort: "desc", nulls: "last" } } },
    take: 5,
  });
  console.log("\nVài bài sẽ bị loại (điểm cao nhất trong nhóm):");
  for (const v of viDu) {
    console.log(`  · ${(v.classification?.titleVi ?? v.title).slice(0, 62)}`);
  }

  if (!ghiThat) {
    console.log("\nThêm --ghi để loại thật.");
    await prisma.$disconnect();
    return;
  }

  const kq = await prisma.contentItem.updateMany({
    where: DIEU_KIEN,
    data: { status: "rejected" },
  });

  const conLai = await prisma.contentItem.count({ where: { status: "classified" } });
  console.log(`\nĐã loại ${kq.count}. Còn ${conLai} nội dung trong phần hiển thị.`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("Lỗi:", e instanceof Error ? e.message : e);
  await prisma.$disconnect();
  process.exit(1);
});
