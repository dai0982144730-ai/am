/**
 * Dựng hồ sơ gu cá nhân.
 *
 *   npx tsx scripts/dung-ho-so-gu.ts          dựng nếu đủ dữ liệu mới
 *   npx tsx scripts/dung-ho-so-gu.ts --ep     dựng lại kể cả khi bản cũ còn mới
 */

import "dotenv/config";

import { prisma } from "../src/lib/db/prisma";
import { dungHoSoGu } from "../src/lib/caNhanHoa/dungHoSoGu";

async function main() {
  const kq = await dungHoSoGu(process.argv.includes("--ep"));

  if (!kq.daDung) {
    console.log(`Không dựng: ${kq.lyDo}`);
  } else {
    console.log(`Đã dựng bản ${kq.phienBan} — độ tin cậy ${kq.doTinCay}, từ ${kq.soTinHieu} tín hiệu`);
  }

  const ban = await prisma.userTasteProfile.findFirst({
    orderBy: { version: "desc" },
  });
  if (ban) {
    console.log(`\n── Bản ${ban.version}, dựng ${ban.createdAt.toLocaleString("vi-VN")}`);
    console.log("Chủ đề ưa thích:", JSON.stringify(ban.preferredSubtopics, null, 1));
    console.log("Thời lượng:", ban.preferredDurationMin, "–", ban.preferredDurationMax, "giây");
    console.log("Kiểu giọng:", ban.preferredNarrationType, "| ngôn ngữ:", ban.preferredLanguages.join(", "));
    console.log("Gu theo khung giờ:", JSON.stringify(ban.moodSchedule));
    console.log("Né tránh:", JSON.stringify(ban.dislikedPatterns));
    console.log("\n" + ban.freeformSummary);
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e instanceof Error ? e.message : e);
  await prisma.$disconnect();
  process.exit(1);
});
