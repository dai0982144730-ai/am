/**
 * Chỗ để ô ghi chú hỏi trình phát: "video đang ở giây thứ mấy?"
 *
 * VÌ SAO CẦN: ghi chú phải gắn đúng mốc thời gian — đó là điều làm nó khác một
 * ứng dụng ghi chú thường. Nghe tới phút 23 thấy một ý hay, ghi lại, sau này
 * bấm vào là nhảy thẳng về phút 23 nghe lại. Nhưng ô ghi chú và trình phát là
 * hai thành phần nằm cạnh nhau trong một trang server, không truyền state cho
 * nhau được.
 *
 * Cách giải: trình phát **gửi vào đây một hàm** để hỏi giờ; ô ghi chú gọi hàm
 * đó khi cần. Không phải state của React nên không gây vẽ lại — mà cũng không
 * cần, vì chỉ hỏi đúng một lần lúc bấm nút ghi.
 */

type HamLayViTri = () => number;
type HamTuaToi = (giay: number) => void;

let layViTriHienTai: HamLayViTri | null = null;
let tuaToiGiay: HamTuaToi | null = null;

/** Trình phát gọi hàm này khi sẵn sàng, và gọi lại với `null` khi bị huỷ. */
export function dangKyNguonViTri(
  ham: HamLayViTri | null,
  tua?: HamTuaToi | null,
): void {
  layViTriHienTai = ham;
  tuaToiGiay = tua ?? null;
}

/**
 * Tua video tới một giây.
 *
 * Đây là nửa còn lại của việc gắn mốc thời gian: ghi chú lưu được giây thứ mấy
 * mà bấm vào không nhảy tới đó thì con số đấy chỉ để trang trí.
 *
 * Trả về `false` khi trang không có trình phát — khi đó chỗ gọi tự lo, thường
 * là mở sang trang xem.
 */
export function tuaToi(giay: number): boolean {
  if (!tuaToiGiay) return false;
  try {
    tuaToiGiay(giay);
    return true;
  } catch {
    return false;
  }
}

/**
 * Giây hiện tại của trình phát, hoặc `null` khi trang không có trình phát
 * (bài viết chẳng hạn) — khi đó ghi chú không gắn mốc nào cả.
 */
export function hoiViTri(): number | null {
  if (!layViTriHienTai) return null;
  try {
    const giay = layViTriHienTai();
    return Number.isFinite(giay) ? Math.floor(giay) : null;
  } catch {
    return null;
  }
}
