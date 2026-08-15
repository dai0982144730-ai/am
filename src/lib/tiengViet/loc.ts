/**
 * Nội dung nước ngoài: LỒNG TIẾNG, KHÔNG ẨN.
 *
 * ## Tôi đã hiểu sai một lần, ghi lại để không lặp
 *
 * Chủ dự án nói *"mọi ngôn ngữ khác mà dùng tiếng Anh gọi là vô tri, không có ý
 * nghĩa gì hết"*. Tôi hiểu thành "vậy thì ẩn nó đi", và làm một bộ lọc giấu sạch
 * nội dung tiếng nước ngoài chưa có bản đọc tiếng Việt.
 *
 * Sai. Chủ dự án mở giao diện ra, thấy ngay, và hỏi (2026-08-15):
 *
 *   *"AI có 28 mà hiện lên chỉ có 05 là sao? các bài từ blog, từ nguồn không
 *   phải youtube biến mất sạch??"*
 *
 * Câu "vô tri" nói về **trạng thái chưa xử lý**, không phải bản án. Một clip AI
 * hay bằng tiếng Anh không phải thứ cần vứt đi — nó là thứ cần lồng tiếng. Ẩn
 * đi là bỏ mất đúng phần nội dung tốt nhất mà lại chẳng giải quyết gì.
 *
 * Hậu quả đo được của cách hiểu sai: **28 bài blog và 8 bài diễn đàn biến mất
 * sạch** khỏi giao diện, chuyên mục Music trống trơn, chuyên mục AI từ 28 còn 5.
 *
 * ## Nên giờ ở đây không có bộ lọc nào nữa
 *
 * File này chỉ còn giữ cách **nhận biết** nội dung chưa nghe được bằng tiếng
 * Việt, để giao diện dán nhãn và để hàng đợi lồng tiếng biết phải làm gì trước.
 * Nhận biết thì có, giấu thì không.
 */

import type { Prisma } from "@/generated/prisma/client";

/**
 * Dấu Claude ghi khi ĐỌC nội dung và thấy không phải tiếng Việt.
 *
 * Cố ý không phải mã ngôn ngữ chuẩn, để phân biệt với thứ YouTube khai báo —
 * mã của YouTube sai nhiều tới mức nguy hiểm. Đo thật trong kho: một bài giảng
 * tiếng Việt khai là `en`, bốn video nhạc Việt khai là `nl-NL`.
 */
export const KHAC_TIENG_VIET = "khac";

/**
 * Nội dung này chủ nhà đã nghe được bằng tiếng Việt chưa.
 *
 * `false` nghĩa là **cần lồng tiếng**, không phải "bỏ đi".
 */
export function ngheDuocBangTiengViet(muc: {
  originalLanguage: string | null;
  contentGroup?: string | null;
  narrationAsset?: { ttsAudioUrl: string | null } | null;
}): boolean {
  // Nhạc luôn nghe được: nghe giai điệu chứ không phải hiểu lời. Bản thiết kế
  // cũng không cho LLM đọc sâu nhánh nhạc, nên kết luận ngôn ngữ của nhạc chỉ
  // dựa vào mỗi cái tiêu đề — tức là đoán mò.
  if (muc.contentGroup === "music") return true;
  if (muc.narrationAsset?.ttsAudioUrl) return true;
  return muc.originalLanguage !== KHAC_TIENG_VIET;
}

/**
 * Điều kiện Prisma cho "đang chờ lồng tiếng".
 *
 * Dùng để xếp hàng đợi lồng tiếng và để đếm, KHÔNG dùng để giấu khỏi giao diện.
 */
export const CHO_LONG_TIENG: Prisma.ContentItemWhereInput = {
  originalLanguage: KHAC_TIENG_VIET,
  NOT: { contentGroup: "music" },
  OR: [
    { narrationAsset: { is: null } },
    { narrationAsset: { is: { ttsAudioUrl: null } } },
  ],
};
