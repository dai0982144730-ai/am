/**
 * Kiểm tra kết nối tài khoản YouTube.
 *
 *   npx tsx scripts/kiem-ket-noi-youtube.ts
 *
 * Chạy sau mỗi lần đăng nhập để biết chắc ba việc: token đã lưu chưa, Google có
 * thực sự cấp quyền đọc YouTube không, và gọi API thay mặt tài khoản có được
 * không.
 *
 * Bước kiểm tra quyền là quan trọng nhất. Google cho đăng nhập thành công ngay
 * cả khi không cấp quyền YouTube — mãi tới lúc gọi API mới báo lỗi 403.
 */

import "dotenv/config";

import { prisma } from "../src/lib/db/prisma";
import { goiYouTube } from "../src/lib/youtube/goiApi";
import { QUYEN_YOUTUBE } from "../src/lib/youtube/tokenGoogle";

interface KenhDaDangKy {
  snippet?: { title?: string; resourceId?: { channelId?: string } };
}

async function main() {
  const taiKhoan = await prisma.googleAccount.findUnique({
    where: { id: "chu_du_an" },
  });

  if (!taiKhoan) {
    console.log("✗ Chưa đăng nhập lần nào.");
    console.log("  Mở http://localhost:3000 bấm 'Đăng nhập bằng Google'.");
    process.exit(1);
  }

  console.log(`Tài khoản:     ${taiKhoan.email}`);
  console.log(
    `Access token:  ${taiKhoan.accessToken ? "có" : "KHÔNG"}` +
      (taiKhoan.expiresAt
        ? ` (hết hạn ${taiKhoan.expiresAt.toLocaleString("vi-VN")})`
        : ""),
  );
  console.log(
    `Refresh token: ${taiKhoan.refreshToken ? "có — chạy nền được" : "KHÔNG — sẽ không chạy nền được"}`,
  );

  const cacQuyen = taiKhoan.scope?.split(" ") ?? [];
  const coQuyenYouTube = cacQuyen.includes(QUYEN_YOUTUBE);
  console.log(`Quyền YouTube: ${coQuyenYouTube ? "CÓ" : "THIẾU"}`);

  if (!coQuyenYouTube) {
    console.log("\nCác quyền hiện có:");
    cacQuyen.forEach((q) => console.log(`  - ${q}`));
    console.log(
      "\n✗ Thiếu quyền đọc YouTube. Xem hướng dẫn sửa trong docs/PROGRESS.md,",
    );
    console.log("  mục 'Cạm bẫy: đăng nhập được nhưng không có quyền YouTube'.");
    process.exit(1);
  }

  console.log("\nThử gọi API thay mặt tài khoản…");
  const ketQua = await goiYouTube<{ items?: KenhDaDangKy[] }>(
    "subscriptions.list",
    "subscriptions",
    { part: "snippet", mine: "true", maxResults: 5 },
    { canDangNhap: true },
  );

  const soKenh = ketQua.items?.length ?? 0;
  console.log(`✓ Gọi được. Năm kênh đầu trong danh sách đã đăng ký:`);
  ketQua.items?.forEach((kenh) =>
    console.log(`  - ${kenh.snippet?.title ?? "(không rõ tên)"}`),
  );
  if (soKenh === 0) {
    console.log("  (tài khoản này chưa đăng ký kênh nào)");
  }
}

main().catch((loi) => {
  console.error("\n✗ Lỗi:", loi instanceof Error ? loi.message : loi);
  process.exit(1);
});
