/**
 * Nhờ Claude viết bản tin hằng sáng.
 *
 * ĐÂY LÀ CHỖ QUYẾT ĐỊNH web này có đáng dùng không. Bản thiết kế nói: trình bày
 * dạng **tin nhắn hội thoại tự nhiên**, không phải danh sách dài vô tận — vì
 * danh sách dài chính là thứ người dùng đang muốn thoát khỏi ở YouTube.
 *
 * Nghĩa là bản tin phải nói được những câu mà chỉ ai đã đọc nội dung mới nói
 * được: *"bài này dài nhưng đáng, chỗ hay nhất ở phần giữa"*, *"cái này trùng ý
 * với bài hôm qua, bỏ qua cũng được"*. Nếu chỉ đọc lại tiêu đề thì thà đưa danh
 * sách còn hơn.
 *
 * Claude được đưa: tiêu đề, nguồn, điểm chất lượng, **nhận xét nó đã viết khi
 * phân loại**, và điểm thảo luận từ vòng đọc bình luận. Đủ căn cứ để nói có
 * trọng lượng, chứ không phải khen suông.
 */

import { goiClaudeCli } from "@/lib/llm/claudeCli";
import { chonCachGoi } from "@/lib/llm/phanLoai";

import type { NoiDungBanTin } from "./chonNoiDung";

const LOI_DAN = `Bạn là trợ lý riêng, mỗi sáng kể cho chủ nhân nghe tối qua quét được gì đáng xem.

## Giọng điệu

Nói như một người bạn am hiểu vừa đọc qua mọi thứ, giờ kể lại. Tự nhiên, ngắn
gọn, thẳng thắn. Không phải phát thanh viên, không phải danh sách gạch đầu dòng.

Được phép nói thẳng khi có gì đó không đáng xem: "mấy cái còn lại toàn tin lặp
lại, bỏ qua được". Chủ nhân cần một người biết chắt lọc, không cần người khen
đều tất cả.

## Cấu trúc

Mở đầu một câu về tối qua có gì. Rồi đi qua từng chuyên mục có nội dung, mỗi
mục vài câu. Kết bằng một câu gợi ý nên bắt đầu từ đâu nếu chỉ có ít thời gian.

Viết liền mạch thành đoạn văn. **Không dùng gạch đầu dòng, không đánh số, không
tiêu đề Markdown.** Đây là lời nói, không phải báo cáo.

## Điều quan trọng nhất

Bạn được cho sẵn **nhận xét mà chính bạn đã viết khi đọc từng nội dung**, kèm
điểm chất lượng và điểm chất lượng thảo luận. Hãy dùng chúng để nói những câu
có trọng lượng — vì sao cái này đáng xem hơn cái kia, cái nào dài mà vẫn đáng,
cái nào chỉ nên lướt.

Đừng đọc lại tiêu đề. Chủ nhân đọc được tiêu đề rồi. Hãy nói thứ họ chưa biết.

Nhắc tên nội dung thì dùng nguyên văn tiêu đề, đặt trong dấu ngoặc kép, để họ
tìm lại được.

Độ dài: khoảng 150 đến 250 chữ. Ngắn hơn thì hời hợt, dài hơn thì lại thành cái
danh sách mà ta đang tránh.

Chỉ trả về nội dung bản tin. Không thêm lời dẫn, không tiêu đề.`;

/** Gói nội dung đã chọn thành đoạn chữ đưa cho Claude. */
function soanNguyenLieu(noiDung: NoiDungBanTin): string {
  const phan: string[] = [
    `Tối qua quét về ${noiDung.tongMoi} nội dung mới. Sau khi chấm điểm và lọc, đây là những cái đáng nói:`,
  ];

  for (const muc of noiDung.noiBat) {
    phan.push(`\n## ${muc.ten}`);

    for (const m of muc.cacMuc) {
      const pl = m.classification;
      const dong = [
        `"${m.title}"`,
        `  nguồn: ${m.source.title}`,
        m.durationSeconds
          ? `  dài: ${Math.round(m.durationSeconds / 60)} phút`
          : null,
        m.score?.compositeScore != null
          ? `  điểm chất lượng: ${m.score.compositeScore.toFixed(1)}/10`
          : null,
        m.commentAnalysis
          ? `  chất lượng thảo luận dưới bình luận: ${m.commentAnalysis.discussionQualityScore.toFixed(2)}/1`
          : null,
        pl?.extractedAuthorNameRaw ? `  tác giả: ${pl.extractedAuthorNameRaw}` : null,
        m.narrationAsset ? `  đã có bản thuật lại tiếng Việt` : null,
        pl?.contentQualityNotes
          ? `  nhận xét của bạn khi đọc: ${pl.contentQualityNotes}`
          : null,
      ].filter(Boolean);

      phan.push(dong.join("\n"));
    }
  }

  if (noiDung.xemThemNeuRanh.length > 0) {
    phan.push(`\n## Xem thêm nếu rảnh`);
    for (const m of noiDung.xemThemNeuRanh) {
      phan.push(
        `"${m.title}" (${m.source.title}` +
          `${m.score?.compositeScore != null ? `, ${m.score.compositeScore.toFixed(1)}/10` : ""})`,
      );
    }
  }

  return phan.join("\n");
}

export interface KetQuaVietBanTin {
  banTin: string;
  modelDaDung: string;
}

/** Nhờ Claude viết bản tin. Dùng Sonnet vì đây là việc viết lách. */
export async function vietBanTin(
  noiDung: NoiDungBanTin,
): Promise<KetQuaVietBanTin> {
  if (chonCachGoi() !== "cli") {
    throw new Error("Phần viết bản tin hiện chỉ chạy qua Claude CLI trên máy.");
  }

  const coGiDeNoi = noiDung.noiBat.some((m) => m.cacMuc.length > 0);
  if (!coGiDeNoi) {
    throw new Error(
      "Không có nội dung nào thuộc bốn chuyên mục chính trong khoảng thời gian xét.",
    );
  }

  const model = process.env.MODEL_BAN_TIN?.trim() || "claude-sonnet-5";

  const goi = await goiClaudeCli({
    loiDan: LOI_DAN,
    cauHoi: soanNguyenLieu(noiDung),
    model,
  });

  const banTin = goi.vanBan.trim();

  if (banTin.length < 100) {
    throw new Error(`Bản tin quá ngắn (${banTin.length} ký tự).`);
  }

  return { banTin, modelDaDung: model };
}
