/**
 * Thử phần theo dõi việc xem — chạy thẳng vào database, không qua giao diện.
 *
 * VÌ SAO CẦN: trình duyệt trong ứng dụng không có phiên đăng nhập, mà mọi thao
 * tác ghi ở đây đều chỉ dành cho chủ dự án. Không có script này thì chỉ kiểm
 * được phần khách nhìn thấy, còn phần lõi — ghi vị trí, đồng bộ hai máy, chấm
 * sao — thì không chứng minh được là chạy đúng.
 *
 * Kịch bản diễn lại đúng thứ bản thiết kế đòi: xem dở trên máy tính, mở điện
 * thoại nghe tiếp đúng chỗ.
 *
 *   npx tsx scripts/thu-tieu-thu.ts
 */

import "dotenv/config";

import { prisma } from "../src/lib/db/prisma";

async function main() {
  const muc = await prisma.contentItem.findFirst({
    where: { status: "classified", url: { contains: "watch?v=" } },
    orderBy: { score: { compositeScore: { sort: "desc", nulls: "last" } } },
    select: {
      id: true,
      title: true,
      durationSeconds: true,
      contentGroup: true,
    },
  });

  if (!muc) throw new Error("Kho chưa có video nào để thử.");

  console.log(`Video thử: "${muc.title}"`);
  console.log(`  dài ${muc.durationSeconds}s, chuyên mục ${muc.contentGroup}\n`);

  // Dọn dấu vết lần thử trước để chạy lại nhiều lần vẫn cho kết quả như nhau
  await prisma.consumptionEvent.deleteMany({ where: { contentItemId: muc.id } });
  await prisma.consumptionSession.deleteMany({
    where: { contentItemId: muc.id },
  });
  await prisma.resumePoint.deleteMany({ where: { contentItemId: muc.id } });

  // ----- Cảnh 1: xem trên máy tính, tới phút 8 thì bỏ dở -----
  const phienDesktop = await prisma.consumptionSession.create({
    data: { contentItemId: muc.id, deviceType: "desktop", replayCount: 0 },
  });

  for (const [loai, giay] of [
    ["play", 0],
    ["pause", 300],
    ["play", 300],
    ["abandon", 480],
  ] as const) {
    await prisma.consumptionEvent.create({
      data: {
        sessionId: phienDesktop.id,
        contentItemId: muc.id,
        eventType: loai,
        positionSeconds: giay,
        deviceType: "desktop",
      },
    });
  }

  const tong = muc.durationSeconds ?? 3600;
  await prisma.consumptionSession.update({
    where: { id: phienDesktop.id },
    data: {
      watchedSeconds: 480,
      percentComplete: 480 / tong,
      endedAt: new Date(),
    },
  });
  await prisma.resumePoint.create({
    data: {
      contentItemId: muc.id,
      positionSeconds: 480,
      lastDevice: "desktop",
    },
  });

  console.log("Cảnh 1 — xem trên máy tính, bỏ dở ở phút 8.");

  // ----- Cảnh 2: cầm điện thoại lên, phải thấy đúng chỗ đang dở -----
  const cho = await prisma.resumePoint.findUnique({
    where: { contentItemId: muc.id },
  });
  console.log(
    `Cảnh 2 — mở trên điện thoại: tiếp từ giây ${cho?.positionSeconds}` +
      ` (máy dừng lần trước: ${cho?.lastDevice})`,
  );
  if (cho?.positionSeconds !== 480) throw new Error("SAI: không nhớ đúng chỗ.");

  // ----- Cảnh 3: nghe nốt trên điện thoại tới hết -----
  const phienMobile = await prisma.consumptionSession.create({
    data: { contentItemId: muc.id, deviceType: "mobile", replayCount: 0 },
  });
  await prisma.consumptionEvent.create({
    data: {
      sessionId: phienMobile.id,
      contentItemId: muc.id,
      eventType: "complete",
      positionSeconds: tong,
      deviceType: "mobile",
    },
  });
  await prisma.consumptionSession.update({
    where: { id: phienMobile.id },
    data: {
      watchedSeconds: tong - 480,
      percentComplete: 1,
      completed: true,
      endedAt: new Date(),
      explicitRating: 4,
      emotionTags: ["đáng suy ngẫm", "quá dài"],
    },
  });
  // Xem xong thì chỗ đang dở phải biến mất
  await prisma.resumePoint.deleteMany({ where: { contentItemId: muc.id } });

  const conCho = await prisma.resumePoint.findUnique({
    where: { contentItemId: muc.id },
  });
  console.log(
    `Cảnh 3 — nghe hết trên điện thoại, chấm 4 sao. Chỗ đang dở: ${
      conCho ? "VẪN CÒN (sai)" : "đã xoá (đúng)"
    }`,
  );
  if (conCho) throw new Error("SAI: xem xong rồi mà vẫn còn chỗ đang dở.");

  // ----- Cảnh 4: mở lại lần nữa, phải biết đây là lần xem lại -----
  const soLanDaXem = await prisma.consumptionSession.count({
    where: { contentItemId: muc.id, completed: true },
  });
  console.log(`Cảnh 4 — mở lại: máy biết đã xem xong ${soLanDaXem} lần trước.`);
  if (soLanDaXem !== 1) throw new Error("SAI: đếm sai số lần đã xem.");

  // ----- Tổng kết -----
  const cacSuKien = await prisma.consumptionEvent.findMany({
    where: { contentItemId: muc.id },
    orderBy: { timestamp: "asc" },
    select: { eventType: true, positionSeconds: true, deviceType: true },
  });

  console.log("\nNhật ký hành vi đã ghi:");
  for (const sk of cacSuKien) {
    console.log(
      `  ${sk.eventType.padEnd(9)} giây ${String(sk.positionSeconds).padStart(5)}  (${sk.deviceType})`,
    );
  }

  const danhGia = await prisma.consumptionSession.findFirst({
    where: { contentItemId: muc.id, explicitRating: { not: null } },
    select: { explicitRating: true, emotionTags: true, replayCount: true },
  });
  console.log(
    `\nĐánh giá: ${danhGia?.explicitRating}/5 sao, cảm xúc: ${danhGia?.emotionTags.join(", ")}`,
  );

  // ----- Dọn sạch -----
  //
  // BẮT BUỘC PHẢI CÓ. Kịch bản trên vừa ghi "đã xem hết, chấm 4 sao" lên một
  // video thật mà chủ nhà chưa hề xem. Để lại thì phần học gu sau này sẽ tưởng
  // đó là thứ chủ nhà thích — dữ liệu thử mà lẫn vào dữ liệu thật thì còn tệ
  // hơn là không thử.
  await prisma.consumptionEvent.deleteMany({ where: { contentItemId: muc.id } });
  await prisma.consumptionSession.deleteMany({
    where: { contentItemId: muc.id },
  });
  await prisma.resumePoint.deleteMany({ where: { contentItemId: muc.id } });

  console.log("\nĐã dọn sạch dữ liệu thử.");
  console.log("Tất cả các cảnh đều đúng.");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
