/**
 * Thuật lại bài viết tiếng nước ngoài thành tiếng Việt.
 *
 * ĐÂY LÀ LÝ DO PHASE 2 ĐƯỢC XẾP LÊN SỚM. Tin AI trên YouTube tiếng Việt chậm
 * hơn nhiều so với blog và diễn đàn phương Tây. Đọc thẳng nguồn gốc rồi thuật
 * lại bằng tiếng Việt là cách bù độ trễ đó.
 *
 * BẢN QUYỀN — ràng buộc quan trọng nhất ở đây: **thuật lại bằng lời văn riêng,
 * không dịch nguyên văn**. Bản thiết kế ghi rõ trong mục rủi ro: dùng cá nhân,
 * không xuất bản, và phải diễn đạt lại chứ không sao chép câu chữ. Lời dặn bên
 * dưới nói thẳng điều này với Claude.
 *
 * "Đầy đủ" nghĩa là giữ đủ ý và đủ chi tiết để đọc xong không cần mở bài gốc —
 * khác hẳn với tóm tắt. Một bài 15.000 chữ tiếng Anh cho ra bản thuật lại vài
 * nghìn chữ tiếng Việt, chứ không phải năm dòng.
 */

import { goiClaudeCli } from "./claudeCli";
import { chonCachGoi } from "./phanLoai";

/** Bài dài hơn ngần này thì cắt bớt — bài tử tế hiếm khi vượt. */
const TOI_DA_CHU_VAO = 40_000;

const LOI_DAN = `Bạn giúp một người Việt theo dõi tin công nghệ và AI từ nguồn nước ngoài.

Nhiệm vụ: đọc một bài viết rồi THUẬT LẠI bằng tiếng Việt.

## Thuật lại, không phải dịch, cũng không phải tóm tắt

**Không dịch nguyên văn.** Hãy đọc hiểu rồi kể lại bằng lời văn của chính bạn.
Đây là yêu cầu bắt buộc về bản quyền, không phải gợi ý.

**Không tóm tắt.** Giữ đủ ý và đủ chi tiết để người đọc xong không cần mở bài
gốc: các con số, tên riêng, kết luận, ví dụ cụ thể, và cả những chỗ tác giả nói
"cái này chưa chắc" hay "tôi chưa thử". Một bài dài cho ra bản thuật lại dài.

## Cách viết

- Tiếng Việt tự nhiên, như đang kể cho một người bạn am hiểu công nghệ.
- Thuật ngữ đã quen thì giữ nguyên tiếng Anh (prompt, token, agent, fine-tune),
  đừng dịch gượng ép.
- Giữ nguyên tên sản phẩm, tên công ty, tên người, số phiên bản.
- Chia đoạn rõ ràng. Dùng tiêu đề nhỏ nếu bài gốc có nhiều phần.
- Viết thẳng vào nội dung. Đừng mở đầu bằng "Bài viết này nói về…".

## Nói rõ điều bạn không chắc

Nếu bài gốc bị cắt cụt, chỉ có tóm tắt, hoặc nội dung không đọc được, hãy nói
thẳng ở cuối bằng một dòng bắt đầu bằng "Ghi chú:" — đừng bịa thêm cho đủ bài.

Chỉ trả về bản thuật lại. Không thêm lời dẫn, không thêm nhận xét của bạn.`;

export interface KetQuaThuatLai {
  banThuatLai: string;
  soChuVao: number;
  soChuRa: number;
  modelDaDung: string;
}

/**
 * Nhờ Claude thuật lại một bài viết.
 *
 * Dùng Sonnet: đây là việc viết lách thật sự, cần giữ giọng văn tự nhiên và
 * hiểu đúng sắc thái. Khác hẳn việc xếp nhóm ở bước phân loại.
 */
export async function thuatLaiMotBai(
  tieuDe: string,
  vanBanGoc: string,
  tenNguon?: string | null,
): Promise<KetQuaThuatLai> {
  if (chonCachGoi() !== "cli") {
    throw new Error(
      "Phần thuật lại hiện chỉ chạy qua Claude CLI. Cài Claude Code trên máy " +
        "và đăng nhập, hoặc bỏ CACH_GOI_CLAUDE=\"api\" trong .env.",
    );
  }

  const catBot = vanBanGoc.length > TOI_DA_CHU_VAO;
  const noiDung = [
    `Tiêu đề: ${tieuDe}`,
    tenNguon ? `Nguồn: ${tenNguon}` : null,
    "",
    catBot
      ? `Nội dung (bài dài nên đây là phần đầu):\n${vanBanGoc.slice(0, TOI_DA_CHU_VAO)}`
      : `Nội dung:\n${vanBanGoc}`,
  ]
    .filter((d) => d !== null)
    .join("\n");

  const model = process.env.MODEL_THUAT_LAI?.trim() || "claude-sonnet-5";

  const goi = await goiClaudeCli({
    loiDan: LOI_DAN,
    cauHoi: noiDung,
    model,
  });

  const banThuatLai = goi.vanBan.trim();

  if (banThuatLai.length < 200) {
    throw new Error(
      `Bản thuật lại quá ngắn (${banThuatLai.length} ký tự) — nhiều khả năng bài gốc không đọc được.`,
    );
  }

  return {
    banThuatLai,
    soChuVao: goi.dung.tokenVao + goi.dung.tokenTaoCache,
    soChuRa: goi.dung.tokenRa,
    modelDaDung: model,
  };
}
