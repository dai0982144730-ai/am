/**
 * Số liệu cho trang Vận hành.
 *
 * ## Trang này trả lời câu gì
 *
 * Chủ dự án đã hỏi đúng ba câu mà không chỗ nào trong app trả lời được:
 * *hôm nay tiêu bao nhiêu hạn mức YouTube*, *đọc thành tiếng còn bao nhiêu*,
 * và *đêm qua việc quét có chạy không*. Ba con số đó đã được ghi vào database
 * từ lâu (`QuotaUsageLog`, `TtsUsage`, `JobRun`) nhưng chưa từng được bày ra —
 * muốn biết thì phải mở database lên xem.
 *
 * ## Vì sao chỉ ĐỌC, không tính lại
 *
 * Hạn mức YouTube và hạn mức đọc thành tiếng đã có hai file lo riêng
 * (`youtube/hanMuc.ts`, `tts/hanMuc.ts`) — chính hai file đó quyết định lúc nào
 * ngắt việc. File này gọi lại đúng chúng chứ không tự cộng lại theo cách khác.
 * Tự cộng lại thì màn hình có thể báo "còn 3.000 đơn vị" trong khi cái phanh
 * thật đã hạ xuống, và người xem sẽ tin màn hình.
 */

import { prisma } from "@/lib/db/prisma";
import {
  mocNgat,
  ngayHanMuc,
  nganSachMoiNgay,
  xemTinhHinh as xemHanMucYouTube,
  type TinhHinhHanMuc,
} from "@/lib/youtube/hanMuc";
import { xemTinhHinh as xemHanMucTts, type TinhHinhTts } from "@/lib/tts/hanMuc";

/** Số ngày lịch sử hạn mức YouTube bày ra. Hai tuần đủ thấy nếp chạy hằng đêm. */
const SO_NGAY_LICH_SU = 14;

/** Số lần chạy gần nhất liệt kê ra. */
const SO_LAN_CHAY = 12;

export interface DongHanMucNgay {
  ngay: Date;
  daDung: number;
  /** Từng lệnh tiêu bao nhiêu — để thấy tìm kiếm có đang ăn hết hạn mức không */
  theoLenh: { lenh: string; soLan: number; donVi: number }[];
}

export interface LanChay {
  id: string;
  loai: string;
  trangThai: string;
  batDau: Date;
  ketThuc: Date | null;
  /** Giây. Null khi đang chạy dở */
  keoDai: number | null;
  soLanThu: number;
  loi: string | null;
  /** Riêng bản tin: đêm đó nhặt được bao nhiêu nội dung mới */
  soNoiDungMoi?: number;
}

export interface TinhHinhTroLyApi {
  soLanGoi: number;
  soLanLoi: number;
  /** Mili giây */
  trungBinhMs: number;
  chamNhatMs: number;
  tokenVao: number;
  tokenRa: number;
  theoDiemCuoi: { diemCuoi: string; soLan: number }[];
}

export interface PhienBanDiem {
  phienBan: string;
  soNoiDung: number;
  tinhLanCuoi: Date | null;
}

export interface TinhHinhVanHanh {
  youtube: TinhHinhHanMuc & {
    mocNgat: number;
    nganSach: number;
    homNay: Date;
    lichSu: DongHanMucNgay[];
  };
  tts: TinhHinhTts;
  cacLanChay: LanChay[];
  troLyApi: TinhHinhTroLyApi;
  cacPhienBanDiem: PhienBanDiem[];
  /** Phiên bản hồ sơ gu mới nhất — null khi chưa dựng hồ sơ lần nào */
  phienBanHoSoGu: { phienBan: number; taoLuc: Date } | null;
}

/** Gom hết số liệu vận hành trong một lượt. */
export async function docTinhHinhVanHanh(): Promise<TinhHinhVanHanh> {
  const [hanMucYt, hanMucTts, lichSu, cacLanChay, troLyApi, cacPhienBanDiem, hoSoGu] =
    await Promise.all([
      xemHanMucYouTube(),
      xemHanMucTts(),
      docLichSuHanMuc(),
      docCacLanChay(),
      docTroLyApi(),
      docPhienBanDiem(),
      prisma.userTasteProfile.findFirst({
        orderBy: { version: "desc" },
        select: { version: true, createdAt: true },
      }),
    ]);

  return {
    youtube: {
      ...hanMucYt,
      mocNgat: mocNgat(),
      nganSach: nganSachMoiNgay(),
      homNay: ngayHanMuc(),
      lichSu,
    },
    tts: hanMucTts,
    cacLanChay,
    troLyApi,
    cacPhienBanDiem,
    phienBanHoSoGu: hoSoGu
      ? { phienBan: hoSoGu.version, taoLuc: hoSoGu.createdAt }
      : null,
  };
}

