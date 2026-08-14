/**
 * Trợ lý AI của trang `am`.
 *
 * Nhận một câu hỏi bằng lời tự nhiên, tự tìm nội dung liên quan trong kho, đọc,
 * rồi trả lời kèm nguồn.
 *
 * Điểm mấu chốt: trả về HAI bản trả lời.
 *   - traLoiDay: đầy đủ, có markdown → hiện lên màn hình
 *   - traLoiNgan: 3–4 câu, không ký hiệu → đọc thành tiếng
 *
 * Nghe máy đọc một bài dài 400 chữ là trải nghiệm rất tệ. Nghe ba câu tóm ý rồi
 * nhìn màn hình xem chi tiết mới dùng được.
 */

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

import { chuanHoaDeDoc } from "@/lib/troLyChung/chuanHoaDeDoc";
import { TEN_TRANG, type NguonThamKhao, type TraLoiTroLy } from "@/lib/troLyChung/kieuDuLieu";
import { LoiTroLy } from "@/lib/troLyChung/phanHoi";
import { timKiemNoiDung } from "./timKiemNoiDung";

/** Số nội dung đưa cho Claude đọc. Nhiều hơn thì tốn tiền mà ít khi cần đến. */
const SO_NOI_DUNG_DOC = 5;

/** Cắt bớt lời thoại quá dài trước khi đưa cho Claude — một video 2 tiếng có thể dài hàng chục nghìn chữ */
const DO_DAI_TOI_DA_MOI_MUC = 6000;

/** Trần độ dài bản đọc, tính bằng ký tự */
const TRAN_TRA_LOI_NGAN = 400;

const KetQuaClaude = z.object({
  traLoiNgan: z.string(),
  traLoiDay: z.string(),
});

/**
 * Khung JSON bắt Claude trả về đúng hai trường.
 *
 * Dùng structured output thay vì dặn "hãy trả về JSON" rồi tự bóc tách: cách sau
 * thỉnh thoảng sẽ hỏng khi model viết thêm lời dẫn trước JSON.
 */
const KHUNG_TRA_LOI = {
  type: "json_schema" as const,
  schema: {
    type: "object",
    properties: {
      traLoiNgan: {
        type: "string",
        description:
          "Bản rút gọn để đọc thành tiếng: tối đa 3-4 câu, khoảng 400 ký tự, " +
          "viết như lời nói tự nhiên, không markdown, không đường dẫn, không ký hiệu đặc biệt",
      },
      traLoiDay: {
        type: "string",
        description:
          "Bản đầy đủ để hiển thị trên màn hình, được phép dùng markdown, bảng, danh sách",
      },
    },
    required: ["traLoiNgan", "traLoiDay"],
    additionalProperties: false,
  },
};

const LOI_DAN_HE_THONG = `Bạn là trợ lý của một kho nội dung cá nhân tên "Am" — nơi lưu video YouTube, bài blog, bài diễn đàn và nhạc mà chủ nhân đã chọn lọc, thuộc năm mảng: AI, triết học và Phật giáo Nguyên thuỷ, truyện kể, âm nhạc, và các từ khoá quan tâm nhất thời.

Trả lời hoàn toàn bằng tiếng Việt.

Chỉ dựa vào phần nội dung được cung cấp bên dưới. Nếu trong đó không có thông tin để trả lời, hãy nói thẳng là kho chưa có nội dung phù hợp — đừng suy đoán và đừng trả lời bằng kiến thức chung, vì chủ nhân hỏi là để biết trong kho của mình có gì.

Sinh đúng hai bản trả lời:

traLoiDay — bản đầy đủ hiện trên màn hình. Được dùng markdown, danh sách, bảng. Nhắc tên nội dung cụ thể khi giới thiệu.

traLoiNgan — bản để MÁY ĐỌC THÀNH TIẾNG. Tối đa 3-4 câu và khoảng 400 ký tự. Viết như đang nói chuyện. Tuyệt đối không dùng dấu sao, dấu thăng, dấu gạch đầu dòng, bảng, hay đường dẫn. Không đọc tên file hay mã số. Nếu cần nhắc tới một video hay bài viết thì gọi bằng tên, và nói "xem chi tiết trên màn hình" thay vì đọc địa chỉ.`;

