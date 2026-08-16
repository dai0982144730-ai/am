/**
 * Đo và ghi lại độ dài thật của các bản đọc tiếng Việt đã tạo.
 *
 * Chạy một lần cho 29 file mp3 sinh ra trước khi `taoAmThanh.ts` biết tự đo.
 * Chạy lại nhiều lần cũng không sao — chỉ ghi vào bản nào còn để trống.
 *
 *   npx tsx scripts/do-dai-ban-doc.ts          xem sẽ ghi gì
 *   npx tsx scripts/do-dai-ban-doc.ts --ghi    ghi thật
 */

import "dotenv/config";
import path from "node:path";

import { prisma } from "../src/lib/db/prisma";
import { doDaiMp3 } from "../src/lib/tts/doDaiMp3";

const THU_MUC = path.join(process.cwd(), "public", "am-thanh");
const GHI = process.argv.includes("--ghi");

function docPhut(giay: number): string {
  return `${Math.floor(giay / 60)}ph${String(giay % 60).padStart(2, "0")}`;
}

async function main() {
  const cacBan = await prisma.narrationAsset.findMany({
    where: { ttsAudioUrl: { not: null }, durationSeconds: null },
    select: {
      id: true,
      ttsAudioUrl: true,
      contentItem: { select: { title: true, durationSeconds: true } },
    },
  });

  console.log(
    `${cacBan.length} bản đọc chưa ghi thời lượng${GHI ? "" : " (chạy thử, chưa ghi)"}\n`,
  );

  let daDo = 0;
  let khongDoDuoc = 0;
  let tongGocGiay = 0;
  let tongBanDocGiay = 0;

  for (const ban of cacBan) {
    const ten = path.basename(ban.ttsAudioUrl ?? "");
    const giay = await doDaiMp3(path.join(THU_MUC, ten));

    if (giay === null) {
      khongDoDuoc += 1;
      console.log(`  ✗ không đọc được header: ${ten}`);
      continue;
    }

    const goc = ban.contentItem.durationSeconds;
    daDo += 1;
    // Chỉ cộng vào phép so sánh khi bản gốc CÓ thời lượng. Phần lớn bản đọc là
    // của bài blog — bài viết không có thời lượng, nên gộp chúng vào thì tỷ lệ
    // ra một con số vô nghĩa
    if (goc) {
      tongGocGiay += goc;
      tongBanDocGiay += giay;
    }

    console.log(
      `  ${docPhut(giay)}  (gốc ${goc ? docPhut(goc) : "?"})  ${ban.contentItem.title.slice(0, 48)}`,
    );

    if (GHI) {
      await prisma.narrationAsset.update({
        where: { id: ban.id },
        data: { durationSeconds: giay },
      });
    }
  }

  console.log(`\nĐo được ${daDo}, không đọc được ${khongDoDuoc}`);
  if (tongGocGiay > 0) {
    const tyLe = Math.round((tongBanDocGiay / tongGocGiay) * 100);
    console.log(
      `Riêng những bản có clip gốc: bản đọc dài bằng ${tyLe}% clip gốc — đây ` +
        `chính là sai số trang Hàng chờ mắc phải nếu lấy nhầm thời lượng gốc.`,
    );
  }
  if (!GHI) console.log("\nThêm --ghi để ghi thật vào database.");

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e instanceof Error ? e.message : e);
  await prisma.$disconnect();
  process.exit(1);
});
