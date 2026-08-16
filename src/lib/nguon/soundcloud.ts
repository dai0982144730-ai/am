/**
 * SoundCloud — thêm kênh bằng đường dẫn trang, lấy bài qua RSS công khai.
 *
 * ## SoundCloud cho lấy được cái gì, và KHÔNG cho cái gì
 *
 * SoundCloud có API riêng nhưng **đã đóng cửa đăng ký ứng dụng mới từ nhiều năm
 * nay**. Không xin được khoá thì chỉ còn hai đường:
 *
 *   1. Moi `client_id` ra khỏi mã JavaScript của chính trang web họ rồi gọi API
 *      nội bộ. Đây là cách mọi công cụ tải nhạc lậu vẫn làm — **không dùng**:
 *      nó là lách chốt kiểm soát truy cập của người ta, và khoá đó đổi bất cứ
 *      lúc nào, đổi phát là app chết câm không báo gì.
 *   2. **RSS công khai** — chính SoundCloud phát hành, có đường dẫn cố định
 *      `feeds.soundcloud.com/users/soundcloud:users:<id>/sounds.rss`. Đây là
 *      thứ họ chủ động mở ra cho người khác đọc.
 *
 * File này đi đường thứ hai.
 *
 * ## Cái giá phải trả, nói thẳng ra
 *
 * **RSS chỉ có những bài tác giả bật phân phối podcast.** Đo thật ngày
 * 2026-08-16: tài khoản ca sĩ Trịnh Thăng Bình có 131 bài trên trang, feed RSS
 * trả về **0 bài**. Đó không phải lỗi — nhạc sĩ đăng nhạc thì không bật mục
 * podcast, chỉ kênh nói (radio, talk, kể chuyện) mới bật.
 *
 * Nghĩa là nhánh SoundCloud ở đây **hợp với kênh nói tiếng Việt hơn là kênh
 * nhạc**. Đúng ra vẫn có ích: chủ dự án đã nói SoundCloud Việt Nam có nguồn
 * tiếng Việt sẵn nên không cần thuyết minh lại. Nhưng nếu thêm một kênh nhạc
 * mà feed rỗng thì `themKenhSoundCloud` nói thẳng điều đó ra chứ không lặng lẽ
 * thêm một nguồn chết.
 *
 * ## Vì sao phải đọc trang HTML để lấy mã người dùng
 *
 * Đường dẫn RSS cần **mã số** người dùng, còn thứ người ta dán vào ô nhập là
 * **tên tài khoản** (`soundcloud.com/trinhthangbinh`). Không có API tra cứu
 * công khai để đổi tên sang mã. Nhưng chính trang hồ sơ đã nhúng sẵn mã đó
 * trong khối `window.__sc_hydration` — đọc trang họ phục vụ cho mọi trình duyệt
 * là việc bình thường, khác hẳn việc moi khoá API ra dùng.
 */

const HAN_DOC_MS = 25_000;

/** Trình duyệt giả — SoundCloud trả trang rỗng cho lời gọi không khai gì. */
const NHAN_TRINH_DUYET =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/131.0 Safari/537.36";

export class LoiSoundCloud extends Error {
  constructor(thongDiep: string) {
    super(thongDiep);
    this.name = "LoiSoundCloud";
  }
}

export interface HoSoSoundCloud {
  /** Mã số nội bộ, dùng để dựng đường dẫn RSS */
  ma: number;
  tenTaiKhoan: string;
  ten: string;
  soTheoDoi: number | null;
  /** Số bài trên trang — thường LỚN HƠN số bài trong RSS */
  soBaiTrenTrang: number | null;
  trangChu: string;
  duongDanRss: string;
}

