/**
 * Đọc playlist về rồi nhờ Claude đề xuất nên bỏ video nào vào đâu.
 *
 *   npx tsx scripts/de-xuat-playlist.ts
 *
 * **Không ghi gì lên YouTube.** Script này chỉ đọc và sinh đề xuất. Muốn ghi
 * thật thì vào trang `/playlist`, bấm duyệt rồi bấm ghi từng cái một.
 */

import "dotenv/config";

import { prisma } from "../src/lib/db/prisma";
import { sinhDeXuat } from "../src/lib/playlist/deXuat";
import { dongBoPlaylist } from "../src/lib/playlist/dongBo";

async function main() {
  console.log("Đọc playlist từ YouTube…");
  const dongBo = await dongBoPlaylist();
  console.log(
    `  ${dongBo.soDoc} playlist (${dongBo.themMoi} mới, ${dongBo.capNhat} cập nhật)\n`,
  );

  const choSapXep = await prisma.youTubePlaylist.count({
    where: { managedByAI: true },
  });

  if (choSapXep === 0) {
    console.log(
      "Chưa bật playlist nào cho trợ lý sắp xếp.\n" +
        "Vào /playlist bấm nút bên cạnh playlist bạn muốn, rồi chạy lại lệnh này.\n" +
        "(Không bật cái nào thì trợ lý chỉ biết đề nghị tạo playlist mới.)",
    );
  }

  console.log("Nhờ Claude xem qua và đề xuất…");
  const kq = await sinhDeXuat(10);

  console.log(
    `\nXét ${kq.daXet} video: đề xuất ${kq.soDeXuat}, bỏ qua ${kq.soBoQua}` +
      (kq.soPlaylistMoi ? `, trong đó ${kq.soPlaylistMoi} đề nghị lập playlist mới` : ""),
  );

  if (kq.loi.length > 0) {
    console.log(`\n${kq.loi.length} video lỗi:`);
    for (const l of kq.loi) console.log(`  ✗ "${l.video}…" — ${l.lyDo}`);
  }

  const cho = await prisma.playlistOrganizationSuggestion.findMany({
    where: { status: "pending" },
    select: {
      reason: true,
      newPlaylistTitle: true,
      contentItem: { select: { title: true } },
      suggestedPlaylist: { select: { title: true } },
    },
  });

  if (cho.length > 0) {
    console.log(`\nĐang chờ bạn quyết (${cho.length}):`);
    for (const d of cho) {
      const ten = d.suggestedPlaylist?.title ?? `${d.newPlaylistTitle} (mới)`;
      console.log(`\n  "${d.contentItem.title}"`);
      console.log(`    → ${ten}`);
      console.log(`    ${d.reason}`);
    }
    console.log(`\nVào http://localhost:3000/playlist để duyệt.`);
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
