import { redirect } from "next/navigation";

import { auth, signIn } from "@/auth";

/**
 * Trang đăng nhập. Chỉ có đúng một nút, vì app này chỉ có một người dùng và
 * một cách vào.
 *
 * `searchParams` mang mã lỗi do Auth.js trả về khi đăng nhập hỏng — thường gặp
 * nhất là `AccessDenied`, tức đã đăng nhập bằng email không phải chủ dự án.
 */
export default async function TrangDangNhap({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const phien = await auth();
  if (phien) redirect("/");

  const { error } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-16">
      <h1 className="text-3xl font-bold tracking-tight">Am</h1>
      <p className="mt-2 text-neutral-500 dark:text-neutral-400">
        Đăng nhập bằng chính tài khoản YouTube của bạn, để trợ lý hiểu gu ngay
        từ đầu.
      </p>

      {error ? (
        <div className="mt-8 rounded-xl border border-red-200 bg-red-50 p-4 text-sm dark:border-red-900 dark:bg-red-950">
          <p className="font-medium text-red-900 dark:text-red-200">
            {error === "AccessDenied"
              ? "Tài khoản này không được phép vào."
              : "Đăng nhập không thành công."}
          </p>
          <p className="mt-1 text-red-700 dark:text-red-300">
            {error === "AccessDenied"
              ? "Web chỉ mở cho đúng một tài khoản. Kiểm tra lại xem có đang đăng nhập nhầm tài khoản Google khác không."
              : "Thử lại một lần nữa. Nếu vẫn hỏng, xem log ở cửa sổ đang chạy npm run dev."}
          </p>
        </div>
      ) : null}

      <form
        className="mt-8"
        action={async () => {
          "use server";
          await signIn("google", { redirectTo: "/" });
        }}
      >
        <button
          type="submit"
          className="w-full rounded-xl bg-neutral-900 px-5 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90 dark:bg-neutral-100 dark:text-neutral-900"
        >
          Đăng nhập bằng Google
        </button>
      </form>

      <p className="mt-6 text-xs leading-relaxed text-neutral-400 dark:text-neutral-500">
        Lần này chỉ xin quyền <strong>đọc</strong> dữ liệu YouTube: kênh bạn đã
        đăng ký, video đã thích, và các playlist hiện có. Quyền sắp xếp playlist
        thật sẽ hỏi riêng về sau, khi tính năng đó được làm.
      </p>
    </main>
  );
}