/** Lấy tên tài khoản từ một đường dẫn SoundCloud bất kỳ. */
export function tachTenTaiKhoan(duongDan: string): string | null {
  const dd = duongDan.trim();
  if (!dd) return null;

  // Chấp nhận cả "soundcloud.com/abc", "https://soundcloud.com/abc/tracks",
  // và mỗi "abc" — người ta dán kiểu gì cũng có
  const khop = dd.match(
    /^(?:https?:\/\/)?(?:(?:www|m)\.)?soundcloud\.com\/([^/?#]+)/i,
  );
  if (khop) return khop[1];

  // Không có dấu gạch chéo nào thì coi như người dùng gõ thẳng tên tài khoản
  return /^[a-z0-9][a-z0-9_-]*$/i.test(dd) ? dd : null;
}

/** Dựng đường dẫn RSS từ mã người dùng. */
export function duongDanRss(ma: number): string {
  return `https://feeds.soundcloud.com/users/soundcloud:users:${ma}/sounds.rss`;
}

/**
 * Đọc hồ sơ một tài khoản SoundCloud.
 *
 * Ném `LoiSoundCloud` với lời giải thích bằng tiếng Việt khi không tra được —
 * ô nhập ở giao diện hiện thẳng câu đó lên.
 */
export async function docHoSo(duongDan: string): Promise<HoSoSoundCloud> {
  const ten = tachTenTaiKhoan(duongDan);
  if (!ten) {
    throw new LoiSoundCloud(
      "Không nhận ra đường dẫn SoundCloud. Dán kiểu " +
        "https://soundcloud.com/ten-tai-khoan",
    );
  }

  const trangChu = `https://soundcloud.com/${ten}`;
  const traLoi = await fetch(trangChu, {
    headers: { "user-agent": NHAN_TRINH_DUYET },
    signal: AbortSignal.timeout(HAN_DOC_MS),
  }).catch((e: unknown) => {
    throw new LoiSoundCloud(
      `Không mở được ${trangChu}: ${e instanceof Error ? e.message : e}`,
    );
  });

  if (traLoi.status === 404) {
    throw new LoiSoundCloud(`SoundCloud không có tài khoản nào tên "${ten}".`);
  }
  if (!traLoi.ok) {
    throw new LoiSoundCloud(`SoundCloud trả lỗi ${traLoi.status}.`);
  }

  const trang = await traLoi.text();
  const hoSo = rutHoSo(trang);
  if (!hoSo) {
    throw new LoiSoundCloud(
      "Mở được trang nhưng không tìm thấy thông tin tài khoản trong đó. " +
        "SoundCloud có thể vừa đổi cách dựng trang.",
    );
  }

  return {
    ...hoSo,
    tenTaiKhoan: ten,
    trangChu,
    duongDanRss: duongDanRss(hoSo.ma),
  };
}

/**
 * Rút thông tin tài khoản từ khối `window.__sc_hydration` nhúng trong trang.
 *
 * Tách riêng ra khỏi phần gọi mạng để thử được bằng một chuỗi HTML có sẵn,
 * không cần ra Internet.
 */
export function rutHoSo(trang: string): {
  ma: number;
  ten: string;
  soTheoDoi: number | null;
  soBaiTrenTrang: number | null;
} | null {
  const khop = trang.match(/window\.__sc_hydration\s*=\s*(\[[\s\S]*?\]);/);
  if (!khop) return null;

  let cacKhoi: unknown;
  try {
    cacKhoi = JSON.parse(khop[1]);
  } catch {
    return null;
  }
  if (!Array.isArray(cacKhoi)) return null;

  for (const khoi of cacKhoi) {
    if (
      typeof khoi !== "object" ||
      khoi === null ||
      (khoi as { hydratable?: string }).hydratable !== "user"
    ) {
      continue;
    }
    const du = (khoi as { data?: Record<string, unknown> }).data;
    if (!du || typeof du.id !== "number") continue;

    return {
      ma: du.id,
      ten:
        typeof du.username === "string" && du.username.trim()
          ? du.username
          : String(du.permalink ?? du.id),
      soTheoDoi:
        typeof du.followers_count === "number" ? du.followers_count : null,
      soBaiTrenTrang:
        typeof du.track_count === "number" ? du.track_count : null,
    };
  }

  return null;
}
