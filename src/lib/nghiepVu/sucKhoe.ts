/**
 * Báo cáo tình trạng của trang.
 *
 * App điện thoại gọi endpoint này để phân biệt "trang này đang hỏng" với "trang
 * này không có dữ liệu bạn hỏi" — hai chuyện hoàn toàn khác nhau mà nếu không có
 * endpoint này thì app chỉ thấy im lặng như nhau.
 */

import { prisma } from "@/lib/db/prisma";
import { PHIEN_BAN_API, TEN_TRANG, type TinhTrangSucKhoe } from "@/lib/troLyChung/kieuDuLieu";

/**
 * Giải thích mã lỗi Prisma bằng tiếng Việt.
 *
 * Danh sách đầy đủ: https://www.prisma.io/docs/orm/reference/error-reference
 * Chỉ liệt kê những mã thực sự có thể gặp ở endpoint chỉ-đếm-bản-ghi này.
 */
const GIAI_THICH_MA_LOI: Record<string, string> = {
  P1000: "Sai tên đăng nhập hoặc mật khẩu database.",
  P1001: "Không kết nối được tới máy chủ database. Kiểm tra DATABASE_URL và xem Neon có đang bật không.",
  P1002: "Máy chủ database có phản hồi nhưng quá chậm.",
  P1003: "Database không tồn tại.",
  P1008: "Thao tác với database quá lâu, đã hết giờ chờ.",
  P1017: "Máy chủ database đã đóng kết nối.",
  P2021: "Bảng chưa tồn tại. Có thể chưa chạy 'npx prisma migrate deploy'.",
  P2022: "Cột chưa tồn tại. Có thể chưa chạy 'npx prisma migrate deploy'.",
};

/**
 * Rút gọn lỗi database thành một câu người đọc hiểu được.
 *
 * Cố ý KHÔNG trả nguyên văn lỗi Prisma ra ngoài: nó dài hàng chục dòng, kèm
 * đường dẫn file trên máy chủ, đoạn mã nguồn quanh chỗ lỗi, và cả địa chỉ máy
 * chủ database. Người gọi chỉ cần biết đại khái vì sao; ai cần xem đầy đủ thì
 * đọc log máy chủ — chỗ đó đã in nguyên văn ở hàm gọi.
 */
function rutGonLoi(loi: unknown): string {
  const ma =
    typeof loi === "object" && loi !== null && "code" in loi
      ? String((loi as { code: unknown }).code)
      : null;

  if (ma && GIAI_THICH_MA_LOI[ma]) return `${GIAI_THICH_MA_LOI[ma]} (mã ${ma})`;
  if (ma) return `Database báo lỗi mã ${ma}.`;

  // Lỗi do chính mình ném ra (ví dụ thiếu DATABASE_URL) thì thông điệp đã bằng
  // tiếng Việt và không lộ gì, trả thẳng được
  const nguyenVan = loi instanceof Error ? loi.message.split("\n")[0].trim() : "";
  return nguyenVan.length > 0 && nguyenVan.length <= 200
    ? nguyenVan
    : "Không kết nối được database. Xem log máy chủ để biết chi tiết.";
}

export async function kiemTraSucKhoe(): Promise<TinhTrangSucKhoe> {
  const batDau = Date.now();

  try {
    const [soNoiDung, soNguon, soBanTin] = await Promise.all([
      prisma.contentItem.count(),
      prisma.source.count(),
      prisma.assistantBriefing.count(),
    ]);

    return {
      trang: TEN_TRANG,
      phienBanApi: PHIEN_BAN_API,
      database: "ok",
      soBanGhi: {
        noiDung: soNoiDung,
        nguon: soNguon,
        banTin: soBanTin,
      },
      thoiGianPhanHoiMs: Date.now() - batDau,
    };
  } catch (loi) {
    // Cố ý KHÔNG ném lỗi: câu hỏi ở đây là "trang có khoẻ không", và câu trả lời
    // "không khoẻ, vì lý do này" cũng là một câu trả lời hợp lệ. Ném lỗi sẽ làm
    // app chỉ thấy 500 mà không biết vì sao.
    console.error("[tro-ly] suc-khoe: database lỗi:", loi);
    return {
      trang: TEN_TRANG,
      phienBanApi: PHIEN_BAN_API,
      database: "loi",
      soBanGhi: {},
      thoiGianPhanHoiMs: Date.now() - batDau,
      loi: rutGonLoi(loi),
    };
  }
}
