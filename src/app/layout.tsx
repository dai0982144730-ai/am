import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { NhacKhoiDongLai } from "@/components/NhacKhoiDongLai";
import { MA_DAT_TONG_SOM, TONG_MAC_DINH } from "@/lib/giaoDien/tongMau";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "vietnamese"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "vietnamese"],
});

export const metadata: Metadata = {
  title: "Am",
  description: "Trợ lý cá nhân tuyển chọn nội dung đáng xem",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // `suppressHydrationWarning` ở ĐÚNG hai thẻ này, không phải ở đâu khác.
    //
    // Tiện ích mở rộng của trình duyệt hay chèn thuộc tính lạ vào <html> và
    // <body> trước khi React kịp dựng trang — đã gặp thật với `bis_register`,
    // `__processed_…__`, `data-yd-content-ready`. React thấy trang trên máy
    // chủ và trang trên trình duyệt khác nhau nên báo lỗi đỏ mỗi lần mở web,
    // dù chẳng có gì hỏng.
    //
    // Đây là cách React chính thức khuyên dùng cho đúng tình huống này. Nó chỉ
    // bỏ qua khác biệt về THUỘC TÍNH của riêng thẻ được đánh dấu, không lan
    // xuống các thẻ con — nên vẫn báo bình thường nếu nội dung bên trong lệch
    // thật. Chỉ an toàn vì hai thẻ này không nhận dữ liệu động nào.
    <html
      lang="vi"
      // Đặt sẵn tông mặc định ngay từ máy chủ. Đoạn mã trong <head> bên dưới sẽ
      // sửa lại nếu người dùng đã chọn khác — nhưng đặt sẵn ở đây thì trường
      // hợp phổ biến nhất (dùng mặc định) không phải chờ mã đó chạy.
      data-tong={TONG_MAC_DINH}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Đặt tông màu TRƯỚC khi trang được vẽ.

            Phải là thẻ script chặn nằm trong <head>, không thể thay bằng một
            component React: đợi React chạy xong mới đổi màu thì người dùng nhìn
            thấy một nháy nền trắng rồi mới chuyển sang đen. Nháy đó ngắn nhưng
            chói mắt, và ở tông tối thì nó rất khó chịu. */}
        <script dangerouslySetInnerHTML={{ __html: MA_DAT_TONG_SOM }} />
      </head>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {/* Dải nhắc khởi động lại nằm ở ĐÂY chứ không nằm trong khung trang,
            và đó là chỗ duy nhất đúng.

            Bản đầu tôi đặt nó trong `KhungTrang`, tức là bên trong từng trang.
            Đặt vậy thì nó vô dụng đúng lúc cần nhất: khi máy chủ giữ bản Prisma
            cũ, trang chết ngay ở bước lấy dữ liệu, chưa kịp vẽ ra khung nào cả
            — người dùng chỉ thấy "A server error occurred". Đã tận mắt thấy nó
            hỏng đúng như vậy.

            Bố cục gốc thì vẫn dựng dù trang bên trong có chết, nên đặt ở đây
            lời nhắc mới đến được đúng lúc. */}
        <NhacKhoiDongLai />
        {children}
      </body>
    </html>
  );
}
