/**
 * Nhờ Claude đọc bình luận rồi chấm chất lượng thảo luận.
 *
 * ĐÂY LÀ MẢNH GHÉP QUAN TRỌNG NHẤT của engine chấm điểm, và cũng là thứ phân
 * biệt web này với việc chỉ sắp xếp theo lượt xem.
 *
 * VÌ SAO CẦN: chấm điểm bằng con số thuần cho kết quả sai lệch. Đã đo thật —
 * mười nội dung điểm cao nhất trong kho đều là tin thời sự giật gân, cao hơn
 * mọi chuyên mục chủ dự án thực sự quan tâm. Lý do là tin giật gân vốn có tỷ lệ
 * bình luận rất cao, mà máy thì không phân biệt được bình luận thực chất với
 * bình luận phẫn nộ vài chữ.
 *
 * Đúng như bản thiết kế đã lường: *"video 2 triệu view nhưng bình luận toàn
 * emoji phải xếp dưới video 50 nghìn view có thảo luận thực chất"*.
 *
 * BA CỜ TÍN HIỆU, theo đúng bản thiết kế:
 *   - `spam_emoji_only`       — bình luận toàn emoji, khen suông, spam
 *   - `clickbait_complaint`   — người xem tố tiêu đề sai nội dung
 *   - `praised_specific_detail` — khen đúng một chi tiết cụ thể trong nội dung,
 *     dấu hiệu người xem thật sự xem hết chứ không lướt
 *
 * Cờ tố clickbait đặc biệt đáng giá: nó rẻ hơn nhiều so với bắt mô hình đọc hết
 * lời thoại để tự phát hiện tiêu đề sai nội dung.
 */

import * as z from "zod/v4";

import type { BinhLuan } from "@/lib/youtube/layBinhLuan";

import { goiClaudeCli } from "./claudeCli";
import { chonCachGoi } from "./phanLoai";

/** Khuôn trả lời Claude phải tuân theo. */
export const KhungChamBinhLuan = z.object({
  diemThaoLuan: z
    .number()
    .describe(
      "Từ 0 đến 1. 0 = toàn spam, emoji, khen suông vô nghĩa. " +
        "0,5 = bình luận bình thường, có phản hồi nhưng nông. " +
        "1 = thảo luận thực chất: người xem bàn về nội dung cụ thể, hỏi lại, " +
        "bổ sung thông tin, tranh luận có căn cứ.",
    ),

  binhLuanToanEmoji: z
    .boolean()
    .describe(
      "True khi phần lớn bình luận chỉ là emoji, 'hay quá', 'hóng', " +
        "hoặc spam quảng cáo — không nói gì về nội dung.",
    ),

  toTieuDeSaiNoiDung: z
    .boolean()
    .describe(
      "True khi có người tố tiêu đề giật gân, sai sự thật, hoặc nội dung " +
        "không đúng như tiêu đề hứa. Đây là tín hiệu rất mạnh về chất lượng.",
    ),

  khenChiTietCuThe: z
    .boolean()
    .describe(
      "True khi có bình luận khen hoặc bàn về một chi tiết CỤ THỂ trong nội " +
        "dung (nhắc mốc thời gian, trích một câu, hỏi về một ý). Đây là dấu " +
        "hiệu người xem thật sự xem hết chứ không lướt qua.",
    ),

  nhanXet: z
    .string()
    .describe("Một câu tiếng Việt nói gọn phần bình luận cho thấy điều gì."),
});

export type KetQuaChamBinhLuan = z.infer<typeof KhungChamBinhLuan>;

