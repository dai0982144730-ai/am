/**
 * Nhận diện sớm video có khả năng là nhạc, để **không tốn công lấy lời thoại**.
 *
 * VÌ SAO CẦN: nguyên tắc số hai của bản thiết kế nói nhạc đi nhánh riêng —
 * không lấy lời thoại, không cho mô hình đọc sâu. Nhưng đường ống hiện tại lấy
 * lời thoại TRƯỚC khi phân loại, nên lúc đó chưa biết đâu là nhạc.
 *
 * **Đã vấp thật (2026-08-14)**: 6/8 video nhạc trong kho đã bị lấy lời thoại,
 * cho ra 30–66 ký tự vô nghĩa. Vừa tốn lượt gọi, vừa tăng rủi ro bị YouTube
 * chặn, vừa chẳng dùng được vào việc gì.
 *
 * CÁCH LÀM: đoán bằng luật đơn giản dựa trên tiêu đề, tên kênh và thời lượng —
 * rẻ, chạy tức thì, không tốn lượt gọi nào.
 *
 * QUAN TRỌNG — đây KHÔNG phải bộ phân loại. Nó chỉ trả lời một câu hỏi hẹp:
 * *"có đáng bỏ công lấy lời thoại không?"*. Claude vẫn là người quyết định cuối
 * cùng video thuộc chuyên mục nào. Đoán nhầm một video không phải nhạc thì cùng
 * lắm là thiếu lời thoại của nó — lấy bù sau được, không mất mát gì.
 */

/** Dấu hiệu mạnh: gần như chắc chắn là nhạc. */
const DAU_HIEU_MANH = [
  // Thẻ hashtag hay gặp trên video nhạc
  "#dance",
  "#dj",
  "#djremix",
  "#remix",
  "#music",
  "#nhac",
  "#beat",
  "#guitarsolo",
  "#piano",
  "#lofi",
  "#bolero",
  "#karaoke",
  // Từ khoá trong tiêu đề
  "bpm",
  "nonstop",
  "mixtape",
  "dj mix",
  "full album",
  "official audio",
  "lyric video",
  "audio official",
  "nhạc sống",
  "nhạc trẻ",
  "nhạc vàng",
  "liên khúc",
  "hoà tấu",
  "hòa tấu",
  "cover nhạc",
  "guitar solo",
  "piano cover",
  "lofi chill",
];

/** Dấu hiệu yếu: chỉ tính là nhạc khi có từ hai dấu hiệu trở lên. */
const DAU_HIEU_YEU = [
  "mix",
  "remix",
  "cover",
  "playlist",
  "beat",
  "acoustic",
  "instrumental",
  "chill",
  "relax",
  "workout",
  "gym",
  "running",
  "nhạc",
  "song",
  "music",
  "guitar",
  "piano",
  "dance",
  "edm",
  "rap",
];

/**
 * Từ báo hiệu **không phải** nhạc dù có mấy chữ ở trên.
 *
 * Video dạy đàn, review tai nghe, phân tích ca từ… đều nhắc tới nhạc nhưng bản
 * thân không phải nhạc để nghe.
 */
const DAU_HIEU_LOAI_TRU = [
  "hướng dẫn",
  "dạy",
  "bài học",
  "tutorial",
  "lesson",
  "how to",
  "review",
  "đánh giá",
  "phân tích",
  "reaction",
  "phỏng vấn",
  "interview",
  "tin tức",
  "câu chuyện",
  "lịch sử",
  "tiểu sử",
];

export interface KetQuaNhanDien {
  coTheLaNhac: boolean;
  /** Vì sao đoán vậy — để ghi log và dò lại khi thấy sai */
  lyDo: string;
}

/**
 * Đoán xem video có phải nhạc không, chỉ bằng những gì thấy được ngay.
 *
 * @param tieuDe        Tiêu đề video
 * @param tenKenh       Tên kênh đăng
 * @param thoiLuongGiay Thời lượng, dùng làm dấu hiệu phụ
 */
export function coTheLaNhac(
  tieuDe: string,
  tenKenh?: string | null,
  thoiLuongGiay?: number | null,
): KetQuaNhanDien {
  const chu = `${tieuDe} ${tenKenh ?? ""}`.toLowerCase();

  const loaiTru = DAU_HIEU_LOAI_TRU.find((tu) => chu.includes(tu));
  if (loaiTru) {
    return {
      coTheLaNhac: false,
      lyDo: `có chữ "${loaiTru}" — nhiều khả năng là video nói về nhạc chứ không phải nhạc`,
    };
  }

  const manh = DAU_HIEU_MANH.find((tu) => chu.includes(tu));
  if (manh) {
    return { coTheLaNhac: true, lyDo: `có dấu hiệu mạnh "${manh}"` };
  }

  const yeu = DAU_HIEU_YEU.filter((tu) => chu.includes(tu));
  if (yeu.length >= 2) {
    return {
      coTheLaNhac: true,
      lyDo: `có ${yeu.length} dấu hiệu yếu: ${yeu.slice(0, 3).join(", ")}`,
    };
  }

  // Video rất dài mà tên kênh có chữ nhạc — hay gặp ở các bản mix nhiều tiếng
  if (
    thoiLuongGiay &&
    thoiLuongGiay > 3_600 &&
    yeu.length === 1 &&
    /nhạc|music|mix|beat/i.test(tenKenh ?? "")
  ) {
    return {
      coTheLaNhac: true,
      lyDo: `dài ${Math.round(thoiLuongGiay / 60)} phút và kênh chuyên nhạc`,
    };
  }

  return { coTheLaNhac: false, lyDo: "không thấy dấu hiệu nào" };
}
