/**
 * Khung dữ liệu cho việc phân loại nội dung bằng Claude.
 *
 * Tách riêng khỏi phần gọi API để chỗ khác dùng lại được, và để khi đổi cách
 * gọi thì không phải đụng vào định nghĩa dữ liệu.
 *
 * Dùng Zod thay vì tự viết JSON Schema: Claude có chế độ "trả lời theo khuôn"
 * (structured outputs) nhận thẳng schema từ Zod, nên kiểu dữ liệu trong code và
 * khuôn mà Claude phải tuân theo luôn là một — không có chuyện sửa một chỗ quên
 * chỗ kia.
 *
 * LƯU Ý về giới hạn của chế độ này: không dùng được ràng buộc số (`min`/`max`)
 * hay ràng buộc độ dài chuỗi. Muốn giới hạn thì phải mô tả bằng lời trong
 * `.describe()` rồi tự kiểm tra lại sau.
 */

import * as z from "zod/v4";

/** Các chuyên mục cố định, khớp enum `ContentGroup` trong database. */
export const NHOM_NOI_DUNG = [
  "ai",
  "triet_hoc",
  "truyen",
  "music",
  "khoa_hoc",
  "other",
] as const;

/**
 * Khuôn trả lời Claude phải tuân theo.
 *
 * Mọi trường đặc thù đều cho phép `null` — bắt Claude phải đoán khi không có
 * căn cứ sẽ làm hỏng dữ liệu. Thà để trống còn hơn gắn sai.
 */
