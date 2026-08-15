/**
 * Trò chuyện trong một cửa sổ riêng.
 *
 * Mở từ nút ⧉ trên thanh tiêu đề của khung. Có ích khi dùng hai màn hình: kéo
 * cửa sổ này sang màn hình phụ, màn hình chính để nguyên cho nội dung.
 *
 * KHÔNG có menu điều hướng ở đây, có chủ đích: cửa sổ này chỉ làm một việc.
 * Nhét cả menu vào thì nó thành bản sao thu nhỏ của cả web, mà bấm vào mục nào
 * cũng lạc lõng trong một cửa sổ rộng 460px.
 */

import { auth } from "@/auth";
import { BangTroChuyen } from "@/components/troChuyen/BangTroChuyen";

export const dynamic = "force-dynamic";

export const metadata = { title: "Trợ lý — Am" };

export default async function TrangTroChuyen() {
  const phien = await auth();
  const laChu = Boolean(phien?.user?.email);

  return (
    <div className="flex h-screen flex-col bg-nen-menu">
      <div className="flex shrink-0 items-center gap-2 border-b border-neutral-200 px-4 py-2.5 dark:border-neutral-800">
        <span className="text-sm font-semibold text-cam-600 dark:text-cam-500">
          Am
        </span>
        <span className="text-sm text-neutral-500 dark:text-neutral-400">
          Trợ lý
        </span>
      </div>

      <BangTroChuyen laChu={laChu} />
    </div>
  );
}
