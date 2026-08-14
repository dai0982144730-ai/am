/**
 * Nhờ Claude đọc nội dung rồi xếp vào đúng chuyên mục.
 *
 * Ba quyết định về chi phí, vì đây là chỗ tốn tiền nhất trong cả hệ thống —
 * mỗi video quét về đều phải đi qua đây:
 *
 * 1. **Dùng Haiku, không dùng Sonnet.** Việc ở bước này là xếp nhóm và điền vài
 *    trường, không phải phân tích sâu. Haiku rẻ hơn ba lần và làm tốt việc này.
 *    Sonnet để dành cho bước chấm chất lượng (Phase 4), khi chỉ còn vài chục
 *    ứng viên đứng đầu chứ không phải cả nghìn video.
 *
 * 2. **Bản hướng dẫn được ghi nhớ tạm.** Phần hướng dẫn phân loại dài và giống
 *    hệt nhau ở mọi lần gọi, nên đánh dấu để Claude nhớ lại thay vì đọc lại từ
 *    đầu mỗi lần — phần nhớ lại chỉ tốn khoảng một phần mười.
 *
 * 3. **Cắt bớt lời thoại.** Để biết một video thuộc chuyên mục nào thì mấy nghìn
 *    chữ đầu là đủ; gửi cả bản 130.000 chữ chỉ tốn tiền vô ích.
 *
 * Câu trả lời đi theo khuôn định sẵn (`KhungPhanLoai`), nên không phải dò tìm
 * trong văn bản tự do và không sợ Claude trả về thứ không đọc được.
 */

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

import { KhungPhanLoai, type KetQuaPhanLoai } from "./khungPhanLoai";

/** Đổi được qua .env khi muốn thử model khác. */
const MODEL_MAC_DINH = "claude-haiku-4-5";

/** Số chữ lời thoại gửi cho Claude. Đủ để biết chuyên mục. */
const TOI_DA_CHU_LOI_THOAI = 4_000;

/** Phiên bản hướng dẫn — đổi hướng dẫn thì tăng số này để biết bản ghi cũ mới. */
export const PHIEN_BAN_HUONG_DAN = "v1";

/**
 * Hướng dẫn phân loại.
 *
 * Viết dài có chủ đích: mô tả rõ từng chuyên mục và từng cạm bẫy sẽ cho kết quả
 * ổn định hơn nhiều so với một câu chung chung. Phần này giống hệt nhau ở mọi
 * lần gọi nên được ghi nhớ tạm, dài thêm gần như không tốn thêm tiền.
 */
const HUONG_DAN = `Bạn giúp một người Việt sắp xếp nội dung họ quét về mỗi ngày từ YouTube.

Nhiệm vụ: đọc thông tin một video rồi xếp vào đúng chuyên mục và điền các trường liên quan.

## Năm chuyên mục

**ai** — tin tức và hướng dẫn về trí tuệ nhân tạo: tin về các hãng AI, cách dùng
công cụ AI, kinh nghiệm viết code bằng AI, hệ thống AI cho doanh nghiệp.

**triet_hoc** — triết học, tâm lý học, và Phật giáo Nguyên thuỷ (Theravada).
Gồm giảng pháp, vấn đáp, hướng dẫn thực hành đời sống, phân tích học thuật.
Chủ nghĩa khắc kỷ (Stoic), chủ nghĩa hiện sinh, tâm lý học hiện đại đều vào đây.

**truyen** — truyện kể có cốt truyện: kinh dị, viễn tưởng, phiêu lưu mạo hiểm.
Người đọc kể lại một câu chuyện hư cấu. KHÔNG tính chuyện có thật, tin tức, hay
kể chuyện đời mình.

**music** — nhạc: nhạc tập thể thao theo nhịp, dance, piano, guitar rock, nhạc vàng.

**other** — mọi thứ còn lại. Đây là lựa chọn ĐÚNG cho phần lớn nội dung: tin thời
sự, chính trị, giải trí, hài, thể thao, ẩm thực, du lịch, công nghệ tiêu dùng,
sức khoẻ, dạy nấu ăn, review sản phẩm, vlog đời thường.

## Nguyên tắc quan trọng nhất

**Đừng cố nhét vào bốn nhóm đầu.** Người dùng cần bốn nhóm đó thật tinh, thà bỏ
sót còn hơn lẫn tạp. Một video tin tức nhắc thoáng qua chữ "AI" thì vẫn là
'other', không phải 'ai'. Một video kể chuyện ma có thật thì là 'other', không
phải 'truyen'. Chỉ xếp vào bốn nhóm đầu khi nội dung CHÍNH thuộc về nhóm đó.

## Cạm bẫy

- **Đừng đoán số nhịp (BPM)**: chỉ điền khi tiêu đề hoặc mô tả ghi rõ con số.
  Nghe nhạc qua chữ là không thể.
- **Đừng nhầm tên kênh với tên tác giả**: trường tên tác giả dành cho nhà văn,
  giảng sư, diễn giả được nêu trong nội dung — không phải tên kênh đăng video.
- **Cẩn thận với truyện do AI viết**: dấu hiệu là văn phong đều đều không giọng
  riêng, tình tiết rập khuôn, nhân vật mỏng, mô tả thừa, không rõ tác giả.
- **Mê tín khác với giảng pháp**: bàn về nghiệp, luân hồi, vô thường theo kinh
  điển là giảng pháp bình thường. Chỉ gắn cờ mê tín khi cổ vũ bói toán, thần
  thông, bùa chú, hoặc bán vật phẩm hứa đổi vận.
- **Trường không thuộc chuyên mục thì để trống**: video nhóm 'ai' thì mọi trường
  của truyện, nhạc, triết học đều để null.
- **Không chắc thì để trống**, đừng đoán bừa.

Nhận xét chất lượng viết bằng tiếng Việt, ngắn gọn, nói thẳng vào cái đáng xem
hoặc cái dở của nội dung này.`;

