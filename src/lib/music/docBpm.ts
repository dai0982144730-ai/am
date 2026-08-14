/**
 * Đọc số nhịp (BPM) và thể loại nhạc từ tiêu đề với mô tả.
 *
 * NGUYÊN TẮC CỨNG: **không bao giờ đoán**. Bản thiết kế nói rõ — gắn sai số
 * nhịp làm hỏng cả buổi tập, nên thà để trống còn hơn đoán. Cách duy nhất chấp
 * nhận được là đọc con số mà chính người đăng đã ghi ra.
 *
 * Vì sao không tự phân tích nhịp từ tiếng nhạc: phải tải audio về, tốn máy, và
 * rủi ro vi phạm điều khoản sử dụng — trong khi phần lớn kênh nhạc tập luyện đã
 * tự ghi sẵn số nhịp trong tiêu đề. Không đáng.
 *
 * Ba mức tin cậy, đúng theo bản thiết kế:
 *   - `stated_in_title`       — ghi trong tiêu đề, tin nhất
 *   - `stated_in_description` — ghi trong mô tả, tin vừa
 *   - `inferred`              — suy ra, KHÔNG DÙNG ở đây
 */

export type DoTinCayBpm = "stated_in_title" | "stated_in_description";

export interface KetQuaDocBpm {
  bpm: number | null;
  doTinCay: DoTinCayBpm | null;
  /** Đoạn chữ đã khớp — giữ lại để dò khi thấy sai */
  choKhop: string | null;
}

/**
 * Khoảng nhịp hợp lệ.
 *
 * Dưới 60 hoặc trên 220 gần như chắc chắn không phải số nhịp mà là thứ khác:
 * năm, số thứ tự tập, lượt xem…
 */
const NHIP_THAP_NHAT = 60;
const NHIP_CAO_NHAT = 220;

/**
 * Các cách người ta hay ghi số nhịp.
 *
 * Bắt buộc phải có chữ "BPM" đứng cạnh — chỉ một con số trần thì không đủ căn
 * cứ. "155 BPM Running Mix" thì lấy, còn "Top 155 bài hát hay" thì không.
 */
const CACH_GHI = [
  // "150 BPM", "150BPM", "150 bpm"
  /(\d{2,3})\s*bpm/i,
  // "BPM: 150", "BPM 150"
  /bpm[:\s]+(\d{2,3})/i,
  // "150 nhịp"
  /(\d{2,3})\s*nhịp/i,
];

/** Đọc số nhịp từ một đoạn chữ. */
function doc(chu: string): { bpm: number; choKhop: string } | null {
  for (const cach of CACH_GHI) {
    const khop = cach.exec(chu);
    if (!khop) continue;

    const so = Number(khop[1]);
    if (so >= NHIP_THAP_NHAT && so <= NHIP_CAO_NHAT) {
      return { bpm: so, choKhop: khop[0] };
    }
  }
  return null;
}

/**
 * Đọc số nhịp, ưu tiên tiêu đề hơn mô tả.
 *
 * Tiêu đề đáng tin hơn vì đó là thứ người đăng viết cho người xem thấy ngay;
 * mô tả thì hay có số nhịp của những bài khác trong cùng danh sách.
 */
export function docBpm(
  tieuDe: string,
  moTa?: string | null,
): KetQuaDocBpm {
  const tuTieuDe = doc(tieuDe);
  if (tuTieuDe) {
    return {
      bpm: tuTieuDe.bpm,
      doTinCay: "stated_in_title",
      choKhop: tuTieuDe.choKhop,
    };
  }

  if (moTa) {
    // Chỉ đọc phần đầu mô tả — cuối mô tả thường là danh sách bài và link,
    // dễ nhặt nhầm số nhịp của bài khác
    const tuMoTa = doc(moTa.slice(0, 500));
    if (tuMoTa) {
      return {
        bpm: tuMoTa.bpm,
        doTinCay: "stated_in_description",
        choKhop: tuMoTa.choKhop,
      };
    }
  }

  return { bpm: null, doTinCay: null, choKhop: null };
}

/**
 * Xếp số nhịp vào dải 5 nhịp, chỉ trong khoảng 140–180 mà chủ dự án quan tâm.
 *
 * Ngoài khoảng đó trả `null`: một bản nhạc 90 nhịp không dùng để chạy bộ được,
 * xếp dải cho nó chỉ làm rối bộ lọc.
 */
export function xepDaiBpm(bpm: number | null): string | null {
  if (bpm === null || bpm < 140 || bpm >= 180) return null;
  const dau = Math.floor(bpm / 5) * 5;
  return `${dau}-${dau + 5}`;
}

/** Xếp độ dài bản mix vào nhóm — chỉ áp dụng cho nhạc tập thể thao. */
export function xepDaiThoiLuong(giay: number | null): string | null {
  if (giay === null) return null;
  if (giay > 3_600) return ">1h";
  if (giay > 2_400) return ">40ph";
  if (giay > 1_200) return ">20ph";
  return null;
}

export type TheLoaiNhac =
  | "workout_bpm"
  | "dance"
  | "piano"
  | "guitar_rock"
  | "nhac_vang";

/**
 * Đoán thể loại nhạc bằng luật đơn giản.
 *
 * Bản thiết kế nói dùng một lần gọi mô hình rẻ để chuẩn hoá thể loại. Nhưng
 * phần lớn trường hợp luật đơn giản đã đủ — và luật thì miễn phí. Chỉ những
 * video luật chịu thua mới cần hỏi mô hình, nhờ vậy nhánh nhạc gần như không
 * tốn gì dù số lượng lớn.
 *
 * Trả `null` khi không chắc, để chỗ gọi quyết định có hỏi mô hình hay không.
 */
export function doanTheLoai(
  tieuDe: string,
  tenKenh?: string | null,
): TheLoaiNhac | null {
  const chu = `${tieuDe} ${tenKenh ?? ""}`.toLowerCase();

  // Xét nhạc tập luyện trước: nếu có số nhịp thì gần như chắc chắn là loại này
  if (/bpm|workout|gym|running|chạy bộ|tập luyện|hiit|cardio/.test(chu)) {
    return "workout_bpm";
  }
  if (/bolero|nhạc vàng|nhạc xưa|trữ tình|phòng trà|nhạc sến/.test(chu)) {
    return "nhac_vang";
  }
  if (/piano|dương cầm/.test(chu)) return "piano";
  if (/guitar|rock|metal|electric guitar/.test(chu)) return "guitar_rock";
  if (/dance|edm|dj|remix|house|techno|club/.test(chu)) return "dance";

  return null;
}
