import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { auth } from "@/auth";
import { DangKySW } from "@/components/DangKySW";
import { NhacKhoiDongLai } from "@/components/NhacKhoiDongLai";
import { KhungTroChuyen } from "@/components/troChuyen/KhungTroChuyen";
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
  // Mở từ màn hình chính iPhone thì bỏ luôn thanh địa chỉ. Safari không đọc
  // `display: standalone` trong manifest, nó chỉ nghe thẻ riêng này
  appleWebApp: { capable: true, title: "Am", statusBarStyle: "black-translucent" },
};

/**
 * Màu thanh trạng thái điện thoại, đổi theo tông người dùng chọn.
 *
 * Để một màu cố định thì tông tối trên Android có một dải sáng chói ở đỉnh màn
 * hình, đúng chỗ mắt nhìn vào đầu tiên lúc mở app.
 */
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#dd6b20" },
    { media: "(prefers-color-scheme: dark)", color: "#171717" },
  ],
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Doc phien ngay o bo cuc goc de khung tro chuyen biet co phai chu nha khong
  const phien = await auth();
  const laChu = Boolean(phien?.user?.email);

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
        <DangKySW />
        <NhacKhoiDongLai />
        {children}

        {/* Khung trò chuyện nằm ở ĐÂY, không nằm trong `KhungTrang`.

            Bản đầu tôi đặt trong `KhungTrang`, mà mỗi trang lại tự dựng một
            `KhungTrang` riêng — nên đổi trang là khung bị gỡ ra rồi gắn lại.
            Chủ dự án gặp ngay hai hậu quả: panel đè lên nội dung (lúc gỡ ra nó
            trả chỗ chừa về 0), và **cuộc trò chuyện mất sạch mỗi lần đổi
            trang**.

            Ở bố cục gốc thì nó sống suốt phiên: chừa chỗ đúng trên mọi trang,
            và câu chuyện đang dở vẫn còn nguyên khi chuyển sang trang khác. */}
        <KhungTroChuyen laChu={laChu} />
      </body>
    </html>
  );
}
