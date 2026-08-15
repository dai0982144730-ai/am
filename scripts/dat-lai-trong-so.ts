/**
 * Đặt lại trọng số chấm điểm về giá trị mặc định trong code.
 *
 *   npx tsx scripts/dat-lai-trong-so.ts        # xem sẽ đổi gì, chưa ghi
 *   npx tsx scripts/dat-lai-trong-so.ts --ghi  # ghi thật
 *
 * ## Vì sao cần một lệnh riêng
 *
 * `dungTrongSoMacDinh()` cố ý **không bao giờ ghi đè** bộ trọng số đã có
 * (`update: {}`), để không xoá mất phần chủ nhà tự chỉnh trong Cài đặt. Đúng
 * trong trường hợp thường.
 *
 * Nhưng khi giá trị mặc định trong code được sửa vì phát hiện sai sót, thì bộ
 * cũ nằm trong database vẫn tiếp tục được dùng và bản sửa chẳng có tác dụng gì.
 * Lệnh này để đẩy giá trị mới xuống.
 *
 * **Nó ghi đè cả phần chủ nhà tự chỉnh** — nên mặc định chỉ in ra xem trước,
 * phải thêm `--ghi` mới thật sự ghi.
 */

import "dotenv/config";

import type { SourceType } from "../src/generated/prisma/enums";
import { prisma } from "../src/lib/db/prisma";
import { DEFAULT_WEIGHTS } from "../src/lib/scoring/normalize";

const TEN = {
  weightPopularity: "phổ biến",
  weightEngagementDepth: "tương tác",
  weightDiscussion: "thảo luận",
  weightAuthority: "uy tín",
  weightContentQuality: "chất lượng",
} as const;

async function main() {
  const ghiThat = process.argv.includes("--ghi");
  let soDoi = 0;

  for (const [loaiNguon, moi] of Object.entries(DEFAULT_WEIGHTS)) {
    const cu = await prisma.sourceQualityProfile.findUnique({
      where: { sourceType: loaiNguon as SourceType },
    });
    if (!cu) {
      console.log(`${loaiNguon}: chưa có trong database, bỏ qua`);
      continue;
    }

    const cap: [keyof typeof TEN, number, number][] = [
      ["weightPopularity", cu.weightPopularity, moi.popularity],
      ["weightEngagementDepth", cu.weightEngagementDepth, moi.engagementDepth],
      ["weightDiscussion", cu.weightDiscussion, moi.discussion],
      ["weightAuthority", cu.weightAuthority, moi.authority],
      ["weightContentQuality", cu.weightContentQuality, moi.contentQuality],
    ];

    const khac = cap.filter(([, a, b]) => Math.abs(a - b) > 0.001);
    if (khac.length === 0) continue;

    soDoi += 1;
    console.log(`\n${loaiNguon}`);
    for (const [truong, a, b] of khac) {
      console.log(`  ${TEN[truong].padEnd(11)} ${a}  →  ${b}`);
    }

    if (ghiThat) {
      await prisma.sourceQualityProfile.update({
        where: { sourceType: loaiNguon as SourceType },
        data: {
          weightPopularity: moi.popularity,
          weightEngagementDepth: moi.engagementDepth,
          weightDiscussion: moi.discussion,
          weightAuthority: moi.authority,
          weightContentQuality: moi.contentQuality,
        },
      });
    }
  }

  if (soDoi === 0) {
    console.log("Trọng số trong database đã khớp với mặc định trong code.");
  } else if (ghiThat) {
    console.log(`\nĐã ghi ${soDoi} bộ. Chạy tiếp:  npx tsx scripts/cham-diem.ts`);
  } else {
    console.log(`\n${soDoi} bộ sẽ đổi. Thêm --ghi để ghi thật.`);
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("Lỗi:", e instanceof Error ? e.message : e);
  await prisma.$disconnect();
  process.exit(1);
});
