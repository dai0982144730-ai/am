"use client";

/**
 * Màn hình khi một trang gặp lỗi.
 *
 * VÌ SAO CẦN: không có file này thì Next hiện đúng một dòng "A server error
 * occurred" — không nói lỗi gì, không nói làm gì tiếp. Đã tự gặp và phải mở
 * console trình duyệt ra mới biết chuyện gì xảy ra.
 *
 * Dải nhắc khởi động lại nằm ở bố cục gốc nên nó vẫn hiện phía trên màn này.
 * Vậy nên nguyên nhân hay gặp nhất — máy chủ giữ bản Prisma cũ — đã được chỉ
 * mặt đặt tên sẵn trước khi người dùng kịp đọc tới đây.
 */

import { useEffect } from "react";

export default function TrangLoi({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Ghi ra console để còn xem được nội dung lỗi thật. Bản dựng thật giấu
    // thông điệp lỗi đi và chỉ để lại `digest`.
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex max-w-lg flex-col items-start px-6 py-16">
      <h1 className="text-lg font-semibold">Trang này đang hỏng</h1>

      <p className="mt-3 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
        Nếu phía trên có dải màu vàng nhắc khởi động lại máy chủ thì đó chính là
        nguyên nhân — dừng máy chủ rồi chạy lại <code>npm run dev</code> là hết.
      </p>

      <p className="mt-2 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
        Không có dải đó thì là lỗi khác. Nội dung lỗi đầy đủ nằm trong cửa sổ
        terminal đang chạy máy chủ.
      </p>

      {error.message ? (
        <pre className="mt-4 w-full overflow-x-auto rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
          {error.message}
        </pre>
      ) : null}

      <button
        type="button"
        onClick={reset}
        className="mt-5 rounded-lg bg-cam-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-cam-700"
      >
        Thử lại
      </button>
    </main>
  );
}
