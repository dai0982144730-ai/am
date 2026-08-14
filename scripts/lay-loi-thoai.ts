/**
 * Lấy lời thoại cho các video đang chờ trong kho.
 *
 *   npx tsx scripts/lay-loi-thoai.ts            # 50 video
 *   npx tsx scripts/lay-loi-thoai.ts --so 200   # 200 video
 *
 * Chạy chậm có chủ đích — nghỉ hơn một giây giữa mỗi video để không bị YouTube
 * chặn. Lấy 50 video mất khoảng một phút.
 *
 * Chạy lại an toàn: video đã lấy rồi (kể cả lấy hỏng) sẽ không thử lại.
 */

import "dotenv/config";

import { demTinhHinh, layLoiThoaiHangLoat } from "../src/lib/youtube/loiThoai";

function thamSo(ten: string): number | undefined {
  const vt = process.argv.indexOf(`--${ten}`);
  if (vt === -1) return undefined;
  const so = Number(process.argv[vt + 1]);
  return Number.isFinite(so) && so > 0 ? so : undefined;
}

function nhan(trangThai: string): string {
  const ban: Record<string, string> = {
    pending_transcript: "chờ lấy lời thoại",
    pending_classification: "đã có lời thoại, chờ phân loại",
    classified: "đã phân loại xong",
    transcript_unavailable: "không có phụ đề",
    rejected: "đã loại bỏ",
  };
  return ban[trangThai] ?? trangThai;
}

async function main() {
  const gioiHan = thamSo("so") ?? 50;

  console.log("Tình hình kho trước khi chạy:");
  const truoc = await demTinhHinh();
  for (const [trangThai, so] of Object.entries(truoc)) {
    console.log(`  ${nhan(trangThai).padEnd(32)} ${so}`);
  }

  console.log(`\nĐang lấy lời thoại cho tối đa ${gioiHan} video…\n`);
  const ketQua = await layLoiThoaiHangLoat(gioiHan, (dong) => console.log(dong));

  console.log(`\nĐã xét:        ${ketQua.daXet} video`);
  console.log(`  Lấy được:    ${ketQua.layDuoc}`);
  console.log(`  Không có:    ${ketQua.khongCoPhuDe}`);
  if (ketQua.layDuoc > 0) {
    console.log(
      `  Tổng chữ:    ${ketQua.tongKyTu.toLocaleString("vi-VN")} ký tự ` +
        `(trung bình ${Math.round(ketQua.tongKyTu / ketQua.layDuoc).toLocaleString("vi-VN")}/video)`,
    );
  }

  console.log("\nTình hình kho sau khi chạy:");
  const sau = await demTinhHinh();
  for (const [trangThai, so] of Object.entries(sau)) {
    console.log(`  ${nhan(trangThai).padEnd(32)} ${so}`);
  }
}

main().catch((loi) => {
  console.error("\n✗ Lỗi:", loi instanceof Error ? loi.message : loi);
  process.exit(1);
});
