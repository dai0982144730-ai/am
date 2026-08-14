/**
 * Quét ngay theo các từ khoá đang bật, không đợi tới lần chạy đêm.
 *
 *   npx tsx scripts/quet-tu-khoa.ts
 *
 * Vừa gõ một từ khoá mới mà muốn xem ngay có gì thì chạy lệnh này. Nhớ là mỗi
 * từ khoá tốn 100 đơn vị hạn mức, chạy tay nhiều lần trong ngày thì đêm đó
 * phần quét kênh sẽ thiếu hạn mức.
 */

import "dotenv/config";

import { prisma } from "../src/lib/db/prisma";
import { quetTuKhoaQuanTam } from "../src/lib/quanTam/quetTuKhoa";
import { xemTinhHinh } from "../src/lib/youtube/hanMuc";

async function main() {
  const truoc = await xemTinhHinh();
  console.log(
    `Hạn mức trước khi chạy: đã dùng ${truoc.daDung}/${truoc.nganSach}\n`,
  );

  const kq = await quetTuKhoaQuanTam();

  if (kq.cacTuKhoa.length === 0) {
    console.log("Chưa đặt từ khoá nào. Vào trang /quan-tam để thêm.");
    await prisma.$disconnect();
    return;
  }

  for (const tu of kq.cacTuKhoa) {
    if (tu.loi) {
      console.log(`  ✗ "${tu.tuKhoa}" — ${tu.loi}`);
    } else {
      console.log(
        `  ✓ "${tu.tuKhoa}" — tìm thấy ${tu.soTimThay}, thêm mới ${tu.soThemMoi}`,
      );
    }
  }

  const sau = await xemTinhHinh();
  console.log(
    `\nThêm tổng cộng ${kq.tongThemMoi} nội dung.` +
      ` Hạn mức đã dùng: ${sau.daDung}/${sau.nganSach}.`,
  );
  console.log(
    "Chạy tiếp `npx tsx scripts/phan-loai.ts` rồi `cham-diem.ts` để chúng vào bản tin.",
  );

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
