/**
 * Đếm và giữ hạn mức gọi YouTube API.
 *
 * Google cho miễn phí 10.000 "đơn vị" mỗi ngày, reset lúc 0h giờ Thái Bình
 * Dương. Hết là hết, không xin thêm được, và mọi thứ dừng cho tới hôm sau —
 * nên phải tự đếm chứ không đợi Google báo lỗi.
 *
 * Giá từng loại lệnh chênh nhau rất xa:
 *
 *   - Đọc danh sách (video, playlist, kênh đã đăng ký…): 1 đơn vị
 *   - TÌM KIẾM: 100 đơn vị — đắt gấp trăm lần
 *
 * Vì vậy nguyên tắc xuyên suốt: với kênh đã biết thì đọc thẳng danh sách video
 * của kênh (1 đơn vị), tuyệt đối không dùng tìm kiếm. Tìm kiếm chỉ dành cho việc
 * khám phá nguồn mới và chuyên mục "New".
 *
 * Khi dùng tới 80% hạn mức, phần tìm kiếm bị ngắt trước, phần quét kênh quen
 * vẫn chạy — vì đó mới là việc chính hằng ngày.
 */

import { prisma } from "@/lib/db/prisma";

/** Giá của từng lệnh, tính bằng đơn vị hạn mức. */
export const GIA_LENH = {
  "search.list": 100,
  "videos.list": 1,
  "channels.list": 1,
  "playlists.list": 1,
  "playlistItems.list": 1,
  "subscriptions.list": 1,
  "commentThreads.list": 1,
} as const;

export type TenLenh = keyof typeof GIA_LENH;

/**
 * Lệnh nào thuộc nhóm "khám phá" — bị ngắt trước khi chạm ngưỡng an toàn.
 * Chỉ có tìm kiếm, vì nó vừa đắt vừa không phải việc bắt buộc hằng ngày.
 */
const LENH_KHAM_PHA: ReadonlySet<string> = new Set(["search.list"]);

/** Ngân sách mỗi ngày. Google cho 10.000, cho phép chỉnh qua biến môi trường. */
export function nganSachMoiNgay(): number {
  const khai = Number(process.env.YOUTUBE_DAILY_QUOTA);
  return Number.isFinite(khai) && khai > 0 ? khai : 10_000;
}

/** Chạm mốc này thì ngắt phần khám phá. */
export function mocNgat(): number {
  return Math.floor(nganSachMoiNgay() * 0.8);
}

/**
 * Hôm nay là ngày nào, theo múi giờ Thái Bình Dương.
 *
 * Phải theo múi giờ của Google chứ không phải giờ Việt Nam, vì đó mới là lúc
 * hạn mức thực sự được reset. Tính nhầm thì sẽ tưởng còn hạn mức trong khi
 * Google đã coi là sang ngày mới (hoặc ngược lại, tưởng hết trong khi vẫn còn).
 */
export function ngayHanMuc(luc: Date = new Date()): Date {
  const chuoi = luc.toLocaleDateString("en-CA", {
    timeZone: "America/Los_Angeles",
  });
  return new Date(`${chuoi}T00:00:00.000Z`);
}

export interface TinhHinhHanMuc {
  daDung: number;
  nganSach: number;
  conLai: number;
  /** Đã chạm 80% chưa — chạm rồi thì ngừng phần khám phá */
  daChamMocNgat: boolean;
}

/** Xem hôm nay đã tiêu bao nhiêu. */
export async function xemTinhHinh(): Promise<TinhHinhHanMuc> {
  const ngay = ngayHanMuc();
  const cacDong = await prisma.quotaUsageLog.findMany({
    where: { date: ngay },
    select: { unitCost: true, callCount: true },
  });

  const daDung = cacDong.reduce(
    (tong, dong) => tong + dong.unitCost * dong.callCount,
    0,
  );
  const nganSach = nganSachMoiNgay();

  return {
    daDung,
    nganSach,
    conLai: Math.max(0, nganSach - daDung),
    daChamMocNgat: daDung >= mocNgat(),
  };
}

/** Lỗi ném ra khi không còn đủ hạn mức để gọi. */
export class HetHanMuc extends Error {
  constructor(
    readonly lenh: TenLenh,
    readonly tinhHinh: TinhHinhHanMuc,
  ) {
    super(
      `Không gọi "${lenh}" được: hôm nay đã dùng ${tinhHinh.daDung}/${tinhHinh.nganSach} đơn vị hạn mức YouTube. Hạn mức sẽ được cấp lại vào 0h giờ Thái Bình Dương (khoảng 14–15h giờ Việt Nam).`,
    );
    this.name = "HetHanMuc";
  }
}

/**
 * Hỏi xem còn gọi được lệnh này không.
 *
 * Trả về lý do bằng lời dễ hiểu thay vì chỉ true/false, để chỗ gọi ghi log hoặc
 * hiện lên màn hình được ngay.
 */
export async function conGoiDuoc(lenh: TenLenh): Promise<{
  duoc: boolean;
  lyDo?: string;
  tinhHinh: TinhHinhHanMuc;
}> {
  const tinhHinh = await xemTinhHinh();
  const gia = GIA_LENH[lenh];

  if (tinhHinh.conLai < gia) {
    return {
      duoc: false,
      lyDo: `Hết hạn mức: cần ${gia} đơn vị nhưng chỉ còn ${tinhHinh.conLai}.`,
      tinhHinh,
    };
  }

  if (LENH_KHAM_PHA.has(lenh) && tinhHinh.daChamMocNgat) {
    return {
      duoc: false,
      lyDo: `Đã dùng ${tinhHinh.daDung}/${tinhHinh.nganSach} đơn vị (quá mốc ${mocNgat()}), tạm ngừng phần tìm kiếm để dành hạn mức cho việc quét các kênh quen.`,
      tinhHinh,
    };
  }

  return { duoc: true, tinhHinh };
}

/**
 * Ghi lại một lần gọi đã tiêu hạn mức.
 *
 * Gọi SAU khi đã gọi API thật, kể cả khi lệnh đó trả về lỗi — vì Google trừ hạn
 * mức theo lượt gọi chứ không theo lượt thành công.
 */
export async function ghiNhanDaDung(
  lenh: TenLenh,
  soLan = 1,
): Promise<void> {
  const ngay = ngayHanMuc();
  await prisma.quotaUsageLog.upsert({
    where: { date_endpoint: { date: ngay, endpoint: lenh } },
    create: {
      date: ngay,
      endpoint: lenh,
      unitCost: GIA_LENH[lenh],
      callCount: soLan,
    },
    update: { callCount: { increment: soLan } },
  });
}
