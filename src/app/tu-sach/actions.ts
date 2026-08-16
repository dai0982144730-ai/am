"use server";

/**
 * Thao tác ghi của Tủ sách.
 *
 * Chặn cửa bằng `doiHoiChuDuAn` ngay dòng đầu như mọi server action khác —
 * chốt chặn thật, không phải chỉ giấu nút trên giao diện.
 */

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db/prisma";
import { doiHoiChuDuAn } from "@/lib/quyen";

/** Thêm hoặc bỏ một tác giả khỏi Tủ sách. */
export async function doiTheoDoiTacGia(
  tacGiaId: string,
  theoDoi: boolean,
): Promise<void> {
  await doiHoiChuDuAn("thay đổi Tủ sách");

  await prisma.author.update({
    where: { id: tacGiaId },
    data: {
      theoDoi,
      // Đưa một người vào Tủ sách CŨNG LÀ công nhận họ là tác giả có thật.
      //
      // Bản thiết kế đòi tác giả do máy phát hiện phải được duyệt tay một lần
      // mới cộng điểm uy tín. Bấm "theo dõi" chính là hành động duyệt đó — bắt
      // người dùng bấm thêm một nút "công nhận" nữa là hỏi lại một câu họ vừa
      // trả lời rồi.
      //
      // Chiều ngược lại KHÔNG đối xứng: bỏ theo dõi không rút lại sự công nhận,
      // vì "tôi không muốn nghe người này nữa" khác hẳn "người này không có
      // thật".
      ...(theoDoi
        ? { approvedByUser: true, pendingReview: false }
        : {}),
    },
  });

  revalidatePath("/tu-sach");
  revalidatePath("/kham-pha");
}

/**
 * Bác một cái tên: "đây không phải tên tác giả".
 *
 * VÌ SAO ĐÁNH DẤU CHỨ KHÔNG XOÁ: tên tác giả do Claude rút ra từ chính nội
 * dung, nên lượt phân loại sau sẽ rút ra đúng cái tên đó lần nữa và dựng lại y
 * nguyên. Xoá là mỗi tuần lại phải bác một lần cùng một cái tên.
 *
 * Bác cũng KHÔNG gỡ liên kết với các nội dung đã gắn. Liên kết đó vô hại — nó
 * chỉ ngừng được dùng để cộng điểm uy tín. Gỡ ra thì mất luôn thông tin, mà bác
 * nhầm là chuyện có thật, và bấm lại "Nhận lại" phải trả về đúng như cũ.
 */
export async function doiTuChoiTacGia(
  tacGiaId: string,
  biTuChoi: boolean,
): Promise<void> {
  await doiHoiChuDuAn("duyệt tác giả");

  await prisma.author.update({
    where: { id: tacGiaId },
    data: {
      biTuChoi,
      // Bác rồi thì không còn nằm trong hàng chờ nữa, và dĩ nhiên không còn
      // được công nhận lẫn theo dõi
      ...(biTuChoi
        ? { pendingReview: false, approvedByUser: false, theoDoi: false }
        : { pendingReview: true }),
    },
  });

  revalidatePath("/tu-sach");
  revalidatePath("/kham-pha");
}
