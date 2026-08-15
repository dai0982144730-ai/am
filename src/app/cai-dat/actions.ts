"use server";

/**
 * Các thao tác ghi từ trang Cài đặt.
 *
 * Mọi hàm ở đây đều **chặn cửa bằng `doiHoiChuDuAn` ngay dòng đầu**. Đây là
 * chốt chặn thật, không phải chỉ giấu nút đi trên giao diện: nếu ai đó gọi
 * thẳng vào server action, họ vẫn bị chặn.
 */

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db/prisma";
import { doiHoiChuDuAn } from "@/lib/quyen";
import { CAC_GIONG } from "@/lib/tts/giong";
import type { ContentGroup, SourceType } from "@/generated/prisma/enums";

/**
 * Lưu bộ trọng số chấm điểm cho một loại nguồn.
 *
 * Trọng số được chuẩn hoá về tổng bằng 1 trước khi lưu, nên người dùng cứ kéo
 * thanh trượt thoải mái mà không phải tự tính cho tròn 100%.
 */
export async function luuTrongSo(
  loaiNguon: SourceType,
  trongSo: {
    popularity: number;
    engagementDepth: number;
    discussion: number;
    authority: number;
    contentQuality: number;
  },
): Promise<{ ok: boolean; thongDiep: string }> {
  try {
    await doiHoiChuDuAn("chỉnh trọng số chấm điểm");
  } catch (e) {
    return {
      ok: false,
      thongDiep: e instanceof Error ? e.message : "Không có quyền.",
    };
  }

  const tong =
    trongSo.popularity +
    trongSo.engagementDepth +
    trongSo.discussion +
    trongSo.authority +
    trongSo.contentQuality;

  if (tong <= 0) {
    return { ok: false, thongDiep: "Tổng trọng số phải lớn hơn 0." };
  }

  await prisma.sourceQualityProfile.upsert({
    where: { sourceType: loaiNguon },
    create: {
      sourceType: loaiNguon,
      weightPopularity: trongSo.popularity / tong,
      weightEngagementDepth: trongSo.engagementDepth / tong,
      weightDiscussion: trongSo.discussion / tong,
      weightAuthority: trongSo.authority / tong,
      weightContentQuality: trongSo.contentQuality / tong,
    },
    update: {
      weightPopularity: trongSo.popularity / tong,
      weightEngagementDepth: trongSo.engagementDepth / tong,
      weightDiscussion: trongSo.discussion / tong,
      weightAuthority: trongSo.authority / tong,
      weightContentQuality: trongSo.contentQuality / tong,
    },
  });

  revalidatePath("/cai-dat");
  return {
    ok: true,
    thongDiep:
      "Đã lưu. Chạy lại `npx tsx scripts/cham-diem.ts` để tính lại điểm theo trọng số mới.",
  };
}

/**
 * Đặt bao nhiêu phần trăm nội dung của một chuyên mục đến từ nguồn mới.
 *
 * Con số này là **TRẦN, không phải chỉ tiêu**. Đặt AI 90% không có nghĩa mỗi
 * đêm phải lấp cho đủ 90% — nếu chỉ vài bài từ nguồn lạ vượt được chuẩn thì
 * đưa bấy nhiêu, phần còn lại trả về cho kênh đã theo dõi. Lấp cho đủ số là
 * cách chắc chắn nhất để nhận về rác.
 */
export async function luuTyLeNguonMoi(
  chuyenMuc: ContentGroup,
  tyLe: number,
): Promise<{ ok: boolean; thongDiep: string }> {
  try {
    await doiHoiChuDuAn("chỉnh tỉ lệ nguồn mới");
  } catch (e) {
    return {
      ok: false,
      thongDiep: e instanceof Error ? e.message : "Không có quyền.",
    };
  }

  const sach = Math.round(tyLe);
  if (sach < 0 || sach > 100) {
    return { ok: false, thongDiep: "Tỉ lệ phải từ 0 đến 100." };
  }

  await prisma.categoryDiscoverySetting.upsert({
    where: { contentGroup: chuyenMuc },
    create: { contentGroup: chuyenMuc, newSourceRatio: sach },
    update: { newSourceRatio: sach },
  });

  revalidatePath("/cai-dat");
  revalidatePath("/");

  return {
    ok: true,
    thongDiep:
      sach === 0
        ? "Chỉ lấy từ nguồn đã theo dõi."
        : `Dành tối đa ${sach}% chỗ cho nguồn mới.`,
  };
}

/**
 * Chọn giọng đọc.
 *
 * Chỉ đổi giọng cho những lần đọc SAU ĐÓ. Bản âm thanh đã tạo giữ nguyên giọng
 * cũ — đọc lại toàn bộ bằng giọng mới thì lần đó mới tốn thêm hạn mức, nên
 * không tự ý làm.
 *
 * Trần miễn phí tự đổi theo giọng, không cần chỉnh gì thêm: Standard được 4
 * triệu ký tự mỗi tháng, Wavenet chỉ 1 triệu.
 */
export async function chonGiongDoc(
  maGiong: string,
): Promise<{ ok: boolean; thongDiep: string }> {
  try {
    await doiHoiChuDuAn("chọn giọng đọc");
  } catch (e) {
    return {
      ok: false,
      thongDiep: e instanceof Error ? e.message : "Không có quyền.",
    };
  }

  const giong = CAC_GIONG.find((g) => g.ma === maGiong);
  if (!giong) {
    return { ok: false, thongDiep: "Giọng không có trong danh sách." };
  }

  await prisma.userAssistantSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", ttsVoice: giong.ma },
    update: { ttsVoice: giong.ma },
  });

  revalidatePath("/cai-dat");

  return {
    ok: true,
    thongDiep:
      `Đã chọn ${giong.ten}. Mức miễn phí giờ là ` +
      `${giong.tranMienPhi.toLocaleString("vi-VN")} ký tự mỗi tháng. ` +
      `Bản âm thanh đã tạo trước đó vẫn giữ giọng cũ.`,
  };
}
