/**
 * Chốt chặn không cho tiêu quá mức miễn phí của dịch vụ đọc thành tiếng.
 *
 * VÌ SAO PHẢI CÓ: vượt mức miễn phí thì Google tính tiền phần dôi ra vào thẻ.
 * Thẻ không trừ được thì Google thử lại vài lần, gửi email, rồi **đình chỉ tài
 * khoản thanh toán** — lúc đó mọi lời gọi đều hỏng và phải xử lý xong chuyện
 * thanh toán mới dùng lại được. Chủ dự án nêu đúng rủi ro này.
 *
 * Nên app tự phanh trước khi tới đó, không trông chờ vào Google.
 *
 * VÌ SAO TỰ ĐẾM thay vì hỏi Google: bảng điều khiển của Google báo trễ vài giờ.
 * Muốn chặn **trước khi** vượt thì phải biết ngay lúc chuẩn bị gọi.
 */

import { prisma } from "@/lib/db/prisma";

/**
 * Mức miễn phí mỗi tháng, tính bằng ký tự.
 *
 * 4 triệu là mức của giọng Standard. Giọng WaveNet chỉ được 1 triệu — đổi giọng
 * thì phải sửa con số này, kẻo phanh đặt sai chỗ và tháng đó nhận hoá đơn.
 */
export const TRAN_MIEN_PHI = Number(process.env.TTS_TRAN_MIEN_PHI) || 4_000_000;

/**
 * Ngưỡng cảnh báo và ngưỡng khoá.
 *
 * Chủ dự án chọn 70% và 90% thay vì 80/99, có lý: **cách đếm của app và cách
 * đếm của Google không bao giờ khớp tuyệt đối.** Google tính cả phần đánh dấu
 * SSML, làm tròn theo lô, và có độ trễ. Chừa 10% cuối làm vùng đệm thì sai số
 * mấy phần trăm cũng không thành hoá đơn.
 */
export const NGUONG_CANH_BAO = 0.7;
export const NGUONG_KHOA = 0.9;

/** Tháng hiện tại theo dạng "2026-08". */
export function thangNay(luc: Date = new Date()): string {
  return `${luc.getFullYear()}-${String(luc.getMonth() + 1).padStart(2, "0")}`;
}

export interface TinhHinhTts {
  thang: string;
  daDung: number;
  tran: number;
  phanTram: number;
  /** Đã qua ngưỡng cảnh báo chưa */
  sapHet: boolean;
  /** Đã bị khoá tới tháng sau chưa */
  daKhoa: boolean;
  conLai: number;
  lanGoiGanNhat: Date | null;
  loiGanNhat: string | null;
}

/** Xem tháng này đã tiêu bao nhiêu. */
export async function xemTinhHinh(): Promise<TinhHinhTts> {
  const thang = thangNay();
  const dong = await prisma.ttsUsage.findUnique({ where: { month: thang } });

  const daDung = dong?.charactersUsed ?? 0;
  const phanTram = TRAN_MIEN_PHI > 0 ? daDung / TRAN_MIEN_PHI : 0;

  return {
    thang,
    daDung,
    tran: TRAN_MIEN_PHI,
    phanTram,
    sapHet: phanTram >= NGUONG_CANH_BAO,
    daKhoa: phanTram >= NGUONG_KHOA,
    conLai: Math.max(0, TRAN_MIEN_PHI - daDung),
    lanGoiGanNhat: dong?.lastCallAt ?? null,
    loiGanNhat: dong?.lastError ?? null,
  };
}

/** Lỗi ném ra khi đã chạm ngưỡng khoá. */
export class HetHanMucTts extends Error {
  constructor(readonly tinhHinh: TinhHinhTts) {
    super(
      `Đã dùng ${Math.round(tinhHinh.phanTram * 100)}% mức miễn phí đọc thành ` +
        `tiếng của tháng ${tinhHinh.thang} (${tinhHinh.daDung.toLocaleString("vi-VN")}/` +
        `${tinhHinh.tran.toLocaleString("vi-VN")} ký tự). App tự dừng ở ` +
        `${Math.round(NGUONG_KHOA * 100)}% để không phát sinh tiền. Sang tháng ` +
        `sau tự mở lại.`,
    );
    this.name = "HetHanMucTts";
  }
}

/**
 * Hỏi trước khi gọi: đoạn chữ này có đọc được không.
 *
 * Kiểm **cả phần sắp gọi**, không chỉ phần đã dùng. Chỉ kiểm phần đã dùng thì
 * một đoạn dài có thể nhảy vọt từ 89% lên 95% trong đúng một lần gọi, tức là
 * vượt ngưỡng ngay ở lần đầu tiên chạm tới nó.
 */
export async function conDocDuoc(soKyTu: number): Promise<{
  duoc: boolean;
  tinhHinh: TinhHinhTts;
  lyDo: string | null;
}> {
  const tinhHinh = await xemTinhHinh();

  if (tinhHinh.daKhoa) {
    return {
      duoc: false,
      tinhHinh,
      lyDo: `đã chạm ngưỡng khoá ${Math.round(NGUONG_KHOA * 100)}%`,
    };
  }

  const sauKhiGoi = (tinhHinh.daDung + soKyTu) / TRAN_MIEN_PHI;
  if (sauKhiGoi >= NGUONG_KHOA) {
    return {
      duoc: false,
      tinhHinh,
      lyDo:
        `đoạn này dài ${soKyTu.toLocaleString("vi-VN")} ký tự, đọc xong sẽ lên ` +
        `${Math.round(sauKhiGoi * 100)}% — vượt ngưỡng khoá`,
    };
  }

  return { duoc: true, tinhHinh, lyDo: null };
}

/**
 * Ghi nhận đã đọc bao nhiêu ký tự.
 *
 * Gọi **sau khi Google trả lời thành công**. Ghi trước khi gọi thì lần gọi hỏng
 * cũng bị tính, và sau vài chục lần hỏng thì hạn mức cạn oan.
 */
export async function ghiNhanDaDoc(soKyTu: number): Promise<void> {
  const thang = thangNay();
  await prisma.ttsUsage.upsert({
    where: { month: thang },
    create: {
      month: thang,
      charactersUsed: soKyTu,
      lastCallAt: new Date(),
    },
    update: {
      charactersUsed: { increment: soKyTu },
      lastCallAt: new Date(),
      lastError: null,
    },
  });
}

/** Ghi lại lỗi của lần gọi gần nhất, để màn hình Cài đặt nói được sự thật. */
export async function ghiNhanLoi(loi: string): Promise<void> {
  const thang = thangNay();
  await prisma.ttsUsage.upsert({
    where: { month: thang },
    create: {
      month: thang,
      charactersUsed: 0,
      lastCallAt: new Date(),
      lastError: loi.slice(0, 400),
    },
    update: { lastCallAt: new Date(), lastError: loi.slice(0, 400) },
  });
}
