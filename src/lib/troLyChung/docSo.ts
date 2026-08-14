/**
 * Đọc số thành chữ tiếng Việt.
 *
 * Dùng chung cả ba trang. `tiendo` cần nhất (phần trăm hoàn thành, số ngày
 * chậm), `phaply` cần cho số hiệu văn bản, `am` cần cho thời lượng và lượt xem.
 *
 * Tiếng Việt có mấy quy tắc bất quy tắc mà nếu ghép máy móc sẽ đọc sai:
 *   15 → "mười lăm"        (không phải "mười năm")
 *   21 → "hai mươi mốt"    (không phải "hai mươi một")
 *   24 → "hai mươi tư"     (không phải "hai mươi bốn")
 *   25 → "hai mươi lăm"    (không phải "hai mươi năm")
 *   105 → "một trăm lẻ năm" (phải có chữ "lẻ")
 */

const CHU_SO = [
  "không",
  "một",
  "hai",
  "ba",
  "bốn",
  "năm",
  "sáu",
  "bảy",
  "tám",
  "chín",
];

/** Tên các nhóm ba chữ số, từ nhỏ đến lớn */
const TEN_NHOM = ["", " nghìn", " triệu", " tỷ"];

/**
 * Đọc một nhóm ba chữ số (0–999).
 *
 * `batBuocDocTram` = true khi nhóm này đứng sau một nhóm lớn hơn: 1.005 phải đọc
 * "một nghìn không trăm lẻ năm", không phải "một nghìn lẻ năm".
 */
function docNhomBaChuSo(so: number, batBuocDocTram: boolean): string {
  const tram = Math.floor(so / 100);
  const chuc = Math.floor((so % 100) / 10);
  const donVi = so % 10;
  const phan: string[] = [];

  if (tram > 0 || batBuocDocTram) {
    phan.push(CHU_SO[tram], "trăm");
  }

  if (chuc === 0) {
    // Có hàng trăm mà không có hàng chục thì phải chèn "lẻ": 105 → một trăm lẻ năm
    if (donVi > 0) {
      if (tram > 0 || batBuocDocTram) phan.push("lẻ");
      phan.push(CHU_SO[donVi]);
    }
  } else if (chuc === 1) {
    phan.push("mười");
    if (donVi === 5) phan.push("lăm");
    else if (donVi > 0) phan.push(CHU_SO[donVi]);
  } else {
    phan.push(CHU_SO[chuc], "mươi");
    if (donVi === 1) phan.push("mốt");
    else if (donVi === 4) phan.push("tư");
    else if (donVi === 5) phan.push("lăm");
    else if (donVi > 0) phan.push(CHU_SO[donVi]);
  }

  return phan.join(" ");
}

/**
 * Đọc một số nguyên thành chữ.
 *
 * Trên 999 tỷ thì trả lại chính con số — vượt quá mức này thì đọc thành lời cũng
 * không ai nghe hiểu, và ba trang này không có dữ liệu lớn đến vậy.
 */
export function docSo(so: number): string {
  if (!Number.isFinite(so)) return String(so);

  const lamTron = Math.round(so);
  if (lamTron < 0) return `âm ${docSo(-lamTron)}`;
  if (lamTron === 0) return "không";
  if (lamTron >= 1_000_000_000_000) return String(lamTron);

  // Tách thành các nhóm ba chữ số, nhom[0] là hàng đơn vị
  const nhom: number[] = [];
  let conLai = lamTron;
  while (conLai > 0) {
    nhom.push(conLai % 1000);
    conLai = Math.floor(conLai / 1000);
  }

  const phan: string[] = [];
  for (let i = nhom.length - 1; i >= 0; i--) {
    if (nhom[i] === 0) continue;
    // Nhóm nào không phải nhóm đầu tiên thì buộc đọc cả hàng trăm
    const coNhomLonHon = i < nhom.length - 1;
    phan.push(docNhomBaChuSo(nhom[i], coNhomLonHon) + TEN_NHOM[i]);
  }

  return phan.join(" ");
}

/**
 * Đọc số thập phân. Phần lẻ đọc từng chữ số một, đúng thói quen tiếng Việt:
 * 8.5 → "tám phẩy năm", 0.87 → "không phẩy tám bảy".
 */
export function docSoThapPhan(so: number): string {
  if (!Number.isFinite(so)) return String(so);
  if (Number.isInteger(so)) return docSo(so);

  const am = so < 0;
  const duong = Math.abs(so);
  const phanNguyen = Math.floor(duong);
  // Cắt ở 2 chữ số lẻ — đọc dài hơn thế là thừa
  const phanLe = String(Math.round((duong - phanNguyen) * 100)).padStart(2, "0").replace(/0+$/, "");

  if (phanLe === "") return docSo(am ? -phanNguyen : phanNguyen);

  const chuSoLe = phanLe
    .split("")
    .map((c) => CHU_SO[Number(c)])
    .join(" ");

  return `${am ? "âm " : ""}${docSo(phanNguyen)} phẩy ${chuSoLe}`;
}
