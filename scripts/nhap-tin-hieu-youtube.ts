/**
 * Nhập kênh đã đăng ký, video đã thích và playlist từ tài khoản YouTube.
 *
 *   npx tsx scripts/nhap-tin-hieu-youtube.ts
 *
 * Chạy lại nhiều lần vẫn an toàn — mục đã có sẽ bỏ qua, chỉ thêm mục mới.
 */

import "dotenv/config";

import { xemTinhHinh } from "../src/lib/youtube/hanMuc";
import { demTinHieu, nhapTinHieuTaiKhoan } from "../src/lib/youtube/nhapTinHieu";

async function main() {
  const truoc = await xemTinhHinh();
  console.log(
    `Hạn mức trước khi nhập: ${truoc.daDung}/${truoc.nganSach} đơn vị\n`,
  );
  console.log("Đang nhập… (mất một lát nếu tài khoản có nhiều playlist)\n");

  const ketQua = await nhapTinHieuTaiKhoan();

  console.log("Thêm mới lần này:");
  console.log(`  Kênh đã đăng ký:      ${ketQua.kenhDangKy}`);
  console.log(`  Video đã thích:       ${ketQua.videoDaThich}`);
  console.log(
    `  Video trong playlist: ${ketQua.videoTrongPlaylist} (từ ${ketQua.soPlaylist} playlist)`,
  );

  if (ketQua.playlistLoi.length > 0) {
    console.log(`\n  ${ketQua.playlistLoi.length} playlist không đọc được:`);
    ketQua.playlistLoi.forEach((l) => console.log(`    - ${l.ten}: ${l.lyDo}`));
  }

  const tong = await demTinHieu();
  console.log("\nTổng đang có trong database:");
  console.log(`  Kênh đã đăng ký:      ${tong.subscription ?? 0}`);
  console.log(`  Video đã thích:       ${tong.liked_video ?? 0}`);
  console.log(`  Video trong playlist: ${tong.playlist_member ?? 0}`);

  await new Promise((nghi) => setTimeout(nghi, 1500));
  const sau = await xemTinhHinh();
  console.log(
    `\nHạn mức sau khi nhập: ${sau.daDung}/${sau.nganSach} đơn vị ` +
      `(tiêu ${sau.daDung - truoc.daDung} cho lần nhập này)`,
  );
}

main().catch((loi) => {
  console.error("\n✗ Lỗi:", loi instanceof Error ? loi.message : loi);
  process.exit(1);
});
