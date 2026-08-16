/**
 * Gom các cách viết khác nhau của cùng một người về một tên chuẩn.
 *
 * ## Vì sao đây là phần khó nhất của việc lọc theo tác giả
 *
 * Claude rút tên tác giả từ nội dung, nhưng nội dung viết tên kiểu gì thì nó
 * chép kiểu ấy. Đo ngày 2026-08-16 trên 225 bản ghi:
 *
 *   - "Thầy Thích Pháp Hòa" 23 lần, "Thích Pháp Hòa" 2 lần
 *   - "Thầy Thích Minh Niệm" 3 lần, "Thầy Minh Niệm" 2 lần, "Thích Minh Niệm" 1 lần
 *   - "N.D.Liem" 3 lần, "N.D.Liêm" 2 lần
 *
 * Không gom thì bộ lọc "Giảng sư" bày ra ba dòng cho cùng một vị, mà bấm dòng
 * nào cũng chỉ ra một phần nội dung. Tệ hơn là im lặng — người dùng không có
 * cách nào biết mình đang xem thiếu.
 *
 * ## Cách gom: quy tắc trước, không cần gọi mô hình
 *
 * Ba phép biến đổi là đủ cho phần lớn trường hợp, và cái được lớn nhất là
 * **kết quả đoán trước được**: chạy lại bao nhiêu lần cũng ra đúng một kết quả,
 * không phụ thuộc hôm nay mô hình trả lời thế nào.
 *
 *   1. Bỏ các tiền tố xưng hô — Thầy, Sư, Thượng toạ, Hoà thượng…
 *   2. Bỏ dấu tiếng Việt, bỏ dấu chấm, gộp khoảng trắng
 *   3. So sánh phần còn lại
 *
 * Riêng "Thích" cũng bị bỏ, dù nó là một phần pháp danh chứ không phải chức
 * danh. Lý do thuần thực dụng: người viết lúc có lúc không, nên giữ nó lại thì
 * "Thích Pháp Hoà" và "Pháp Hoà" thành hai người khác nhau.
 */

/**
 * Tiền tố xưng hô cần bỏ, XẾP TỪ DÀI TỚI NGẮN.
 *
 * Thứ tự quan trọng: nếu "sư" đứng trước "sư cô" thì "Sư cô Diệu Hạnh" chỉ bị
 * cắt chữ "sư", còn lại "cô diệu hạnh" — khác hẳn "Diệu Hạnh" ở chỗ khác.
 */
const XUNG_HO = [
  "hoa thuong",
  "thuong toa",
  "dai duc",
  "giang su",
  "tien si",
  "bac si",
  "nha van",
  "nha bao",
  "su co",
  "ni su",
  "thay",
  "thich",
  "su",
  "co",
  "chu",
  "ong",
  "ba",
  "ht",
  "tt",
  "dd",
  "ts",
  "bs",
];

/** Bỏ dấu tiếng Việt, về chữ thường, bỏ dấu chấm và gộp khoảng trắng. */
export function boDau(ten: string): string {
  return ten
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[.,'"“”‘’]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Rút ra khoá để so sánh hai cách viết tên.
 *
 * Hai tên cho ra cùng một khoá thì coi là cùng một người.
 */
export function khoaTen(ten: string): string {
  let con = boDau(ten);

  // Bỏ lặp: "Thầy Thích Pháp Hòa" phải cắt cả hai tiền tố
  let doi = true;
  while (doi) {
    doi = false;
    for (const xh of XUNG_HO) {
      if (con === xh) break;
      if (con.startsWith(xh + " ")) {
        con = con.slice(xh.length + 1).trim();
        doi = true;
        break;
      }
    }
  }

  return con;
}

export interface NhomTen {
  /** Cách viết được dùng nhiều nhất — lấy làm tên chuẩn */
  tenChuan: string;
  /** Mọi cách viết khác đã gặp */
  bietDanh: string[];
  /** Tổng số lần xuất hiện */
  soLan: number;
}

/**
 * Gom một danh sách tên thô thành các nhóm.
 *
 * Tên chuẩn chọn theo **cách viết xuất hiện nhiều nhất**, không phải cách viết
 * dài nhất hay ngắn nhất. Lý do: đó là cách chủ nhà quen nhìn thấy nhất, nên
 * cũng là cách họ dễ nhận ra nhất trong ô lọc.
 */
export function gomTen(cacTen: string[]): Map<string, NhomTen> {
  /** khoá → (cách viết → số lần) */
  const dem = new Map<string, Map<string, number>>();

  for (const tho of cacTen) {
    const ten = tho.trim();
    if (!ten) continue;
    const khoa = khoaTen(ten);
    if (!khoa) continue;

    const cach = dem.get(khoa) ?? new Map<string, number>();
    cach.set(ten, (cach.get(ten) ?? 0) + 1);
    dem.set(khoa, cach);
  }

  const ketQua = new Map<string, NhomTen>();
  for (const [khoa, cach] of dem) {
    const xepTheoSoLan = [...cach].sort((a, b) => b[1] - a[1]);
    const tenChuan = xepTheoSoLan[0][0];
    ketQua.set(khoa, {
      tenChuan,
      bietDanh: xepTheoSoLan.slice(1).map(([t]) => t),
      soLan: xepTheoSoLan.reduce((s, [, n]) => s + n, 0),
    });
  }

  return ketQua;
}
