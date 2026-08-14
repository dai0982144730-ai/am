/**
 * Vòng 2 của việc chấm chất lượng — Claude đọc bình luận thật.
 *
 *   npx tsx scripts/doc-binh-luan.ts            # 20 ứng viên đứng đầu
 *   npx tsx scripts/doc-binh-luan.ts --so 40
 *
 * Đây là mảnh ghép phân biệt web này với việc chỉ sắp xếp theo lượt xem: nó
 * nhận ra được video nhiều bình luận nhưng toàn emoji, và video bị người xem tố
 * tiêu đề sai nội dung.
 *
 * Sau khi chấm xong, script tự chạy lại phần tính điểm để thứ hạng cập nhật.
 */

import "dotenv/config";

import { prisma } from "../src/lib/db/prisma";
import { chamDiemHangLoat } from "../src/lib/scoring/chamDiem";
import { chayVongHai } from "../src/lib/scoring/vongHaiBinhLuan";

function thamSo(ten: string): number | undefined {
  const vt = process.argv.indexOf(`--${ten}`);
  if (vt === -1) return undefined;
  const so = Number(process.argv[vt + 1]);
  return Number.isFinite(so) && so > 0 ? so : undefined;
}

async function main() {
  const soUngVien = thamSo("so") ?? 20;

  const chuaCham = await prisma.contentItem.count({
    where: {
      type: "video",
      status: "classified",
      commentAnalysis: null,
      contentGroup: { not: "music" },
      commentCount: { gte: 3 },
    },
  });

  console.log(`Video đủ điều kiện chưa đọc bình luận: ${chuaCham}`);
  console.log(`Lần này xét ${soUngVien} ứng viên đứng đầu\n`);

  if (chuaCham === 0) {
    console.log("Không có gì để làm.");
    return;
  }

  const kq = await chayVongHai(soUngVien, (dong) => console.log(dong));

  console.log(`\n─────────────────────────────────────────`);
  console.log(`Đã xét:            ${kq.daXet}`);
  console.log(`  Chấm xong:       ${kq.daCham}`);
  console.log(`  Quá ít bình luận: ${kq.itBinhLuan}`);
  console.log(`  Lỗi:             ${kq.loi}`);

  if (kq.daCham > 0) {
    console.log(`\nĐiểm thảo luận trung bình: ${kq.diemTrungBinh.toFixed(2)}`);
    console.log(`Cờ đã gắn:`);
    console.log(`  bị tố tiêu đề sai nội dung: ${kq.toClickbait}`);
    console.log(`  bình luận toàn emoji:       ${kq.toanEmoji}`);
    console.log(`  khen đúng chi tiết cụ thể:  ${kq.khenChiTiet}`);

    console.log(`\nTính lại điểm để thứ hạng cập nhật…`);
    const cham = await chamDiemHangLoat();
    console.log(`  Đã chấm lại ${cham.daCham} nội dung`);

    // So sánh trước/sau: đây là phép thử thật của cả vòng 2
    const dauBang = await prisma.contentItem.findMany({
      where: { score: { isNot: null } },
      include: {
        score: true,
        source: { select: { title: true } },
        commentAnalysis: true,
      },
      orderBy: { score: { compositeScore: "desc" } },
      take: 8,
    });

    console.log(`\nTám nội dung điểm cao nhất SAU khi đọc bình luận:\n`);
    for (const [i, muc] of dauBang.entries()) {
      const co = muc.commentAnalysis;
      console.log(
        `${String(i + 1).padStart(2)}. ${(muc.score?.compositeScore ?? 0).toFixed(1)} — ${muc.title.slice(0, 50)}`,
      );
      console.log(
        `      ${muc.contentGroup} · thảo luận ${
          co ? co.discussionQualityScore.toFixed(2) : "chưa đọc"
        }`,
      );
    }
  }
}

main().catch((loi) => {
  console.error("\n✗ Lỗi:", loi instanceof Error ? loi.message : loi);
  process.exit(1);
});
