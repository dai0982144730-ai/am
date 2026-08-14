/**
 * Gọi YouTube Data API v3.
 *
 * Mọi lệnh gọi YouTube trong dự án đều đi qua đây, để ba việc luôn được làm
 * đúng và không ai quên: kiểm tra hạn mức trước khi gọi, ghi nhận hạn mức đã
 * tiêu sau khi gọi, và dịch lỗi của Google thành lời tiếng Việt hiểu được.
 *
 * Hai kiểu xác thực:
 *
 *   - Khoá API: cho dữ liệu công khai (thông tin video, kênh bất kỳ). Đơn giản,
 *     không cần đăng nhập.
 *   - Token đăng nhập: bắt buộc với dữ liệu của chính tài khoản (kênh đã đăng
 *     ký, video đã thích, playlist riêng) — những thứ có tham số `mine=true`
 *     hoặc `myRating`.
 */

import {
  conGoiDuoc,
  ghiNhanDaDung,
  HetHanMuc,
  type TenLenh,
} from "./hanMuc";
import { layAccessToken } from "./tokenGoogle";

const GOC = "https://www.googleapis.com/youtube/v3";

/** Lỗi từ phía YouTube, đã dịch sang lời dễ hiểu. */
export class LoiYouTube extends Error {
  constructor(
    thongDiep: string,
    readonly maHttp: number,
    readonly lyDoGoc?: string,
  ) {
    super(thongDiep);
    this.name = "LoiYouTube";
  }
}

interface LoiTuGoogle {
  error?: {
    code?: number;
    message?: string;
    errors?: { reason?: string; message?: string }[];
  };
}

/** Dịch lỗi của Google sang lời người thường đọc được. */
function dichLoi(maHttp: number, than: LoiTuGoogle): LoiYouTube {
  const lyDo = than.error?.errors?.[0]?.reason;
  const goc = than.error?.message;

  const banDich: Record<string, string> = {
    quotaExceeded:
      "Đã hết hạn mức YouTube hôm nay. Hạn mức được cấp lại vào 0h giờ Thái Bình Dương (khoảng 14–15h giờ Việt Nam).",
    dailyLimitExceeded:
      "Đã chạm giới hạn gọi trong ngày của khoá API. Thử lại vào ngày mai.",
    rateLimitExceeded:
      "Gọi quá nhanh trong thời gian ngắn. Chờ một lát rồi thử lại.",
    forbidden:
      "Không có quyền xem dữ liệu này. Có thể video/playlist ở chế độ riêng tư.",
    playlistNotFound: "Không tìm thấy playlist này.",
    videoNotFound: "Không tìm thấy video này.",
    channelNotFound: "Không tìm thấy kênh này.",
    keyInvalid:
      "Khoá YOUTUBE_API_KEY không hợp lệ. Kiểm tra lại trong .env và trong Google Cloud Console.",
    accessNotConfigured:
      "Chưa bật YouTube Data API v3 cho dự án Google Cloud này. Vào console.cloud.google.com bật lên.",
  };

  if (lyDo && banDich[lyDo]) {
    return new LoiYouTube(banDich[lyDo], maHttp, lyDo);
  }
  if (maHttp === 401) {
    return new LoiYouTube(
      "Token đăng nhập không còn hiệu lực. Đăng nhập lại từ trang chủ.",
      maHttp,
      lyDo,
    );
  }
  return new LoiYouTube(
    `YouTube trả về lỗi ${maHttp}${goc ? `: ${goc}` : ""}`,
    maHttp,
    lyDo,
  );
}

export interface TuyChonGoi {
  /**
   * `true` khi lệnh đọc dữ liệu của chính tài khoản người dùng (mine=true,
   * myRating…). Khi đó dùng token đăng nhập thay vì khoá API.
   */
  canDangNhap?: boolean;
}

/**
 * Gọi một lệnh của YouTube API.
 *
 * @param lenh    Tên lệnh, dùng để tính và ghi hạn mức
 * @param duongDan Phần đuôi, ví dụ "videos"
 * @param thamSo  Tham số truy vấn
 */
export async function goiYouTube<T>(
  lenh: TenLenh,
  duongDan: string,
  thamSo: Record<string, string | number | undefined>,
  tuyChon: TuyChonGoi = {},
): Promise<T> {
  const kiemTra = await conGoiDuoc(lenh);
  if (!kiemTra.duoc) {
    throw new HetHanMuc(lenh, kiemTra.tinhHinh);
  }

  const url = new URL(`${GOC}/${duongDan}`);
  for (const [ten, giaTri] of Object.entries(thamSo)) {
    if (giaTri !== undefined && giaTri !== "") {
      url.searchParams.set(ten, String(giaTri));
    }
  }

  const header: Record<string, string> = { Accept: "application/json" };

  if (tuyChon.canDangNhap) {
    header.Authorization = `Bearer ${await layAccessToken()}`;
  } else {
    const khoa = process.env.YOUTUBE_API_KEY;
    if (!khoa) {
      throw new LoiYouTube("Thiếu YOUTUBE_API_KEY trong .env.", 500);
    }
    url.searchParams.set("key", khoa);
  }

  const phanHoi = await fetch(url, { headers: header });

  // Ghi hạn mức ngay cả khi lỗi — Google trừ theo lượt gọi, không theo lượt
  // thành công. Ghi hỏng cũng không được làm chết lệnh chính.
  void ghiNhanDaDung(lenh).catch((loi) =>
    console.error("[youtube] Không ghi được hạn mức đã dùng:", loi),
  );

  if (!phanHoi.ok) {
    let than: LoiTuGoogle = {};
    try {
      than = (await phanHoi.json()) as LoiTuGoogle;
    } catch {
      // Google thỉnh thoảng trả về HTML thay vì JSON khi lỗi hạ tầng
    }
    throw dichLoi(phanHoi.status, than);
  }

  return (await phanHoi.json()) as T;
}