/** Hạn mức YouTube từng ngày trong hai tuần gần nhất. */
async function docLichSuHanMuc(): Promise<DongHanMucNgay[]> {
  const tuNgay = new Date(ngayHanMuc());
  tuNgay.setUTCDate(tuNgay.getUTCDate() - (SO_NGAY_LICH_SU - 1));

  const cacDong = await prisma.quotaUsageLog.findMany({
    where: { date: { gte: tuNgay } },
    orderBy: [{ date: "desc" }, { endpoint: "asc" }],
  });

  const theoNgay = new Map<number, DongHanMucNgay>();
  for (const dong of cacDong) {
    const khoa = dong.date.getTime();
    const da = theoNgay.get(khoa) ?? {
      ngay: dong.date,
      daDung: 0,
      theoLenh: [],
    };
    const donVi = dong.unitCost * dong.callCount;
    da.daDung += donVi;
    da.theoLenh.push({
      lenh: dong.endpoint,
      soLan: dong.callCount,
      donVi,
    });
    theoNgay.set(khoa, da);
  }

  // Lệnh đắt lên trước trong từng ngày — muốn nhìn phát là thấy thủ phạm
  for (const ngay of theoNgay.values()) {
    ngay.theoLenh.sort((a, b) => b.donVi - a.donVi);
  }

  return [...theoNgay.values()].sort(
    (a, b) => b.ngay.getTime() - a.ngay.getTime(),
  );
}

/**
 * Các lần chạy gần nhất, trộn cả việc nền (`JobRun`) lẫn việc dựng bản tin
 * (`DigestRun`).
 *
 * Trộn hai bảng vì với người xem chúng là **một dòng thời gian**: "đêm qua có
 * chạy không" không phân biệt việc đó được ghi vào bảng nào.
 */
async function docCacLanChay(): Promise<LanChay[]> {
  const [viecNen, banTin] = await Promise.all([
    prisma.jobRun.findMany({
      orderBy: { startedAt: "desc" },
      take: SO_LAN_CHAY,
    }),
    prisma.digestRun.findMany({
      orderBy: { startedAt: "desc" },
      take: SO_LAN_CHAY,
    }),
  ]);

  const gop: LanChay[] = [
    ...viecNen.map((v) => ({
      id: v.id,
      loai: v.jobType,
      trangThai: v.status as string,
      batDau: v.startedAt,
      ketThuc: v.finishedAt,
      keoDai: doKeoDai(v.startedAt, v.finishedAt),
      soLanThu: v.attemptCount,
      loi: v.lastError,
    })),
    ...banTin.map((b) => ({
      id: b.id,
      loai: `Dựng bản tin (${b.triggeredBy})`,
      trangThai: b.status as string,
      batDau: b.startedAt,
      ketThuc: b.finishedAt,
      keoDai: doKeoDai(b.startedAt, b.finishedAt),
      soLanThu: 1,
      loi: b.errorSummary,
      soNoiDungMoi: b.newItemsFound,
    })),
  ];

  return gop
    .sort((a, b) => b.batDau.getTime() - a.batDau.getTime())
    .slice(0, SO_LAN_CHAY);
}

function doKeoDai(batDau: Date, ketThuc: Date | null): number | null {
  if (!ketThuc) return null;
  return Math.round((ketThuc.getTime() - batDau.getTime()) / 1000);
}

/** Cổng API trợ lý đã bị gọi bao nhiêu, nhanh chậm ra sao (30 ngày). */
async function docTroLyApi(): Promise<TinhHinhTroLyApi> {
  const tuLuc = new Date();
  tuLuc.setDate(tuLuc.getDate() - 30);

  const cacDong = await prisma.assistantApiLog.findMany({
    where: { createdAt: { gte: tuLuc } },
    select: {
      endpoint: true,
      responseTimeMs: true,
      statusCode: true,
      aiInputTokens: true,
      aiOutputTokens: true,
    },
  });

  const theoDiemCuoi = new Map<string, number>();
  let tongMs = 0;
  let chamNhatMs = 0;
  let soLanLoi = 0;
  let tokenVao = 0;
  let tokenRa = 0;

  for (const d of cacDong) {
    theoDiemCuoi.set(d.endpoint, (theoDiemCuoi.get(d.endpoint) ?? 0) + 1);
    tongMs += d.responseTimeMs;
    if (d.responseTimeMs > chamNhatMs) chamNhatMs = d.responseTimeMs;
    if (d.statusCode >= 400) soLanLoi += 1;
    tokenVao += d.aiInputTokens ?? 0;
    tokenRa += d.aiOutputTokens ?? 0;
  }

  return {
    soLanGoi: cacDong.length,
    soLanLoi,
    trungBinhMs: cacDong.length > 0 ? Math.round(tongMs / cacDong.length) : 0,
    chamNhatMs,
    tokenVao,
    tokenRa,
    theoDiemCuoi: [...theoDiemCuoi.entries()]
      .map(([diemCuoi, soLan]) => ({ diemCuoi, soLan }))
      .sort((a, b) => b.soLan - a.soLan),
  };
}

/**
 * Điểm chất lượng đang nằm ở những phiên bản nào.
 *
 * VÌ SAO CẦN BÀY RA: mỗi lần đổi công thức chấm là điểm cũ và điểm mới không
 * còn so được với nhau. Nếu 300 nội dung đang ở "v1" và 40 nội dung ở "v2" thì
 * bảng xếp hạng đang trộn hai thước đo — nhìn thấy con số này mới biết mà chấm
 * lại phần còn sót.
 */
async function docPhienBanDiem(): Promise<PhienBanDiem[]> {
  const nhom = await prisma.contentScore.groupBy({
    by: ["scoreVersion"],
    _count: { _all: true },
    _max: { computedAt: true },
  });

  return nhom
    .map((n) => ({
      phienBan: n.scoreVersion,
      soNoiDung: n._count._all,
      tinhLanCuoi: n._max.computedAt,
    }))
    .sort((a, b) => b.soNoiDung - a.soNoiDung);
}
