/**
 * Danh sách công cụ mà trang `am` cung cấp cho trợ lý.
 *
 * Đây là endpoint quan trọng nhất của cả cổng API. Cách nó hoạt động:
 *
 *   1. App Android khởi động → gọi /cong-cu của cả ba trang → gom thành một danh sách
 *   2. Đưa cả danh sách cho Claude API kèm câu hỏi
 *   3. Claude tự đọc mô tả, tự chọn công cụ của trang nào phù hợp, tự gọi
 *   4. App nhận kết quả, đưa lại cho Claude tổng hợp thành câu trả lời
 *
 * Hệ quả: thêm chức năng mới ở đây thì app điện thoại tự biết, KHÔNG phải cài
 * lại app. Đó là lý do phải làm endpoint này ngay từ đầu.
 *
 * VIẾT MÔ TẢ THẾ NÀO: Claude chọn công cụ dựa hoàn toàn vào lời mô tả, nên mô tả
 * phải nói rõ khi nào dùng, và phải phân biệt được với công cụ của hai trang kia.
 * "Tìm kiếm nội dung" là mô tả tồi — cả ba trang đều tìm kiếm nội dung.
 */

import type { CongCuTroLy } from "@/lib/troLyChung/kieuDuLieu";

export const CONG_CU_AM: CongCuTroLy[] = [
  {
    name: "am_timKiem",
    description:
      "Tìm video YouTube, bài blog, bài diễn đàn và nhạc đã được lưu trong kho kiến thức " +
      "và giải trí cá nhân. Kho này gồm năm mảng: tin tức và hướng dẫn về AI, triết học và " +
      "Phật giáo Nguyên thuỷ, truyện kể (kinh dị, viễn tưởng, phiêu lưu), nhạc (tập thể " +
      "thao theo nhịp, dance, piano, guitar, nhạc vàng), và các từ khoá quan tâm nhất thời. " +
      "Dùng công cụ này khi người dùng hỏi về nội dung để xem, để nghe, để giải trí hoặc " +
      "học hỏi cá nhân. KHÔNG dùng cho câu hỏi về tiến độ dự án hay văn bản pháp luật.",
    input_schema: {
      type: "object",
      properties: {
        tuKhoa: {
          type: "string",
          description: "Nội dung cần tìm, ví dụ 'ý thức', 'Claude Code', 'nhạc chạy bộ'",
        },
        chuyenMuc: {
          type: "string",
          enum: ["ai", "triet_hoc", "truyen", "music", "new_search", "other"],
          description:
            "Giới hạn trong một chuyên mục. Bỏ trống để tìm khắp kho. " +
            "ai = tin và hướng dẫn AI; triet_hoc = triết học, tâm lý, Phật giáo; " +
            "truyen = truyện kể; music = nhạc; new_search = từ khoá quan tâm nhất thời",
        },
        tuNgay: {
          type: "string",
          description: "Chỉ lấy nội dung đăng từ ngày này trở đi, dạng yyyy-mm-dd",
        },
        soLuong: {
          type: "integer",
          description: "Số kết quả muốn lấy, mặc định 10, tối đa 50",
        },
        kemNoiDung: {
          type: "boolean",
          description:
            "Đặt true để lấy cả lời thoại video hoặc toàn văn bài viết. Dùng khi cần đọc " +
            "nội dung thật để trả lời chính xác thay vì đoán từ tiêu đề. Trả về nhiều chữ " +
            "hơn hẳn, nên chỉ bật khi thực sự cần đọc.",
        },
      },
      required: ["tuKhoa"],
    },
  },
  {
    name: "am_layNoiDung",
    description:
      "Lấy toàn văn của một video hoặc bài viết cụ thể trong kho kiến thức cá nhân, " +
      "gồm lời thoại đầy đủ (với video) hoặc toàn bộ bài viết, kèm mọi thông tin chi tiết. " +
      "Dùng sau khi am_timKiem đã cho biết id của mục cần đọc kỹ.",
    input_schema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "Mã của mục, lấy từ trường 'id' trong kết quả của am_timKiem",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "am_tomTatHomNay",
    description:
      "Lấy bản tin những nội dung mới thu thập được gần đây nhất trong kho kiến thức cá " +
      "nhân, đã được chọn lọc và nhóm theo chủ đề. Dùng khi người dùng hỏi những câu kiểu " +
      "'hôm nay có gì hay', 'có gì mới không', 'tuần này có video nào đáng xem'.",
    input_schema: {
      type: "object",
      properties: {
        soNgay: {
          type: "integer",
          description: "Lấy nội dung trong bao nhiêu ngày gần đây, mặc định 1",
        },
      },
    },
  },
  {
    name: "am_hoi",
    description:
      "Hỏi trực tiếp trợ lý của kho kiến thức cá nhân một câu bằng lời tự nhiên. Trợ lý sẽ " +
      "tự tìm, tự đọc nội dung liên quan rồi trả lời kèm nguồn. Dùng khi câu hỏi cần tổng " +
      "hợp từ nhiều nội dung, hoặc khi không rõ nên tìm bằng từ khoá nào. Nếu chỉ cần danh " +
      "sách kết quả thô thì dùng am_timKiem sẽ nhanh và rẻ hơn.",
    input_schema: {
      type: "object",
      properties: {
        cauHoi: {
          type: "string",
          description: "Câu hỏi bằng tiếng Việt tự nhiên",
        },
        cheDoGiongNoi: {
          type: "boolean",
          description:
            "Đặt true khi câu trả lời sẽ được đọc thành tiếng — trợ lý sẽ sinh thêm bản " +
            "rút gọn 3–4 câu không có ký hiệu, dùng để đọc lên",
        },
      },
      required: ["cauHoi"],
    },
  },
];
