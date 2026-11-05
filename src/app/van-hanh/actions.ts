"use server";

/**
 * Thao tác ghi của trang Vận hành.
 *
 * Chặn cửa bằng `doiHoiChuDuAn` ngay dòng đầu như mọi server action khác — đây
 * là chốt chặn thật, không phải chỉ giấu nút trên giao diện.
 */

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db/prisma";
import { goiClaudeCli, LoiClaudeCli } from "@/lib/llm/claudeCli";
import {
  chuanHoaMa,
  docTrangThai,
  guiMa,
  huyDangNhap,
  moDangNhap,
  type TrangThaiClaude,
} from "@/lib/llm/dangNhapClaude";
import { dangXuat } from "@/lib/llm/taiKhoanClaude";
import { doiHoiChuDuAn } from "@/lib/quyen";
import { kepCuongDo } from "@/lib/vanHanh/cuongDo";
import {
  CAC_CHUYEN_MUC,
  chuanHoaTyLe,
  SO_LAN_TOI_DA,
  SUAT_MAC_DINH,
  type MaChuyenMuc,
  type MaNhomNguon,
} from "@/lib/vanHanh/suatPhanLoai";

/** Đặt cường độ quét đêm, 0–200 phần trăm. */
export async function datCuongDoQuet(cuongDo: number): Promise<void> {
  await doiHoiChuDuAn("đổi cường độ quét");

  // Kẹp lại ở máy chủ chứ không tin con số gửi lên. Thanh trượt chỉ sinh ra giá
  // trị hợp lệ, nhưng lời gọi thì ai cũng gửi được — và một số âm hay một số
  // khổng lồ lọt vào đây là mỗi đêm quét gấp trăm lần, cạn hạn mức trong một
  // tiếng.
  const giaTri = kepCuongDo(cuongDo);

  await prisma.userAssistantSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", cuongDoQuet: giaTri },
    update: { cuongDoQuet: giaTri },
  });

  revalidatePath("/van-hanh");
}

/**
 * Đặt suất phân loại: số bài mỗi chuyên mục và tỷ lệ theo loại nguồn.
 *
 * Kẹp lại ở máy chủ chứ không tin con số gửi lên — giao diện chỉ sinh ra giá
 * trị hợp lệ, nhưng lời gọi thì ai cũng gửi được, và một số khổng lồ lọt vào
 * đây là một đêm gọi Claude hàng nghìn lần.
 */
export async function datSuatPhanLoai(
  chuyenMuc: Record<string, number>,
  tyLeNguon: Partial<Record<MaNhomNguon, number>>,
): Promise<void> {
  await doiHoiChuDuAn("đổi suất phân loại");

  const suat: Record<string, number> = {};
  for (const m of CAC_CHUYEN_MUC) {
    const tran = SUAT_MAC_DINH[m as MaChuyenMuc] * SO_LAN_TOI_DA;
    const n = Number(chuyenMuc[m]);
    suat[m] = Number.isFinite(n) ? Math.max(0, Math.min(tran, Math.round(n))) : SUAT_MAC_DINH[m as MaChuyenMuc];
  }

  // Tính lại ba phần trăm ở máy chủ nữa, không dựa vào việc giao diện đã tính
  // đúng. Đây là chỗ bảo đảm tổng luôn bằng 100.
  const tyLe = chuanHoaTyLe(tyLeNguon);

  await prisma.userAssistantSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", suatChuyenMuc: suat, tyLeNguon: tyLe },
    update: { suatChuyenMuc: suat, tyLeNguon: tyLe },
  });

  revalidatePath("/van-hanh");
}

// ---------------------------------------------------------------------------
// Tài khoản Claude: đăng nhập ngay trên trang, không cần mở terminal
// ---------------------------------------------------------------------------

export interface KetQuaClaude {
  ok: boolean;
  message: string;
  /** Chỉ có khi lấy được link đăng nhập */
  url?: string;
}

/** Bước ①: chạy lệnh đăng nhập, trả link để mở trên máy hoặc điện thoại. */
export async function moDangNhapClaude(): Promise<KetQuaClaude> {
  await doiHoiChuDuAn("đăng nhập Claude");
  const kq = await moDangNhap();
  return kq.ok ? { ok: true, message: "", url: kq.url } : kq;
}

/** Bước ③: chuyển mã người dùng dán cho lệnh đang chờ. */
export async function nhapMaDangNhapClaude(ma: string): Promise<KetQuaClaude> {
  await doiHoiChuDuAn("đăng nhập Claude");
  const sach = chuanHoaMa(ma);
  if (!sach) {
    return {
      ok: false,
      message:
        "Mã không đúng dạng. Trên trang Claude bấm nút chép mã (Copy Code) rồi dán nguyên mã vào đây.",
    };
  }
  return guiMa(sach);
}

export async function huyDangNhapClaude(): Promise<KetQuaClaude> {
  await doiHoiChuDuAn("huỷ đăng nhập Claude");
  huyDangNhap();
  return { ok: true, message: "Đã huỷ lượt đăng nhập." };
}

/** Xoá đăng nhập RIÊNG của Am. Tài khoản mặc định của máy không bị đụng tới. */
export async function dangXuatClaude(): Promise<KetQuaClaude> {
  await doiHoiChuDuAn("đăng xuất Claude");
  huyDangNhap();
  const ok = dangXuat();
  return {
    ok,
    message: ok
      ? "Đã đăng xuất. Am quay về dùng tài khoản Claude mặc định của máy."
      : "Am chưa đăng nhập tài khoản riêng nên không có gì để đăng xuất.",
  };
}

/** Kiểm nhanh, không tốn hạn mức: chỉ hỏi CLI đã đăng nhập chưa. */
export async function docTrangThaiClaude(): Promise<TrangThaiClaude> {
  await doiHoiChuDuAn("xem trạng thái Claude");
  return docTrangThai();
}

/**
 * Hỏi thử một câu ngắn bằng đúng tài khoản đang dùng. Tốn một lượt nhỏ của gói
 * Claude, nhưng là cách DUY NHẤT biết chắc đăng nhập còn hiệu lực.
 */
export async function thuTroLyClaude(): Promise<KetQuaClaude> {
  await doiHoiChuDuAn("thử gọi Claude");
  const batDau = Date.now();
  try {
    await goiClaudeCli({ loiDan: "Trả lời đúng một chữ: ok", cauHoi: "ping" });
    const giay = ((Date.now() - batDau) / 1000).toFixed(1).replace(".", ",");
    return { ok: true, message: `Claude trả lời được (${giay} giây).` };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof LoiClaudeCli ? e.message : "Không gọi được Claude.",
    };
  }
}