/** Gom nội dung tìm được thành khối chữ đưa cho Claude đọc */
function dungPhanNoiDung(
  ketQua: Awaited<ReturnType<typeof timKiemNoiDung>>["ketQua"],
): string {
  return ketQua
    .map((muc, i) => {
      const rieng = muc.duLieuRieng as Record<string, unknown>;
      const dong = [
        `--- Nội dung ${i + 1} ---`,
        `Tiêu đề: ${muc.tieuDe}`,
        `Chuyên mục: ${rieng.chuyenMuc ?? "chưa phân loại"}`,
        `Nguồn: ${rieng.nguon ?? "không rõ"}`,
        `Ngày đăng: ${muc.ngay ?? "không rõ"}`,
        `Tóm tắt: ${muc.tomTat}`,
      ];

      if (muc.noiDung) {
        const cat =
          muc.noiDung.length > DO_DAI_TOI_DA_MOI_MUC
            ? `${muc.noiDung.slice(0, DO_DAI_TOI_DA_MOI_MUC)}\n[…phần còn lại đã lược bớt]`
            : muc.noiDung;
        dong.push(`Nội dung: ${cat}`);
      }

      return dong.join("\n");
    })
    .join("\n\n");
}

export interface ThamSoHoi {
  cauHoi: string;
  /** Bật thì bắt buộc sinh cả bản đọc; tắt thì bản đọc vẫn có nhưng không phải ưu tiên */
  cheDoGiongNoi?: boolean;
}

export interface KetQuaHoi {
  traLoi: TraLoiTroLy;
  tokenAiVao: number;
  tokenAiRa: number;
}

export async function hoiTroLy(thamSo: ThamSoHoi): Promise<KetQuaHoi> {
  const cauHoi = (thamSo.cauHoi ?? "").trim();
  if (!cauHoi) {
    throw new LoiTroLy("tham_so_sai", "Thiếu tham số 'cauHoi'.");
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    throw new LoiTroLy(
      "loi_he_thong",
      "Máy chủ chưa có ANTHROPIC_API_KEY. Thêm khoá vào file .env rồi khởi động lại.",
    );
  }

  // Bước 1: tìm nội dung liên quan, đọc cả toàn văn
  const timDuoc = await timKiemNoiDung({
    tuKhoa: cauHoi,
    soLuong: SO_NOI_DUNG_DOC,
    kemNoiDung: true,
  });

  const nguonThamKhao: NguonThamKhao[] = timDuoc.ketQua.map((m) => ({
    id: m.id,
    tieuDe: m.tieuDe,
    duongDan: m.duongDan,
  }));

  // Kho rỗng thì trả lời thẳng, khỏi tốn một lượt gọi Claude để nói "không có gì"
  if (timDuoc.ketQua.length === 0) {
    const loiNhan = `Trong kho chưa có nội dung nào liên quan tới "${cauHoi}".`;
    return {
      traLoi: {
        traLoiNgan: chuanHoaDeDoc(loiNhan, TRAN_TRA_LOI_NGAN),
        traLoiDay: `${loiNhan}\n\nCó thể nội dung này chưa được quét về, hoặc cần thử từ khoá khác.`,
        nguonThamKhao: [],
        trang: TEN_TRANG,
      },
      tokenAiVao: 0,
      tokenAiRa: 0,
    };
  }

  // Bước 2: đưa cho Claude đọc và trả lời
  const claude = new Anthropic();

  const phanHoi = await claude.messages.create({
    model: "claude-opus-5",
    // Để rộng tay: trên Claude Opus 5 phần suy nghĩ cũng tính vào max_tokens,
    // đặt sát quá sẽ bị cắt giữa câu trả lời
    max_tokens: 8000,
    system: LOI_DAN_HE_THONG,
    output_config: {
      effort: "medium",
      format: KHUNG_TRA_LOI,
    },
    messages: [
      {
        role: "user",
        content: `Câu hỏi: ${cauHoi}\n\nNội dung tìm được trong kho:\n\n${dungPhanNoiDung(timDuoc.ketQua)}`,
      },
    ],
  });

  if (phanHoi.stop_reason === "refusal") {
    throw new LoiTroLy("loi_he_thong", "Trợ lý từ chối trả lời câu hỏi này.");
  }

  const khoiChu = phanHoi.content.find((k) => k.type === "text");
  if (!khoiChu || khoiChu.type !== "text") {
    throw new LoiTroLy("loi_he_thong", "Trợ lý không trả về nội dung nào.");
  }

  const doc = KetQuaClaude.safeParse(JSON.parse(khoiChu.text));
  if (!doc.success) {
    throw new LoiTroLy("loi_he_thong", "Trợ lý trả về dữ liệu sai định dạng.");
  }

  return {
    traLoi: {
      // Prompt đã dặn viết ngắn và không ký hiệu; hàm này là lưới an toàn cuối
      // cùng, phòng khi model vẫn lỡ chèn markdown hay đường dẫn vào
      traLoiNgan: chuanHoaDeDoc(doc.data.traLoiNgan, TRAN_TRA_LOI_NGAN),
      traLoiDay: doc.data.traLoiDay,
      nguonThamKhao,
      trang: TEN_TRANG,
    },
    tokenAiVao: phanHoi.usage.input_tokens,
    tokenAiRa: phanHoi.usage.output_tokens,
  };
}
