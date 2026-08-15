import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
