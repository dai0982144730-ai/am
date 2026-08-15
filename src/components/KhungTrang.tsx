/**
 * Khung chung của web — lớp vỏ chạy ở máy chủ.
 *
 * Việc duy nhất của file này là dựng sẵn nút Đăng xuất rồi giao toàn bộ phần
 * còn lại cho `KhungDieuHuong`.
 *
 * VÌ SAO PHẢI TÁCH LÀM HAI: lệnh đăng xuất bắt buộc chạy ở máy chủ, còn thanh
 * điều hướng thì cần nhớ trạng thái co/bung và biết đang ở trang nào — hai
 * việc chỉ làm được ở trình duyệt. Gộp một file thì hoặc mất nút đăng xuất,
 * hoặc mất phần co/bung.
 */

import { signOut } from "@/auth";
import { KhungDieuHuong } from "@/components/KhungDieuHuong";
import { NhacKhoiDongLai } from "@/components/NhacKhoiDongLai";

export function KhungTrang({
  children,
  emailNguoiDung,
}: {
  children: React.ReactNode;
  emailNguoiDung?: string | null;
}) {
  const nutDangXuat = (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/" });
      }}
    >
      <button
        type="submit"
        className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
      >
        Đăng xuất
      </button>
    </form>
  );

  return (
    <KhungDieuHuong
      emailNguoiDung={emailNguoiDung}
      dangXuat={nutDangXuat}
      nhacKhoiDongLai={<NhacKhoiDongLai />}
    >
      {children}
    </KhungDieuHuong>
  );
}
