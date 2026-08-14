/**
 * Đi tìm nội dung ngoài vùng đã theo dõi.
 *
 *   npx tsx scripts/tim-nguon-moi.ts [số chủ đề]
 *
 * Mỗi chủ đề tốn 101 đơn vị hạn mức YouTube (100 cho lệnh tìm + 1 cho lệnh lấy
 * chi tiết). Mặc định 6 chủ đề = khoảng 6% ngân sách ngày.
 *
 * Thứ tìm được **không vào thẳng trang chủ**. Nó nằm ở trạng thái chờ, đi qua
 * đúng dây chuyền lấy lời thoại → Claude đọc → chấm điểm như mọi nội dung khác,
 * rồi mới cạnh tranh vào phần "nguồn mới" theo tỉ lệ đặt trong Cài đặt.
 */

import "dotenv/config";

import { prisma } from "../src/lib/db/prisma";
import { chamUyTinNguonLa } from "../src/lib/khamPha/uyTinNguon";
import { chonChuDeDeTim, timNguonMoi } from "../src/lib/khamPha/timNguonMoi";
import { xemTinhHinh } from "../src/lib/youtube/hanMuc";

async function main() {
  const soChuDe = Number(process.argv[2]) || 6;

  const truoc = await xemTinhHinh();
  console.log(`Hạn mức trước khi chạy: ${truoc.daDung}/${truoc.nganSach}\n`);

  // ----- Nguồn nào đã bị chê -----
  const uyTin = await chamUyTinNguonLa();
  const biBo = uyTin.filter((u) => u.nenBo);
  if (biBo.length > 0) {
    console.log(`Thôi lấy bài từ ${biBo.length} nguồn:`);
    for (const n of biBo) console.log(`  ✗ ${n.tenNguon} — ${n.lyDo}`);
    console.log();
  }

  // ----- Chủ đề đem đi tìm -----
  const chuDe = await chonChuDeDeTim(soChuDe);
  if (chuDe.length === 0) {
    console.log(
      "Chưa đủ nội dung điểm cao để rút ra chủ đề nào.\n" +
        "Cần chấm điểm thêm đã — chạy `npx tsx scripts/cham-diem.ts`.",
    );
    await prisma.$disconnect();
    return;
  }

  console.log(`Đem ${chuDe.length} chủ đề đi tìm (rút từ nội dung bạn chấm cao):`);
  for (const c of chuDe) {
    console.log(`  · "${c.chuDe}" — gặp ${c.soLanXuatHien} lần, mảng ${c.nhom}`);
  }
  console.log();

  const kq = await timNguonMoi(soChuDe);

  for (const c of kq.cacChuDe) {
    if (c.loi) {
      console.log(`✗ "${c.chuDe}" — ${c.loi}`);
      continue;
    }
    console.log(
      `✓ "${c.chuDe}": tìm ${c.soTimThay}, đã có ${c.soDaCo}, ` +
        `lọc bỏ ${c.soBiLoc}, thêm mới ${c.soThemMoi}` +
        (c.soKenhMoi ? ` (${c.soKenhMoi} kênh chưa từng gặp)` : ""),
    );
    // Gộp lý do bị loại lại để thấy luật nào đang gạt nhiều nhất
    if (c.lyDoBiLoc.length > 0) {
      const gom = new Map<string, number>();
      for (const l of c.lyDoBiLoc) {
        const goc = l.replace(/\d+([.,]\d+)?/g, "N");
        gom.set(goc, (gom.get(goc) ?? 0) + 1);
      }
      for (const [ly, so] of gom) console.log(`     ${so}× ${ly}`);
    }
  }

  const sau = await xemTinhHinh();
  console.log(
    `\nThêm ${kq.tongThemMoi} nội dung từ ${kq.tongKenhMoi} kênh chưa từng gặp.`,
  );
  console.log(`Hạn mức đã dùng: ${sau.daDung}/${sau.nganSach}.`);
  console.log(
    "\nChúng đang ở trạng thái chờ. Chạy tiếp `lay-loi-thoai.ts`," +
      " `phan-loai.ts`, `cham-diem.ts` để chúng đủ điều kiện lên trang chủ.",
  );

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
