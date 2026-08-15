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

  // Khung trò chuyện KHÔNG nằm ở đây, mà ở `app/layout.tsx`.
  //
  // Đặt ở đây là sai, và đã hỏng thật: mỗi trang tự dựng một `KhungTrang`, nên
  // đổi trang là khung trò chuyện bị gỡ ra rồi gắn lại. Hai hậu quả chủ dự án
  // gặp ngay — panel đè lên nội dung vì chỗ chừa bị trả về 0 lúc gỡ, và **cuộc
  // trò chuyện mất sạch mỗi lần đổi trang**.
  //
  // Bố cục gốc thì giữ nguyên qua mọi lần chuyển trang.
  return (
    <KhungDieuHuong emailNguoiDung={emailNguoiDung} dangXuat={nutDangXuat}>
      {children}
    </KhungDieuHuong>
  );
}
