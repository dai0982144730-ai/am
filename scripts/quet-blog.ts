/**
 * Quét bài mới từ blog và diễn đàn AI.
 *
 *   npx tsx scripts/quet-blog.ts              # 10 bài mỗi nguồn, 7 ngày gần đây
 *   npx tsx scripts/quet-blog.ts --bai 20
 *   npx tsx scripts/quet-blog.ts --ngay 30
 *
 * Lần đầu chạy sẽ tự dựng danh sách nguồn. Chạy lại an toàn: bài đã có thì bỏ
 * qua, không tải lại.
 */

import "dotenv/config";

import { prisma } from "../src/lib/db/prisma";
import { dungDanhSachNguon, quetBlog } from "../src/lib/nguon/quetBlog";

function thamSo(ten: string): number | undefined {
  const vt = process.argv.indexOf(`--${ten}`);
  if (vt === -1) return undefined;
  const so = Number(process.argv[vt + 1]);
  return Number.isFinite(so) && so > 0 ? so : undefined;
}

async function main() {
  const soBai = thamSo("bai") ?? 10;
  const soNgay = thamSo("ngay") ?? 7;

  console.log("[1/2] Dựng danh sách nguồn…");
  const nguon = await dungDanhSachNguon();
  console.log(`  Nguồn thêm mới: ${nguon.themMoi}, đã có sẵn: ${nguon.daCo}`);

  console.log(
    `\n[2/2] Quét tối đa ${soBai} bài mỗi nguồn, trong ${soNgay} ngày gần đây…`,
  );
  const kq = await quetBlog(soBai, soNgay, (dong) => console.log(dong));

  console.log(`\n─────────────────────────────────────────`);
  console.log(`Số nguồn đã quét:      ${kq.soNguonQuet}`);
  console.log(`Số bài đã xét:         ${kq.soBaiXet}`);
  console.log(`Bài thêm vào kho:      ${kq.soBaiThemMoi}`);
  console.log(`  lấy được chữ:        ${kq.soLayDuocToanVan}`);
  console.log(`  không lấy được:      ${kq.soChiCoTomTat}`);

  if (kq.nguonLoi.length > 0) {
    console.log(`\n${kq.nguonLoi.length} nguồn lỗi:`);
    kq.nguonLoi.forEach((l) => console.log(`  - ${l.ten}: ${l.lyDo}`));
  }

  const tongBaiViet = await prisma.contentItem.count({
    where: { type: { in: ["blog_article", "forum_post"] } },
  });
  console.log(`\nTổng bài viết trong kho: ${tongBaiViet}`);
}

main().catch((loi) => {
  console.error("\n✗ Lỗi:", loi instanceof Error ? loi.message : loi);
  process.exit(1);
});
