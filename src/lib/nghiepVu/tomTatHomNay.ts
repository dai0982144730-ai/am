/**
 * Bản tin nội dung mới thu thập.
 *
 * Đây là endpoint riêng của trang `am` (tiendo có /canh-bao, phaply có
 * /van-ban-moi). Trên điện thoại đây sẽ là câu hỏi hay dùng: "hôm nay có gì hay".
 *
 * Hai đường lấy dữ liệu:
 *   1. Nếu đã có AssistantBriefing do job quét tối qua sinh ra → dùng luôn, vì
 *      bản đó đã được Claude chắt lọc kỹ.
 *   2. Chưa có (Phase 10 chưa chạy) → tự gom nội dung mới nhất theo chuyên mục.
 *
 * Nhờ đường thứ hai mà endpoint này dùng được ngay từ bây giờ, không phải chờ
 * toàn bộ phần trợ lý chủ động làm xong.
 */

import { prisma } from "@/lib/db/prisma";
import { chuanHoaDeDoc } from "@/lib/troLyChung/chuanHoaDeDoc";
import { TEN_TRANG } from "@/lib/troLyChung/kieuDuLieu";
import { doiSangMucKetQua, QUAN_HE_CAN_LAY } from "./timKiemNoiDung";
import type { MucKetQua } from "@/lib/troLyChung/kieuDuLieu";

/** Tên chuyên mục hiện cho người đọc, thay vì mã trong database */
const TEN_CHUYEN_MUC: Record<string, string> = {
  ai: "AI",
  triet_hoc: "Triết học",
  khoa_hoc: "Khoa học",
  truyen: "Truyện",
  music: "Nhạc",
  new_search: "Từ khoá đang theo dõi",
  other: "Khác",
};

const SO_MUC_MOI_CHUYEN_MUC = 5;

export interface NhomTheoChuDe {
  chuyenMuc: string;
  tenHienThi: string;
  soLuong: number;
  noiDung: MucKetQua[];
}

export interface KetQuaTomTat {
  trang: string;
  tuNgay: string;
  tongSo: number;
  nhom: NhomTheoChuDe[];
  /** Bản đọc thành tiếng, đã chuẩn hoá sẵn */
  traLoiNgan: string;
  /** Bản đầy đủ cho màn hình */
  traLoiDay: string;
  /** true khi lấy từ bản tin Claude đã soạn, false khi tự gom */
  tuBanTinDaSoan: boolean;
}

/** Viết câu tóm tắt bằng lời cho phần đọc */
function vietLoiTomTat(nhom: NhomTheoChuDe[], soNgay: number): string {
  const khoangThoiGian = soNgay === 1 ? "hôm nay" : `${soNgay} ngày qua`;

  if (nhom.length === 0) {
    return `Không có nội dung mới nào trong ${khoangThoiGian}.`;
  }

  const tong = nhom.reduce((s, n) => s + n.soLuong, 0);
  const liet = nhom
    .map((n) => `${n.soLuong} mục ${n.tenHienThi.toLowerCase()}`)
    .join(", ");

  const noiBat = nhom[0]?.noiDung[0];
  const cauNoiBat = noiBat ? ` Đáng chú ý nhất là ${noiBat.tieuDe}.` : "";

  return `Trong ${khoangThoiGian} có ${tong} nội dung mới: ${liet}.${cauNoiBat}`;
}

/** Viết bản đầy đủ có markdown cho màn hình */
function vietBanDayDu(nhom: NhomTheoChuDe[], soNgay: number): string {
  const khoangThoiGian = soNgay === 1 ? "hôm nay" : `${soNgay} ngày qua`;

  if (nhom.length === 0) {
    return `## Nội dung mới\n\nKhông có nội dung mới nào trong ${khoangThoiGian}.`;
  }

  const phan = nhom.map((n) => {
    const dong = n.noiDung
      .map((m) => {
        const nguon = (m.duLieuRieng as Record<string, unknown>).nguon;
        return `- **${m.tieuDe}**${nguon ? ` — ${nguon}` : ""}${m.duongDan ? `\n  ${m.duongDan}` : ""}`;
      })
      .join("\n");
    return `### ${n.tenHienThi} (${n.soLuong})\n\n${dong}`;
  });

  return `## Nội dung mới trong ${khoangThoiGian}\n\n${phan.join("\n\n")}`;
}

export async function tomTatHomNay(soNgay = 1): Promise<KetQuaTomTat> {
  const soNgayHopLe = Math.min(Math.max(soNgay, 1), 30);
  const moc = new Date(Date.now() - soNgayHopLe * 24 * 60 * 60 * 1000);

  // Đường 1: bản tin Claude đã soạn sẵn từ lần quét gần nhất
  const banTin = await prisma.assistantBriefing.findFirst({
    where: { deliveredAt: { gte: moc } },
    orderBy: { deliveredAt: "desc" },
    select: { conversationalScript: true, pickedItemsTiered: true, deliveredAt: true },
  });

  // Dù có bản tin hay không vẫn gom danh sách nội dung, để app luôn có dữ liệu
  // có cấu trúc mà hiển thị chứ không chỉ một đoạn văn
  const banGhi = await prisma.contentItem.findMany({
    where: { createdAt: { gte: moc } },
    include: QUAN_HE_CAN_LAY,
    orderBy: [
      { score: { compositeScore: { sort: "desc", nulls: "last" } } },
      { publishedAt: { sort: "desc", nulls: "last" } },
    ],
  });

  // Gom theo chuyên mục, mỗi chuyên mục giữ lại vài mục đứng đầu
  const theoChuyenMuc = new Map<string, MucKetQua[]>();
  for (const ban of banGhi) {
    const nhomHienCo = theoChuyenMuc.get(ban.contentGroup) ?? [];
    nhomHienCo.push(doiSangMucKetQua(ban));
    theoChuyenMuc.set(ban.contentGroup, nhomHienCo);
  }

  const nhom: NhomTheoChuDe[] = [...theoChuyenMuc.entries()]
    .map(([chuyenMuc, danhSach]) => ({
      chuyenMuc,
      tenHienThi: TEN_CHUYEN_MUC[chuyenMuc] ?? chuyenMuc,
      soLuong: danhSach.length,
      noiDung: danhSach.slice(0, SO_MUC_MOI_CHUYEN_MUC),
    }))
    .sort((a, b) => b.soLuong - a.soLuong);

  const tuBanTinDaSoan = Boolean(banTin?.conversationalScript);
  const banDayDu = tuBanTinDaSoan
    ? (banTin?.conversationalScript as string)
    : vietBanDayDu(nhom, soNgayHopLe);

  return {
    trang: TEN_TRANG,
    tuNgay: moc.toISOString().slice(0, 10),
    tongSo: banGhi.length,
    nhom,
    // Bản tin Claude soạn có markdown, nên vẫn phải cho qua chuẩn hoá trước khi đọc
    traLoiNgan: chuanHoaDeDoc(
      tuBanTinDaSoan ? (banTin?.conversationalScript as string) : vietLoiTomTat(nhom, soNgayHopLe),
    ),
    traLoiDay: banDayDu,
    tuBanTinDaSoan,
  };
}
