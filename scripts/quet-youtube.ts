/**
 * Quét video mới từ các kênh YouTube đã đăng ký.
 *
 *   npx tsx scripts/quet-youtube.ts                    # 7 ngày gần đây, mọi kênh
 *   npx tsx scripts/quet-youtube.ts --kenh 20          # chỉ 20 kênh, để chạy thử
 *   npx tsx scripts/quet-youtube.ts --ngay 30          # nới ra 30 ngày
 *   npx tsx scripts/quet-youtube.ts --video 5          # xét 5 video mới nhất mỗi kênh
 *
 * Chạy lại an toàn: video đã có trong kho thì bỏ qua, không lấy lại.
 */

import "dotenv/config";

import { prisma } from "../src/lib/db/prisma";
import { xemTinhHinh } from "../src/lib/youtube/hanMuc";
import {
  dongBoNguonTuKenhDaDangKy,
  quetVideoMoi,
} from "../src/lib/youtube/quetKenh";

/** Đọc tham số dạng `--ten giaTri` từ dòng lệnh. */
function thamSo(ten: string): number | undefined {
  const vt = process.argv.indexOf(`--${ten}`);
  if (vt === -1) return undefined;
  const so = Number(process.argv[vt + 1]);
  return Number.isFinite(so) && so > 0 ? so : undefined;
}

async function main() {
  const gioiHanKenh = thamSo("kenh");
  const soNgayGanDay = thamSo("ngay") ?? 7;
  const videoMoiKenh = thamSo("video") ?? 10;

  const truoc = await xemTinhHinh();
  console.log(`Hạn mức trước khi quét: ${truoc.daDung}/${truoc.nganSach} đơn vị`);

  console.log("\n[1/2] Dựng danh sách kênh và lấy id playlist uploads…");
  const nguon = await dongBoNguonTuKenhDaDangKy();
  console.log(`  Kênh thêm mới:      ${nguon.themMoi}`);
  console.log(`  Kênh cập nhật:      ${nguon.capNhat}`);
  if (nguon.khongLayDuoc > 0) {
    console.log(
      `  Không lấy được:     ${nguon.khongLayDuoc} (kênh đã xoá hoặc bị khoá)`,
    );
  }

  console.log(
    `\n[2/2] Quét video đăng trong ${soNgayGanDay} ngày gần đây` +
      `${gioiHanKenh ? `, giới hạn ${gioiHanKenh} kênh` : ""}…`,
  );
  const quet = await quetVideoMoi({ soNgayGanDay, videoMoiKenh, gioiHanKenh });

  console.log(`  Số kênh đã quét:    ${quet.soKenhQuet}`);
  console.log(`  Số video đã xét:    ${quet.soVideoXet}`);
  console.log(`  Video thêm vào kho: ${quet.soVideoThemMoi}`);

  if (quet.kenhLoi.length > 0) {
    console.log(`\n  ${quet.kenhLoi.length} kênh không quét được:`);
    quet.kenhLoi
      .slice(0, 10)
      .forEach((l) => console.log(`    - ${l.ten}: ${l.lyDo}`));
    if (quet.kenhLoi.length > 10) {
      console.log(`    … và ${quet.kenhLoi.length - 10} kênh nữa`);
    }
  }

  const tongKho = await prisma.contentItem.count();
  console.log(`\nTổng nội dung đang có trong kho: ${tongKho}`);

  await new Promise((nghi) => setTimeout(nghi, 1500));
  const sau = await xemTinhHinh();
  console.log(
    `Hạn mức sau khi quét: ${sau.daDung}/${sau.nganSach} đơn vị ` +
      `(tiêu ${sau.daDung - truoc.daDung} cho lần quét này)`,
  );
}

main().catch((loi) => {
  console.error("\n✗ Lỗi:", loi instanceof Error ? loi.message : loi);
  process.exit(1);
});
