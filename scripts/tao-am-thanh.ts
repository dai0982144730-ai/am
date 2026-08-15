/**
 * Đọc thành tiếng bản tin sáng và các bản thuật lại.
 *
 *   npx tsx scripts/tao-am-thanh.ts [số bản thuật lại]
 *
 * Chạy được nhiều lần: bản nào đã có audio thì bỏ qua. Đọc lại thứ đã đọc là
 * ném tiền qua cửa sổ, vì hạn mức tính theo ký tự gửi đi chứ không quan tâm
 * kết quả có được dùng hay không.
 */

import "dotenv/config";

import { prisma } from "../src/lib/db/prisma";
import { daCauHinh } from "../src/lib/tts/doc";
import { timGiong } from "../src/lib/tts/giong";
import { NGUONG_KHOA, xemTinhHinh } from "../src/lib/tts/hanMuc";
import {
  taoAmThanhChoBanTin,
  taoAmThanhChoThuatLai,
} from "../src/lib/tts/taoAmThanh";

async function main() {
  if (!daCauHinh()) {
    console.log(
      "Chưa có TTS_API_KEY trong .env.\n" +
        "Bật Cloud Text-to-Speech API trong Google Cloud, tạo khoá, rồi thêm\n" +
        "dòng TTS_API_KEY=... vào .env.",
    );
    await prisma.$disconnect();
    return;
  }

  const soBan = Number(process.argv[2]) || 5;

  const caiDat = await prisma.userAssistantSettings.findUnique({
    where: { id: "singleton" },
    select: { ttsVoice: true },
  });
  const giong = timGiong(caiDat?.ttsVoice);

  const truoc = await xemTinhHinh();
  console.log(`Giọng: ${giong.ten}`);
  console.log(
    `Hạn mức trước khi chạy: ${truoc.daDung.toLocaleString("vi-VN")}/` +
      `${truoc.tran.toLocaleString("vi-VN")} (${(truoc.phanTram * 100).toFixed(2)}%)\n`,
  );

  if (truoc.daKhoa) {
    console.log(
      `Đã chạm ngưỡng khoá ${Math.round(NGUONG_KHOA * 100)}% — Am tự dừng để\n` +
        `không phát sinh tiền. Sang tháng sau tự mở lại.`,
    );
    await prisma.$disconnect();
    return;
  }

  // ----- Bản tin sáng trước, vì nó đáng nghe nhất mà lại rẻ nhất -----
  console.log("Bản tin sáng:");
  const bt = await taoAmThanhChoBanTin();
  console.log(
    bt.daTao
      ? `  ✓ đọc xong → ${bt.duongDan}`
      : `  – ${bt.lyDo}${bt.duongDan ? ` (${bt.duongDan})` : ""}`,
  );

  // ----- Rồi tới các bản thuật lại -----
  console.log(`\nBản thuật lại (tối đa ${soBan}):`);
  const kq = await taoAmThanhChoThuatLai(soBan);

  if (kq.daXet === 0) {
    console.log("  – mọi bản thuật lại đều đã có audio");
  } else {
    console.log(
      `  đọc xong ${kq.thanhCong}/${kq.daXet}, tiêu ${kq.soKyTu.toLocaleString("vi-VN")} ký tự`,
    );
  }

  if (kq.hetHanMuc) {
    console.log(
      `  ! dừng giữa chừng vì chạm ngưỡng khoá ${Math.round(NGUONG_KHOA * 100)}%`,
    );
  }
  for (const l of kq.loi) console.log(`  ✗ ${l.ten} — ${l.lyDo}`);

  const sau = await xemTinhHinh();
  console.log(
    `\nHạn mức sau khi chạy: ${sau.daDung.toLocaleString("vi-VN")}/` +
      `${sau.tran.toLocaleString("vi-VN")} (${(sau.phanTram * 100).toFixed(2)}%)`,
  );
  if (sau.sapHet && !sau.daKhoa) {
    console.log(
      `Sắp hết — qua ${Math.round(NGUONG_KHOA * 100)}% là Am tự dừng tới tháng sau.`,
    );
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
