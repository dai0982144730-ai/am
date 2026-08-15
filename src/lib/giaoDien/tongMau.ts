/**
 * Nhớ lựa chọn tông màu và áp dụng ngay.
 *
 * ## Ba lựa chọn, nhưng CSS chỉ thấy hai
 *
 * Người dùng chọn một trong ba: sáng, tối, hoặc theo máy. Nhưng thẻ `<html>`
 * chỉ bao giờ mang `data-tong="sang"` hoặc `data-tong="toi"` — "theo máy" được
 * quy đổi ra một trong hai ngay tại đây. Nhờ vậy file CSS không phải xử lý ba
 * trạng thái, và cũng không cần trộn `@media` với `[data-tong]` — trộn hai thứ
 * đó là chỗ rất dễ sinh ra lỗi kiểu "đổi được một chiều nhưng không đổi lại
 * được".
 *
 * ## Vì sao mặc định là TỐI
 *
 * Chủ dự án chọn vậy sau khi xem giao diện tham khảo. Người mở lần đầu, chưa
 * từng chọn gì, sẽ thấy nền đen.
 *
 * ## Vì sao `useSyncExternalStore` chứ không `useState` + `useEffect`
 *
 * Đọc bộ nhớ máy rồi `setState` ngay trong effect làm React vẽ lại hai lần mỗi
 * lần mở trang, và ESLint chặn đúng kiểu đó. Còn đọc thẳng lúc vẽ thì lần vẽ ở
 * máy chủ (không có bộ nhớ máy) lệch với lần vẽ ở trình duyệt. Cùng cách đã
 * dùng cho trạng thái co/bung của menu trái.
 */

export type TongMau = "sang" | "toi" | "may";

export const KHOA_TONG_MAU = "am-tong-mau";

/** Người chưa chọn gì thì dùng cái này. */
export const TONG_MAC_DINH: TongMau = "toi";

export const CAC_TONG: { ma: TongMau; ten: string; moTa: string }[] = [
  { ma: "sang", ten: "Sáng", moTa: "Nền be nhạt" },
  { ma: "toi", ten: "Tối", moTa: "Nền đen" },
  { ma: "may", ten: "Theo máy", moTa: "Bám cài đặt Windows" },
];

function hopLe(x: string | null): x is TongMau {
  return x === "sang" || x === "toi" || x === "may";
}

/**
 * Đoạn mã chạy TRƯỚC khi trang được vẽ, nhúng thẳng vào `<head>`.
 *
 * VÌ SAO PHẢI NHÚNG THẲNG CHỨ KHÔNG DÙNG COMPONENT: nếu đợi React chạy xong mới
 * đặt tông màu thì người dùng nhìn thấy một nháy trắng rồi mới chuyển sang đen.
 * Chỉ có đoạn mã chặn ngay trong `<head>` mới kịp.
 *
 * Viết gọn hết mức và tự bọc `try` — đoạn này chạy trước mọi thứ khác, nó mà
 * hỏng thì cả trang trắng. Bộ nhớ máy có thể bị chặn (chế độ ẩn danh, hoặc
 * người dùng tắt), nên hỏng thì lặng lẽ quay về tông mặc định.
 */
export const MA_DAT_TONG_SOM = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  KHOA_TONG_MAU,
)});if(t!=="sang"&&t!=="toi"&&t!=="may")t=${JSON.stringify(TONG_MAC_DINH)};if(t==="may")t=matchMedia("(prefers-color-scheme: dark)").matches?"toi":"sang";document.documentElement.dataset.tong=t;}catch(e){document.documentElement.dataset.tong=${JSON.stringify(
  TONG_MAC_DINH,
)};}})();`;

// ==========================================================================
// Kho trạng thái nhỏ, dùng với useSyncExternalStore
// ==========================================================================

const NGUOI_NGHE = new Set<() => void>();

export function dangKyNgheTong(goiLai: () => void): () => void {
  NGUOI_NGHE.add(goiLai);

  // Người chọn "theo máy" thì đổi cài đặt Windows phải thấy đổi ngay, không
  // phải tải lại trang
  const doiTheoMay = () => {
    if (docTongTrenTrinhDuyet() === "may") apDung("may");
    goiLai();
  };
  const nghe = window.matchMedia("(prefers-color-scheme: dark)");
  nghe.addEventListener("change", doiTheoMay);

  return () => {
    NGUOI_NGHE.delete(goiLai);
    nghe.removeEventListener("change", doiTheoMay);
  };
}

export function docTongTrenTrinhDuyet(): TongMau {
  try {
    const x = window.localStorage.getItem(KHOA_TONG_MAU);
    return hopLe(x) ? x : TONG_MAC_DINH;
  } catch {
    return TONG_MAC_DINH;
  }
}

/** Máy chủ không biết người dùng chọn gì — luôn trả về mặc định. */
export function docTongTrenMayChu(): TongMau {
  return TONG_MAC_DINH;
}

/** Quy đổi "theo máy" thành giá trị thật rồi gắn lên thẻ `<html>`. */
function apDung(tong: TongMau): void {
  const that =
    tong === "may"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "toi"
        : "sang"
      : tong;
  document.documentElement.dataset.tong = that;
}

export function datTongMau(tong: TongMau): void {
  try {
    window.localStorage.setItem(KHOA_TONG_MAU, tong);
  } catch {
    // Không lưu được thì vẫn đổi cho phiên này, chỉ là mở lại sẽ mất
  }
  apDung(tong);
  for (const goiLai of NGUOI_NGHE) goiLai();
}
