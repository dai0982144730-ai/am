"use client";

/**
 * Đăng ký service worker để Am cài được lên màn hình chính và mở được lúc mất
 * mạng.
 *
 * ## Vì sao chỉ đăng ký ở bản dựng thật
 *
 * Lúc phát triển, service worker lưu đệm trang rồi trả lại bản cũ, và mọi thay
 * đổi vừa sửa đều không hiện ra — nửa tiếng đi tìm một lỗi không tồn tại. Next
 * cũng tự nạp lại trang theo cách riêng, hai thứ đá nhau. Nên ở `next dev` thì
 * không đăng ký, và **gỡ luôn bản đã đăng ký từ trước** để máy nào từng mở bản
 * thật cũng không bị dính.
 */

import { useEffect } from "react";

export function DangKySW() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      void navigator.serviceWorker
        .getRegistrations()
        .then((ds) => ds.forEach((d) => void d.unregister()));
      return;
    }

    // Đợi trang tải xong mới đăng ký: đăng ký sớm thì nó giành băng thông với
    // chính những thứ đang cần để vẽ trang đầu tiên
    const dangKy = () => void navigator.serviceWorker.register("/sw.js");
    if (document.readyState === "complete") dangKy();
    else window.addEventListener("load", dangKy, { once: true });
  }, []);

  return null;
}
