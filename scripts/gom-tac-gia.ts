/**
 * Gom tên tác giả thô thành bảng `Author`, rồi nối các nội dung vào đó.
 *
 *   npx tsx scripts/gom-tac-gia.ts        # xem sẽ gom thế nào, chưa ghi
 *   npx tsx scripts/gom-tac-gia.ts --ghi  # ghi thật
 *
 * Đây là phần mở khoá hai nút đang làm mờ trong giao diện — "Giảng sư" ở mục
 * Triết học và "Tác giả" ở mục Truyện.
 *
 * ## Tác giả do máy phát hiện LUÔN vào diện chờ duyệt
 *
 * Bản thiết kế nói rõ: chỉ tên chủ nhà tự nhập mới có hiệu lực đầy đủ ngay;
 * tên do Claude rút ra phải được duyệt tay một lần. Nên mọi tác giả tạo ở đây
 * đều mang `origin = llm_discovered`, `pendingReview = true`,
 * `approvedByUser = false`.
 *
 * Chưa duyệt KHÔNG có nghĩa là không dùng được: bộ lọc vẫn bày ra để chọn. Cái
 * chờ duyệt là phần cộng điểm uy tín vào công thức chấm chất lượng — đó mới là
 * chỗ một tên sai gây hại thật.
 */

import "dotenv/config";

import type { AuthorDomain, ContentGroup } from "../src/generated/prisma/enums";
import { prisma } from "../src/lib/db/prisma";
import { gomTen, khoaTen } from "../src/lib/tacGia/gomTen";

/** Chuyên mục nào thì tác giả thuộc lĩnh vực nào. */
const LINH_VUC: Partial<Record<ContentGroup, AuthorDomain>> = {
  triet_hoc: "philosophy_teacher",
  truyen: "story_writer",
  ai: "ai_blog_source",
  music: "music_curator",
};

async function main() {
  const ghiThat = process.argv.includes("--ghi");

  const banGhi = await prisma.contentClassification.findMany({
    where: { extractedAuthorNameRaw: { not: null } },
    select: {
      id: true,
      extractedAuthorNameRaw: true,
      contentItem: { select: { contentGroup: true } },
    },
  });

  console.log(`Bản ghi có tên tác giả: ${banGhi.length}`);

  // Gom riêng theo từng lĩnh vực. Cùng một tên ở hai lĩnh vực khác nhau thì là
  // hai người khác nhau — bảng Author cũng khoá theo cặp (tên, lĩnh vực).
  const theoLinhVuc = new Map<AuthorDomain, string[]>();
  for (const b of banGhi) {
    const lv = LINH_VUC[b.contentItem.contentGroup];
    if (!lv || !b.extractedAuthorNameRaw) continue;
    const ds = theoLinhVuc.get(lv) ?? [];
    ds.push(b.extractedAuthorNameRaw);
    theoLinhVuc.set(lv, ds);
  }

  let tongTacGia = 0;
  let tongGopChung = 0;

  for (const [linhVuc, cacTen] of theoLinhVuc) {
    const nhom = gomTen(cacTen);
    const goc = new Set(cacTen.map((t) => t.trim()).filter(Boolean)).size;
    tongTacGia += nhom.size;

    console.log(
      `\n── ${linhVuc}: ${goc} cách viết → ${nhom.size} người`,
    );

    for (const [, n] of [...nhom].sort((a, b) => b[1].soLan - a[1].soLan)) {
      if (n.bietDanh.length > 0) {
        tongGopChung += 1;
        console.log(
          `   ${String(n.soLan).padStart(3)}× ${n.tenChuan.slice(0, 34).padEnd(34)} ← cũng viết: ${n.bietDanh.join(", ").slice(0, 46)}`,
        );
      }
    }

    if (!ghiThat) continue;

    for (const [, n] of nhom) {
      const tacGia = await prisma.author.upsert({
        where: {
          canonicalName_domain: {
            canonicalName: n.tenChuan,
            domain: linhVuc,
          },
        },
        create: {
          canonicalName: n.tenChuan,
          aliases: n.bietDanh,
          domain: linhVuc,
          origin: "llm_discovered",
          pendingReview: true,
          approvedByUser: false,
        },
        update: { aliases: n.bietDanh },
        select: { id: true },
      });

      // Nối mọi bản ghi có tên rơi vào nhóm này
      const khoaNhom = khoaTen(n.tenChuan);
      const canNoi = banGhi.filter(
        (b) =>
          b.extractedAuthorNameRaw &&
          LINH_VUC[b.contentItem.contentGroup] === linhVuc &&
          khoaTen(b.extractedAuthorNameRaw) === khoaNhom,
      );

      await prisma.contentClassification.updateMany({
        where: { id: { in: canNoi.map((b) => b.id) } },
        data: { authorId: tacGia.id },
      });
    }
  }

  console.log("\n" + "=".repeat(58));
  console.log(`Tổng số người:      ${tongTacGia}`);
  console.log(`Trong đó gộp được:  ${tongGopChung} người có nhiều cách viết`);

  if (!ghiThat) {
    console.log("\nChưa ghi gì. Thêm --ghi để lưu thật.");
  } else {
    const daNoi = await prisma.contentClassification.count({
      where: { authorId: { not: null } },
    });
    console.log(`Đã nối:             ${daNoi} nội dung vào tác giả`);
    console.log("\nTất cả đều ở diện CHỜ DUYỆT — đúng bản thiết kế.");
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("Lỗi:", e instanceof Error ? e.message : e);
  await prisma.$disconnect();
  process.exit(1);
});
