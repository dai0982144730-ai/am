import type { MetadataRoute } from "next";

/**
 * Khai báo để điện thoại cài Am lên màn hình chính như một app thật.
 *
 * ## Vì sao làm cái này thay vì app Android
 *
 * Chủ dự án chốt 2026-08-16: làm bản web cho điện thoại trước. Máy đang dùng
 * không có Java, Gradle lẫn Android SDK — cài đủ bộ mất 8–12 GB, mà thứ cần
 * hằng ngày chỉ là mở ra nghe được. Am vốn đã chạy trên trình duyệt điện thoại;
 * thiếu đúng ba thứ để nó thành app: biểu tượng trên màn hình chính, mở ra
 * không có thanh địa chỉ, và mở được lúc mất mạng.
 *
 * `display: standalone` là thứ tạo khác biệt lớn nhất — bỏ thanh địa chỉ đi thì
 * nó không còn cảm giác là một trang web nữa.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Am — trợ lý nội dung cá nhân",
    short_name: "Am",
    description:
      "Mỗi tối tự quét YouTube, blog, podcast rồi sáng hôm sau đưa ra vài " +
      "lựa chọn đáng xem nhất.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    // Cùng màu với `--color-cam-500` của tông sáng, để thanh trạng thái điện
    // thoại liền một khối với đầu trang
    background_color: "#dd6b20",
    theme_color: "#dd6b20",
    lang: "vi",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
    // Giữ nút mở nhanh ở đúng hai chỗ dùng nhiều nhất buổi sáng và lúc đi đường
    shortcuts: [
      {
        name: "Am nói với bạn",
        short_name: "Bản tin",
        url: "/ban-tin",
      },
      {
        name: "Hàng chờ",
        short_name: "Hàng chờ",
        url: "/hang-cho?che_do=chi_nghe",
      },
    ],
  };
}
