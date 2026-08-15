/**
 * Chỉ hiện thứ nghe/xem được bằng tiếng Việt.
 *
 * ĐÂY LÀ NGUYÊN TẮC NỀN, không phải một bộ lọc tuỳ chọn. Chủ dự án chốt ngày
 * 2026-08-15: *"Ngôn ngữ là tiếng Việt. Mọi ngôn ngữ khác mà dùng tiếng Anh
 * gọi là vô tri, không có ý nghĩa gì hết."*
 *
 * Nghĩa là một video hay tới đâu, điểm cao tới mấy, mà chỉ có tiếng Anh thì
 * với chủ nhà **bằng không**. Để nó nằm trên trang chủ không phải là "cho thêm
 * lựa chọn" — đó là chiếm mất chỗ của thứ dùng được.
 *
 * ĐƯỜNG SỐNG DUY NHẤT cho nội dung nước ngoài: Am đọc, dịch, kể lại bằng tiếng
 * Việt (`NarrationAsset`). Có bản thuật lại rồi thì hiện bình thường — chủ dự
 * án nói rõ khi đó chữ dài cũng được, vì sẽ có bản âm thanh tiếng Việt đi kèm.
 */

import type { Prisma } from "@/generated/prisma/client";

/**
 * Dấu Claude ghi khi ĐỌC nội dung và thấy không phải tiếng Việt.
 *
 * Cố ý không phải mã ngôn ngữ chuẩn, để phân biệt với thứ YouTube khai báo.
 */
export const KHAC_TIENG_VIET = "khac";

/**
 * Bọc điều kiện sẵn có thêm ràng buộc "nghe được bằng tiếng Việt".
 *
 * CHỈ GIẤU THỨ CLAUDE ĐÃ ĐỌC VÀ KHẲNG ĐỊNH LÀ TIẾNG NƯỚC NGOÀI. Không tin mã
 * ngôn ngữ do YouTube khai — nó sai nhiều tới mức nguy hiểm. Đo thật trong kho:
 *
 *   - *"SỐNG CÓ ĐỨC – VƯỢT QUA NGHIỆP NẶNG, TÂM AN, ĐỜI TỰ NHIÊN"* khai là `en`
 *   - Bốn video nhạc Việt "DIGIDI DIGIDI" khai là `nl-NL` (tiếng Hà Lan)
 *
 * Tin mã đó thì giấu mất đúng nội dung tiếng Việt mà chủ nhà cần. Nên nguyên
 * tắc ở đây là **thà lọt còn hơn giấu nhầm**: chỉ chặn khi Claude đã thật sự
 * đọc và kết luận, còn lại để hiện.
 *
 * Nội dung nước ngoài có bản thuật lại tiếng Việt thì vẫn hiện — chủ dự án nói
 * rõ khi đó chữ dài cũng được, vì sẽ có bản âm thanh tiếng Việt đi kèm.
 *
 * Dùng `AND` chứ không trải thẳng, vì bên trong có `OR` và nơi gọi cũng thường
 * đã có `OR` riêng — trải thẳng thì cái sau đè mất cái trước, lỗi không báo gì
 * mà lặng lẽ cho kết quả sai. Đã vấp đúng kiểu này ở bộ lọc lịch sử xem.
 */
export function ngheDuocTiengViet(
  dieuKien: Prisma.ContentItemWhereInput,
): Prisma.ContentItemWhereInput {
  return {
    AND: [
      dieuKien,
      {
        OR: [
          // Ô trống phải liệt kê RIÊNG. Trong SQL, `NOT (cột = 'khac')` với ô
          // trống cho ra NULL chứ không phải "đúng", nên dòng dưới một mình sẽ
          // loại luôn mọi nội dung chưa biết ngôn ngữ. Đã đo: 29 mục biến mất
          // oan dù chưa lượt phân loại nào ghi giá trị "khac" cả.
          { originalLanguage: null },
          { NOT: { originalLanguage: KHAC_TIENG_VIET } },
          { narrationAsset: { isNot: null } },
        ],
      },
    ],
  };
}

/** Nội dung này chủ nhà nghe/đọc được không. */
export function tiengVietDungDuoc(muc: {
  originalLanguage: string | null;
  narrationAsset?: { id: string } | null;
}): boolean {
  if (muc.narrationAsset) return true;
  return muc.originalLanguage !== KHAC_TIENG_VIET;
}
