/**
 * Thuật lại các bài viết tiếng nước ngoài sang tiếng Việt.
 *
 *   npx tsx scripts/thuat-lai.ts            # 3 bài
 *   npx tsx scripts/thuat-lai.ts --so 10
 *   npx tsx scripts/thuat-lai.ts --xem      # in thử một bản ra màn hình
 *
 * Đây là phần cốt lõi của Phase 2: bù độ trễ tin AI bằng cách đọc thẳng nguồn
 * nước ngoài rồi kể lại bằng tiếng Việt.
 */

import "dotenv/config";

import { prisma } from "../src/lib/db/prisma";
import { thuatLaiHangLoat } from "../src/lib/llm/luuThuatLai";

function thamSo(ten: string): number | undefined {
  const vt = process.argv.indexOf(`--${ten}`);
  if (vt === -1) return undefined;
  const so = Number(process.argv[vt + 1]);
  return Number.isFinite(so) && so > 0 ? so : undefined;
}

async function xemThu() {
  const ban = await prisma.narrationAsset.findFirst({
    orderBy: { generatedAt: "desc" },
    include: {
      contentItem: { select: { title: true, url: true, source: { select: { title: true } } } },
    },
  });

  if (!ban) {
    console.log("Chưa có bản thuật lại nào. Chạy không kèm --xem để tạo.");
    return;
  }

  console.log(`\n${"═".repeat(70)}`);
  console.log(ban.contentItem.title);
  console.log(`${ban.contentItem.source.title} · ${ban.contentItem.url}`);
  console.log(`${"═".repeat(70)}\n`);
  console.log(ban.scriptText);
  console.log(`\n${"═".repeat(70)}`);
  console.log(`${ban.scriptText.length} ký tự tiếng Việt`);
}

async function main() {
  if (process.argv.includes("--xem")) {
    await xemThu();
    return;
  }

  const gioiHan = thamSo("so") ?? 3;

  const conCho = await prisma.contentItem.count({
    where: {
      type: { in: ["blog_article", "forum_post"] },
      narrationAsset: null,
      transcript: { fetchStatus: "success" },
    },
  });

  console.log(`Bài viết chưa có bản tiếng Việt: ${conCho}`);
  console.log(`Lần này thuật lại tối đa: ${gioiHan}\n`);

  if (conCho === 0) {
    console.log("Không có gì để làm. Chạy scripts/quet-blog.ts trước.");
    return;
  }

  const kq = await thuatLaiHangLoat(gioiHan, (dong) => console.log(dong));

  console.log(`\nĐã xét ${kq.daXet} bài`);
  console.log(`  Thuật lại xong:     ${kq.thanhCong}`);
  console.log(`  Bỏ qua (tiếng Việt sẵn): ${kq.boQuaVietSan}`);
  console.log(`  Lỗi:                ${kq.loi}`);

  if (kq.thanhCong > 0) {
    console.log(
      `\nXem thử một bản: npx tsx scripts/thuat-lai.ts --xem`,
    );
  }
}

main().catch((loi) => {
  console.error("\n✗ Lỗi:", loi instanceof Error ? loi.message : loi);
  process.exit(1);
});