export const KhungPhanLoai = z.object({
  nhom: z
    .enum(NHOM_NOI_DUNG)
    .describe(
      "Chuyên mục của nội dung. Năm chuyên mục thật là ai, triet_hoc, " +
        "khoa_hoc, truyen, music. 'other' KHÔNG phải chuyên mục thứ sáu mà là " +
        "dấu VỨT BỎ: nội dung mang dấu này bị loại và không bao giờ hiện ra " +
        "nữa. Chỉ chọn 'other' khi đã chắc nội dung chính không thuộc mảng " +
        "nào trong năm mảng trên.",
    ),

  chuDe: z
    .array(z.string())
    .describe("Từ ba đến sáu từ khoá chủ đề chính, bằng tiếng Việt."),

  tenTacGiaThoNhat: z
    .string()
    .nullable()
    .describe(
      "Tên tác giả/giảng sư/nhà văn nếu nội dung có nêu rõ, chép nguyên văn. " +
        "Null nếu không nêu. Đây KHÔNG phải tên kênh YouTube.",
    ),

  tacGiaDuocGhiTrongMoTa: z
    .boolean()
    .describe("Phần mô tả có ghi công tác giả gốc không."),

  ngonNguNoiDung: z
    .enum(["vi", "khac"])
    .describe(
      "Ngôn ngữ NGƯỜI NÓI/NGƯỜI VIẾT dùng trong nội dung, không phải ngôn ngữ " +
        "của tiêu đề. 'vi' khi nghe/đọc bằng tiếng Việt là hiểu được; 'khac' " +
        "với mọi ngôn ngữ khác. Đây là trường quan trọng: chủ nhà không biết " +
        "tiếng Anh nên nội dung 'khac' sẽ bị giấu đi cho tới khi có bản thuật " +
        "lại tiếng Việt.",
    ),

  tieuDeTiengViet: z
    .string()
    .nullable()
    .describe(
      "Chỉ điền khi tiêu đề gốc KHÔNG phải tiếng Việt: dịch tiêu đề sang tiếng " +
        "Việt tự nhiên, giữ nguyên tên riêng và thuật ngữ đã quen dùng bằng " +
        "tiếng Anh (AI, GPU, token…). Tiêu đề vốn đã là tiếng Việt thì để null.",
    ),

  nhanXetChatLuong: z
    .string()
    .describe(
      "Một tới hai câu tiếng Việt nhận xét nội dung này đáng xem ở điểm nào, " +
        "hoặc dở ở điểm nào.",
    ),

  diemChatLuong: z
    .number()
    .min(0)
    .max(1)
    .describe(
      "Điểm chất lượng 0–1 sau khi đọc nội dung. 0,2 = hời hợt hoặc câu view; " +
        "0,5 = ổn nhưng không có gì đặc biệt; 0,8 = có chiều sâu thật, người " +
        "viết hiểu việc mình nói; 0,95 trở lên chỉ dành cho thứ xuất sắc hiếm " +
        "gặp. Đây là trụ tín hiệu DUY NHẤT dùng được cho blog và podcast — " +
        "những nguồn không có lượt xem hay bình luận công khai — nên hãy chấm " +
        "thật, đừng dồn hết vào quãng giữa.",
    ),

  // ----- Riêng nhóm AI -----
  // NĂM TRƯỜNG CHỦ ĐỀ CON DƯỚI ĐÂY LÀ CHỮ TỰ DO, KHÔNG PHẢI DANH SÁCH CỨNG.
  //
  // Danh sách hợp lệ do chủ nhà tự đặt trong bảng `ChuDeCon`, đổi được bất cứ
  // lúc nào — nên nó không thể nằm trong file này. `moTaKhung()` sẽ chèn danh
  // sách hiện hành vào phần mô tả ngay trước khi gửi cho Claude; chỗ này chỉ
  // giữ khuôn dạng.
  aiChuDeCon: z
    .string()
    .nullable()
    .describe("Chỉ điền khi nhom = 'ai'. Chọn đúng một mã trong danh sách chủ đề con được cung cấp, hoặc null."),

  // ----- Riêng nhóm Khoa học -----
  linhVucKhoaHoc: z
    .string()
    .nullable()
    .describe(
      "Chỉ điền khi nhom = 'khoa_hoc'. Chọn đúng một mã trong danh sách lĩnh " +
        "vực được cung cấp (lĩnh vực chiếm phần lớn nội dung), hoặc null. " +
        "Không có lựa chọn nào cho AI: nội dung về AI thuộc nhóm 'ai', không " +
        "bao giờ vào 'khoa_hoc'.",
    ),

  // ----- Riêng nhóm Triết học -----
  truongPhai: z
    .string()
    .nullable()
    .describe("Chỉ điền khi nhom = 'triet_hoc'. Chọn đúng một mã trong danh sách trường phái được cung cấp, hoặc null."),

  dangTrinhBay: z
    .enum(["giang_phap", "van_dap", "ung_dung_thuc_hanh", "phan_tich_hoc_thuat"])
    .nullable()
    .describe("Chỉ điền khi nhom = 'triet_hoc'."),

  mucDoNguoiNghe: z
    .enum(["moi_bat_dau", "chuyen_sau"])
    .nullable()
    .describe("Chỉ điền khi nhom = 'triet_hoc'."),

  coDauHieuMeTin: z
    .boolean()
    .describe(
      "True khi nội dung cổ vũ mê tín dị đoan, bói toán, thần thông, hoặc " +
        "thương mại hoá tâm linh (bán vật phẩm cầu may, hứa hẹn đổi vận). " +
        "Giảng pháp nghiêm túc bàn về nghiệp, luân hồi KHÔNG tính là mê tín.",
    ),

  // ----- Riêng nhóm Truyện -----
  theLoaiTruyen: z
    .string()
    .nullable()
    .describe("Chỉ điền khi nhom = 'truyen'. Chọn đúng một mã trong danh sách thể loại được cung cấp, hoặc null."),

  xuatXuTruyen: z
    .enum(["viet_nam_sang_tac", "dich_trung_quoc", "dich_au_my", "khac"])
    .nullable()
    .describe("Chỉ điền khi nhom = 'truyen'."),

  doCangThang: z
    .enum(["nhe_nhang", "cang_thang", "kinh_khung"])
    .nullable()
    .describe("Chỉ điền khi nhom = 'truyen'."),

  duaTrenChuyenThat: z
    .boolean()
    .nullable()
    .describe("Chỉ điền khi nhom = 'truyen'."),

  nghiNgoDoAiViet: z
    .number()
    .nullable()
    .describe(
      "Chỉ điền khi nhom = 'truyen'. Từ 0 đến 1: khả năng truyện này do AI " +
        "sản xuất hàng loạt. Dấu hiệu nghi ngờ: văn phong đều đều không có " +
        "giọng riêng, tình tiết rập khuôn, nhân vật không có chiều sâu, mô tả " +
        "thừa thãi, không có tác giả rõ ràng. Dấu hiệu ngược lại: giọng văn " +
        "riêng biệt, chi tiết đời sống cụ thể, tác giả có tên tuổi.",
    ),

  // ----- Riêng nhóm Music -----
  theLoaiNhac: z
    .string()
    .nullable()
    .describe("Chỉ điền khi nhom = 'music'. Chọn đúng một mã trong danh sách thể loại nhạc được cung cấp, hoặc null."),

  bpm: z
    .number()
    .nullable()
    .describe(
      "Chỉ điền khi tiêu đề hoặc mô tả GHI RÕ số nhịp (ví dụ '150 BPM'). " +
        "TUYỆT ĐỐI KHÔNG ĐOÁN — nghe nhạc bằng chữ là không thể. Không ghi " +
        "rõ thì để null.",
    ),

  doTinCayBpm: z
    .enum(["stated_in_title", "stated_in_description", "inferred"])
    .nullable()
    .describe("Chỉ điền khi bpm khác null."),

  laMixLienMach: z
    .boolean()
    .nullable()
    .describe(
      "Chỉ điền khi nhom = 'music'. True nếu là bản mix liền mạch, " +
        "false nếu là playlist ghép nhiều bài rời.",
    ),

  // ----- Chung -----
  loaiGiongDoc: z
    .enum(["human_voice", "ai_tts", "text_only", "instrumental", "unknown"])
    .describe(
      "Giọng người thật, giọng máy đọc, chỉ có chữ, nhạc không lời, hay " +
        "không xác định được.",
    ),
});

export type KetQuaPhanLoai = z.infer<typeof KhungPhanLoai>;