/**
 * Gọi một lệnh **ghi** — tạo playlist, thêm/gỡ video khỏi playlist.
 *
 * TÁCH RIÊNG KHỎI `goiYouTube` CÓ CHỦ ĐÍCH. Đây là những lệnh thay đổi thật
 * tài khoản YouTube của chủ nhà, không phải chỉ đọc về. Để chung một hàm với
 * lệnh đọc thì rất dễ có ngày gọi nhầm mà không ai nhận ra khi đọc code.
 *
 * Luôn dùng token đăng nhập — không có kiểu ghi bằng khoá API.
 *
 * **Chỉ được gọi từ `playlist/apDung.ts`**, tức là sau khi người dùng đã bấm
 * duyệt từng việc một. Không gọi thẳng từ chỗ nào khác.
 */
export async function ghiYouTube<T>(
  lenh: TenLenh,
  duongDan: string,
  thamSo: Record<string, string | number | undefined>,
  than: unknown,
  phuongThuc: "POST" | "DELETE" = "POST",
): Promise<T> {
  const kiemTra = await conGoiDuoc(lenh);
  if (!kiemTra.duoc) throw new HetHanMuc(lenh, kiemTra.tinhHinh);

  const url = new URL(`${GOC}/${duongDan}`);
  for (const [ten, giaTri] of Object.entries(thamSo)) {
    if (giaTri !== undefined && giaTri !== "") {
      url.searchParams.set(ten, String(giaTri));
    }
  }

  const phanHoi = await fetch(url, {
    method: phuongThuc,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${await layAccessToken()}`,
      ...(than ? { "Content-Type": "application/json" } : {}),
    },
    ...(than ? { body: JSON.stringify(than) } : {}),
  });

  void ghiNhanDaDung(lenh).catch((loi) =>
    console.error("[youtube] Không ghi được hạn mức đã dùng:", loi),
  );

  if (!phanHoi.ok) {
    let loi: LoiTuGoogle = {};
    try {
      loi = (await phanHoi.json()) as LoiTuGoogle;
    } catch {
      // Google thỉnh thoảng trả HTML khi lỗi hạ tầng
    }

    // Thiếu quyền ghi là lỗi hay gặp nhất ở đây, và thông báo gốc của Google
    // ("Request had insufficient authentication scopes") không giúp gì cho
    // người không phải lập trình viên
    if (phanHoi.status === 403 || phanHoi.status === 401) {
      const lyDo = loi.error?.errors?.[0]?.reason;
      if (lyDo === "insufficientPermissions" || lyDo === "forbidden") {
        throw new LoiYouTube(
          "Tài khoản chưa cấp quyền sửa playlist. Vào trang Playlist bấm " +
            "'Cấp quyền sửa playlist' rồi đăng nhập lại.",
          phanHoi.status,
          lyDo,
        );
      }
    }

    throw dichLoi(phanHoi.status, loi);
  }

  // Lệnh xoá trả về thân rỗng
  if (phuongThuc === "DELETE") return undefined as T;
  return (await phanHoi.json()) as T;
}

/** Khung phản hồi chung của mọi lệnh "list". */
export interface TrangKetQua<T> {
  items?: T[];
  nextPageToken?: string;
  pageInfo?: { totalResults?: number; resultsPerPage?: number };
}

/**
 * Gọi lặp cho tới khi lấy đủ, tự lần theo phân trang.
 *
 * @param gioiHan Số mục tối đa cần lấy. Đặt giới hạn để một kênh nhiều nghìn
 *                video không ngốn sạch hạn mức trong một lần quét.
 */
export async function goiHetTrang<T>(
  lenh: TenLenh,
  duongDan: string,
  thamSo: Record<string, string | number | undefined>,
  gioiHan: number,
  tuyChon: TuyChonGoi = {},
): Promise<T[]> {
  const gom: T[] = [];
  let trangKe: string | undefined;

  while (gom.length < gioiHan) {
    const conThieu = gioiHan - gom.length;
    const trang: TrangKetQua<T> = await goiYouTube(
      lenh,
      duongDan,
      {
        ...thamSo,
        // YouTube cho tối đa 50 mục một lần
        maxResults: Math.min(50, conThieu),
        pageToken: trangKe,
      },
      tuyChon,
    );

    gom.push(...(trang.items ?? []));

    if (!trang.nextPageToken || !trang.items?.length) break;
    trangKe = trang.nextPageToken;
  }

  return gom.slice(0, gioiHan);
}