const LOI_DAN = `Bạn giúp đánh giá chất lượng phần bình luận của một video.

Nhiệm vụ: đọc các bình luận nổi bật rồi cho biết phần thảo luận này thực chất
tới đâu.

## Vì sao việc này quan trọng

Lượt xem và số bình luận không nói lên chất lượng. Một video giật gân có thể có
hàng nghìn bình luận phẫn nộ vài chữ, trong khi một bài giảng hay chỉ có vài
chục bình luận nhưng người xem bàn đúng vào nội dung.

Cái cần tìm là: **người bình luận có thật sự xem và nghĩ về nội dung không?**

## Cách chấm điểm thảo luận

- **Gần 0**: toàn emoji, "hay quá", "hóng", "điểm danh", spam bán hàng, hoặc
  chửi bới không liên quan nội dung.
- **Khoảng 0,5**: bình luận có chữ nghĩa nhưng nông — cảm ơn, khen chung chung,
  kể chuyện cá nhân không liên quan.
- **Gần 1**: người xem nhắc tới chi tiết cụ thể trong nội dung, hỏi lại, bổ
  sung thông tin, tranh luận có căn cứ, sửa lỗi cho người làm nội dung.

## Ba cờ cần gắn

Đọc kỹ trước khi gắn — gắn sai làm sai lệch cả bảng xếp hạng.

**Tố tiêu đề sai nội dung** là tín hiệu mạnh nhất: khi có người nói "tiêu đề một
đằng nội dung một nẻo", "câu view", "clickbait", hoặc phàn nàn không thấy thứ
tiêu đề hứa.

**Khen chi tiết cụ thể** nghĩa là bình luận nhắc tới thứ chỉ ai xem mới biết —
một mốc thời gian, một câu trong bài, một ví dụ. Khen chung chung kiểu "video
hay lắm" KHÔNG tính.

Trả lời DUY NHẤT một object JSON hợp lệ theo khuôn được cho. Không viết gì thêm.`;

function dinhKemKhuon(): string {
  const khuon = JSON.stringify(z.toJSONSchema(KhungChamBinhLuan), null, 1);
  return `\n\n## Khuôn trả lời\n\nChỉ trả về JSON đúng khuôn này, không bọc trong dấu \`\`\`:\n${khuon}`;
}

function bocJson(vanBan: string): string {
  const daBoRao = vanBan
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();
  const dau = daBoRao.indexOf("{");
  const cuoi = daBoRao.lastIndexOf("}");
  if (dau === -1 || cuoi === -1 || cuoi < dau) return daBoRao;
  return daBoRao.slice(dau, cuoi + 1);
}

/** Gói bình luận thành đoạn chữ gửi cho Claude. */
function soanBinhLuan(tieuDe: string, cacBinhLuan: BinhLuan[]): string {
  const danhSach = cacBinhLuan
    .map(
      (bl, i) =>
        `${i + 1}. [${bl.soThich} thích${bl.soTraLoi > 0 ? `, ${bl.soTraLoi} trả lời` : ""}] ${bl.chu.slice(0, 400)}`,
    )
    .join("\n");

  return `Tiêu đề video: ${tieuDe}\n\nCác bình luận nổi bật:\n\n${danhSach}`;
}

/**
 * Chấm chất lượng thảo luận của một video.
 *
 * Dùng Haiku: đây là việc đọc lướt vài chục dòng ngắn rồi cho một con số, không
 * cần suy nghĩ sâu như việc thuật lại bài viết.
 */
export async function chamBinhLuanMotVideo(
  tieuDe: string,
  cacBinhLuan: BinhLuan[],
): Promise<KetQuaChamBinhLuan> {
  if (chonCachGoi() !== "cli") {
    throw new Error(
      "Phần chấm bình luận hiện chỉ chạy qua Claude CLI trên máy.",
    );
  }

  const model = process.env.MODEL_CHAM_BINH_LUAN?.trim() || "claude-haiku-4-5";

  const goi = await goiClaudeCli({
    loiDan: LOI_DAN + dinhKemKhuon(),
    cauHoi: soanBinhLuan(tieuDe, cacBinhLuan),
    model,
  });

  let tho: unknown;
  try {
    tho = JSON.parse(bocJson(goi.vanBan));
  } catch {
    throw new Error(
      `Claude trả về thứ không phải JSON: ${goi.vanBan.slice(0, 150)}`,
    );
  }

  const kiemTra = KhungChamBinhLuan.safeParse(tho);
  if (!kiemTra.success) {
    const loiDau = kiemTra.error.issues[0];
    throw new Error(
      `JSON sai khuôn ở "${loiDau?.path.join(".")}": ${loiDau?.message}`,
    );
  }

  // Chặn giá trị ngoài khoảng, phòng khi mô hình trả về số lạ
  const diem = Math.max(0, Math.min(1, kiemTra.data.diemThaoLuan));

  return { ...kiemTra.data, diemThaoLuan: diem };
}
