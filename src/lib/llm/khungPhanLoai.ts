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

/** Năm chuyên mục cố định, khớp enum `ContentGroup` trong database. */
export const NHOM_NOI_DUNG = [
  "ai",
  "triet_hoc",
  "truyen",
  "music",
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
      "Chuyên mục của nội dung. Chọn 'other' nếu không thuộc bốn nhóm kia — " +
        "đây là lựa chọn đúng cho tin tức thời sự, giải trí, thể thao, ẩm thực.",
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

  nhanXetChatLuong: z
    .string()
    .describe(
      "Một tới hai câu tiếng Việt nhận xét nội dung này đáng xem ở điểm nào, " +
        "hoặc dở ở điểm nào.",
    ),

  // ----- Riêng nhóm AI -----
  aiChuDeCon: z
    .enum([
      "claude_news",
      "ai_news_general",
      "ai_agent_enterprise",
      "coding_experience_howto",
      "claude_usage_guide",
    ])
    .nullable()
    .describe("Chỉ điền khi nhom = 'ai'."),

  // ----- Riêng nhóm Triết học -----
  truongPhai: z
    .enum([
      "stoic",
      "hien_sinh",
      "tam_ly_hoc_hien_dai",
      "phat_giao_nguyen_thuy",
      "khac",
    ])
    .nullable()
    .describe("Chỉ điền khi nhom = 'triet_hoc'."),

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
    .enum(["kinh_di", "vien_tuong", "phieu_luu_mao_hiem"])
    .nullable()
    .describe("Chỉ điền khi nhom = 'truyen'."),

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
    .enum(["workout_bpm", "dance", "piano", "guitar_rock", "nhac_vang"])
    .nullable()
    .describe("Chỉ điền khi nhom = 'music'."),

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