let khachHang: Anthropic | null = null;

function layKhachHang(): Anthropic {
  const khoa = process.env.ANTHROPIC_API_KEY?.trim();

  // Bắt luôn trường hợp còn để nguyên giá trị mẫu trong .env.example — nếu
  // không thì phải gọi API mới biết, và lỗi trả về là "API key is invalid"
  // bằng tiếng Anh, không nói được là phải đi lấy khoá ở đâu.
  if (!khoa || khoa === "sk-ant-..." || !khoa.startsWith("sk-ant-")) {
    throw new Error(
      "Chưa có ANTHROPIC_API_KEY thật trong .env " +
        `(hiện tại: ${khoa ? "giá trị mẫu" : "để trống"}).\n` +
        "Lấy tại https://console.anthropic.com → Settings → API Keys, " +
        "rồi điền vào dòng ANTHROPIC_API_KEY trong file .env.",
    );
  }

  khachHang ??= new Anthropic();
  return khachHang;
}

export interface NoiDungCanPhanLoai {
  tieuDe: string;
  moTa?: string | null;
  tenKenh?: string | null;
  thoiLuongGiay?: number | null;
  loiThoai?: string | null;
}

export interface KetQuaGoiClaude {
  ketQua: KetQuaPhanLoai;
  modelDaDung: string;
  tokenVao: number;
  tokenRa: number;
  /** Số token đọc lại từ bộ nhớ tạm — càng cao càng rẻ */
  tokenNhoLai: number;
}

/** Gói thông tin một video thành đoạn văn bản gửi cho Claude. */
function soanNoiDung(noiDung: NoiDungCanPhanLoai): string {
  const phan: string[] = [`Tiêu đề: ${noiDung.tieuDe}`];

  if (noiDung.tenKenh) phan.push(`Kênh: ${noiDung.tenKenh}`);

  if (noiDung.thoiLuongGiay) {
    const phut = Math.round(noiDung.thoiLuongGiay / 60);
    phan.push(`Thời lượng: ${phut} phút`);
  }

  if (noiDung.moTa) {
    // Mô tả YouTube thường có một đoạn đầu hữu ích rồi tới hàng loạt link và
    // hashtag — phần đuôi đó không giúp gì cho việc phân loại
    phan.push(`Mô tả: ${noiDung.moTa.slice(0, 1_500)}`);
  }

  if (noiDung.loiThoai) {
    const catBot = noiDung.loiThoai.length > TOI_DA_CHU_LOI_THOAI;
    phan.push(
      `Lời thoại${catBot ? " (phần đầu)" : ""}: ` +
        noiDung.loiThoai.slice(0, TOI_DA_CHU_LOI_THOAI),
    );
  } else {
    phan.push("Lời thoại: (không lấy được — hãy dựa vào tiêu đề và mô tả)");
  }

  return phan.join("\n\n");
}

/** Phân loại một nội dung. */
export async function phanLoaiMotNoiDung(
  noiDung: NoiDungCanPhanLoai,
): Promise<KetQuaGoiClaude> {
  const model = process.env.MODEL_PHAN_LOAI?.trim() || MODEL_MAC_DINH;

  const phanHoi = await layKhachHang().messages.parse({
    model,
    max_tokens: 2_000,
    system: [
      {
        type: "text",
        text: HUONG_DAN,
        // Đánh dấu để Claude ghi nhớ tạm phần hướng dẫn. Từ lần gọi thứ hai
        // trở đi, phần này chỉ tốn khoảng một phần mười so với đọc lại từ đầu.
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: soanNoiDung(noiDung) }],
    output_config: { format: zodOutputFormat(KhungPhanLoai) },
  });

  if (!phanHoi.parsed_output) {
    throw new Error(
      `Claude trả lời không đúng khuôn (lý do dừng: ${phanHoi.stop_reason}).`,
    );
  }

  return {
    ketQua: phanHoi.parsed_output,
    modelDaDung: phanHoi.model,
    tokenVao: phanHoi.usage.input_tokens,
    tokenRa: phanHoi.usage.output_tokens,
    tokenNhoLai: phanHoi.usage.cache_read_input_tokens ?? 0,
  };
}
