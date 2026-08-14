/**
 * Xử lý nhánh nhạc và chấm điểm chất lượng toàn kho.
 *
 *   npx tsx scripts/cham-diem.ts
 *
 * Chạy được nhiều lần: điểm được tính lại từ đầu mỗi lần, vì tập tham chiếu
 * thay đổi khi kho lớn lên — một video từng đứng đầu có thể tụt xuống khi có
 * video tốt hơn vào kho.
 */

import "dotenv/config";

import { prisma } from "../src/lib/db/prisma";
import { xuLyNhacHangLoat } from "../src/lib/music/xuLyNhac";
import { chamDiemHangLoat, dungTrongSoMacDinh } from "../src/lib/scoring/chamDiem";

const TEN_LOAI_NGUON: Record<string, string> = {
  youtube_channel: "Kênh YouTube",
  blog_feed: "Blog",
  forum_community: "Diễn đàn",
  podcast_rss: "Podcast",
  soundcloud_channel: "SoundCloud",
};

async function main() {
  console.log("[1/3] Xử lý nhánh nhạc (hoàn toàn bằng luật, không gọi mô hình)…");
  const nhac = await xuLyNhacHangLoat(200, (dong) => console.log(dong));
  if (nhac.daXet === 0) {
    console.log("  (chưa có bản nhạc nào trong kho)");
  } else {
    console.log(`\n  Đã xử lý: ${nhac.daGhi}/${nhac.daXet}`);
    console.log(`  Đọc được số nhịp:  ${nhac.docDuocBpm}`);
    console.log(`  Đoán được thể loại: ${nhac.doanDuocTheLoai}`);
    console.log(`  Chưa rõ thể loại:   ${nhac.khongRoTheLoai}`);
  }

  console.log("\n[2/3] Dựng bộ trọng số mặc định cho từng loại nguồn…");
  const so = await dungTrongSoMacDinh();
  console.log(`  ${so} bộ trọng số (chỉnh được trong Cài đặt ở Phase sau)`);

  console.log("\n[3/3] Chấm điểm chất lượng…");
  const kq = await chamDiemHangLoat((dong) => console.log(dong));

  console.log(`\n─────────────────────────────────────────`);
  console.log(`Đã chấm: ${kq.daCham} nội dung`);
  for (const [loai, so] of Object.entries(kq.theoLoaiNguon)) {
    console.log(`  ${(TEN_LOAI_NGUON[loai] ?? loai).padEnd(14)} ${so}`);
  }
  console.log(`Điểm: từ ${kq.diemThapNhat} tới ${kq.diemCaoNhat} (thang 10)`);

  // Xem thử mười nội dung đứng đầu — đây là phép thử thật của cả engine
  const dauBang = await prisma.contentItem.findMany({
    where: { score: { isNot: null } },
    include: {
      source: { select: { title: true, type: true } },
      score: true,
    },
    orderBy: { score: { compositeScore: "desc" } },
    take: 10,
  });

  console.log(`\nMười nội dung điểm cao nhất:\n`);
  for (const [i, muc] of dauBang.entries()) {
    const d = muc.score;
    console.log(
      `${String(i + 1).padStart(2)}. ${(d?.compositeScore ?? 0).toFixed(1).padStart(4)} — ${muc.title.slice(0, 52)}`,
    );
    console.log(
      `      ${muc.source.title.slice(0, 30)} · ${muc.contentGroup} · ` +
        `phổ biến ${d?.popularityScore?.toFixed(2) ?? "—"} · ` +
        `tương tác ${d?.engagementDepthScore?.toFixed(2) ?? "—"} · ` +
        `thảo luận ${d?.discussionQualityScore?.toFixed(2) ?? "—"} · ` +
        `uy tín ${d?.sourceAuthorityScore?.toFixed(2) ?? "—"}`,
    );
  }
}

main().catch((loi) => {
  console.error("\n✗ Lỗi:", loi instanceof Error ? loi.message : loi);
  process.exit(1);
});
