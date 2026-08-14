/**
 * Chuẩn hoá văn bản để máy đọc thành tiếng.
 *
 * Mọi endpoint sinh chữ đều phải cho `traLoiNgan` đi qua hàm này trước khi trả
 * về. Máy đọc gặp "**Kết quả:** xem tại https://youtu.be/abc — 85% (LLM)" sẽ đọc
 * ra một tràng ký tự vô nghĩa; qua hàm này thành câu nghe được.
 *
 * Dùng chung cả ba trang. Bảng từ viết tắt nằm riêng ở vietTat.ts để bổ sung dần.
 */

import { VIET_TAT, DON_VI } from "./vietTat";
import { docSo, docSoThapPhan } from "./docSo";

/**
 * Các chữ cái được coi là "trong một từ".
 *
 * Cần liệt kê cả nguyên âm tiếng Việt có dấu, vì `\b` của biểu thức chính quy
 * chỉ hiểu bảng chữ cái tiếng Anh: với `\b`, chuỗi "hoài" sẽ bị coi là biên từ ở
 * giữa "ho" và "ài", dẫn tới thay nhầm.
 */
const CHU_CAI = "A-Za-zÀ-ỹĐđ0-9";

/** Bỏ ký hiệu markdown, giữ lại phần chữ */
function boMarkdown(vanBan: string): string {
  return (
    vanBan
      // Khối code ```...``` — bỏ hẳn, đọc code lên là vô nghĩa
      .replace(/```[\s\S]*?```/g, " ")
      // Code trong dòng `abc` — giữ chữ, bỏ dấu nháy
      .replace(/`([^`]*)`/g, "$1")
      // Ảnh ![mô tả](url) — bỏ hẳn
      .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
      // Link [chữ](url) — giữ chữ, bỏ địa chỉ
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      // Dòng kẻ ngang và dòng phân cách của bảng
      .replace(/^\s*\|?[\s:|-]*\|[\s:|-]*$/gm, " ")
      .replace(/^\s*[-*_]{3,}\s*$/gm, " ")
      // Ô bảng: đổi dấu gạch đứng thành dấu phẩy để đọc còn ngắt được
      .replace(/\s*\|\s*/g, ", ")
      // Tiêu đề, đậm, nghiêng, trích dẫn
      .replace(/^#{1,6}\s*/gm, "")
      .replace(/\*\*([^*]*)\*\*/g, "$1")
      .replace(/(?<![A-Za-z0-9])[*_]([^*_\n]+)[*_](?![A-Za-z0-9])/g, "$1")
      .replace(/^\s*>\s?/gm, "")
      // Dấu đầu dòng và số thứ tự đầu dòng
      .replace(/^\s*[-*+]\s+/gm, "")
      .replace(/^\s*\d+[.)]\s+/gm, "")
  );
}

/** Thay địa chỉ web bằng một cụm đọc được */
function thayDuongDan(vanBan: string): string {
  return vanBan
    .replace(/https?:\/\/\S+/g, " xem đường dẫn trên màn hình ")
    .replace(/\bwww\.\S+/g, " xem đường dẫn trên màn hình ")
    // Địa chỉ email cũng đọc lên rất tệ
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, " xem địa chỉ trên màn hình ");
}

/**
 * Thay từ viết tắt.
 *
 * Khớp đúng chữ hoa (không dùng cờ `i`) — xem lời giải thích trong vietTat.ts.
 * Sắp xếp từ dài đến ngắn để "LLMs" được xử lý trước "LLM".
 */
function thayVietTat(vanBan: string): string {
  const danhSach = Object.keys(VIET_TAT).sort((a, b) => b.length - a.length);
  let ketQua = vanBan;

  for (const tu of danhSach) {
    const thoat = tu.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    ketQua = ketQua.replace(
      new RegExp(`(?<![${CHU_CAI}])${thoat}(?![${CHU_CAI}])`, "g"),
      VIET_TAT[tu],
    );
  }

  return ketQua;
}

/**
 * Đọc số và đơn vị thành lời.
 *
 * Cố ý KHÔNG đọc mọi số nguyên đứng một mình: giọng đọc tiếng Việt vốn xử lý
 * "2026" hay "150" khá tốt, ép đọc hết sẽ làm câu dài lê thê. Chỉ can thiệp vào
 * những chỗ máy đọc hay sai: phần trăm, ngày tháng, và số dính đơn vị viết tắt
 * ("45ph" đọc thành "bốn mươi lăm phút" thay vì "bốn mươi lăm phờ hát").
 */
function docSoVaDonVi(vanBan: string): string {
  return (
    vanBan
      // Ngày dạng dd/mm/yyyy hoặc dd-mm-yyyy.
      // Nuốt luôn chữ "ngày" nếu câu gốc đã có, để không đọc thành "ngày ngày".
      .replace(/(?:\bngày\s+)?\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/gi, (_, d, m, y) =>
        ` ngày ${docSo(Number(d))} tháng ${docSo(Number(m))} năm ${docSo(Number(y))} `,
      )
      // Ngày dạng yyyy-mm-dd (định dạng JSON hay dùng)
      .replace(/(?:\bngày\s+)?\b(\d{4})-(\d{1,2})-(\d{1,2})\b/gi, (_, y, m, d) =>
        ` ngày ${docSo(Number(d))} tháng ${docSo(Number(m))} năm ${docSo(Number(y))} `,
      )
      // Phần trăm, kể cả số lẻ
      .replace(/\b(\d+(?:[.,]\d+)?)\s*%/g, (_, so) => {
        const giaTri = Number(String(so).replace(",", "."));
        return ` ${docSoThapPhan(giaTri)} phần trăm `;
      })
      // Số dính đơn vị viết tắt: 45ph, 2h, 500mb
      .replace(
        new RegExp(`\\b(\\d+)\\s*(${Object.keys(DON_VI).join("|")})(?![${CHU_CAI}])`, "gi"),
        (khop, so, donVi) => {
          const ten = DON_VI[String(donVi).toLowerCase()];
          return ten ? ` ${docSo(Number(so))} ${ten} ` : khop;
        },
      )
  );
}

/** Dọn khoảng trắng và dấu câu thừa sau khi đã thay thế loạn xạ ở trên */
function donDep(vanBan: string): string {
  return vanBan
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/([,;:])\1+/g, "$1")
    .replace(/^[\s,;:.-]+/, "")
    // Bỏ dấu phẩy/chấm phẩy lủng lẳng ở cuối — hay gặp sau khi dọn xong một bảng
    .replace(/[\s,;:]+$/, "")
    .trim();
}

/**
 * Chuẩn hoá một đoạn văn bản để đọc thành tiếng.
 *
 * @param vanBan  Văn bản gốc, có thể chứa markdown
 * @param gioiHan Cắt bớt nếu dài quá (mặc định 400 ký tự — xem ghi chú dưới)
 *
 * Về giới hạn độ dài: chỗ đúng để giới hạn là PROMPT gửi Claude, không phải hàm
 * này. Cắt bằng code sẽ chặt đứt giữa câu, nghe rất tệ. Tham số `gioiHan` ở đây
 * chỉ là lưới an toàn phòng khi Claude viết dài quá, và nó cắt ở ranh giới câu
 * chứ không cắt giữa chừng.
 */
export function chuanHoaDeDoc(vanBan: string, gioiHan = 400): string {
  if (!vanBan) return "";

  let ketQua = boMarkdown(vanBan);
  ketQua = thayDuongDan(ketQua);
  ketQua = docSoVaDonVi(ketQua);
  ketQua = thayVietTat(ketQua);
  ketQua = donDep(ketQua);

  if (ketQua.length <= gioiHan) return ketQua;

  // Cắt ở dấu chấm gần nhất trước giới hạn, để không đứt giữa câu
  const phanDau = ketQua.slice(0, gioiHan);
  const viTriChamCuoi = Math.max(
    phanDau.lastIndexOf("."),
    phanDau.lastIndexOf("!"),
    phanDau.lastIndexOf("?"),
  );

  // Chỉ cắt theo câu nếu câu đó chiếm ít nhất nửa giới hạn; không thì cắt theo từ
  if (viTriChamCuoi > gioiHan / 2) return phanDau.slice(0, viTriChamCuoi + 1).trim();

  const viTriTrangCuoi = phanDau.lastIndexOf(" ");
  return `${phanDau.slice(0, viTriTrangCuoi > 0 ? viTriTrangCuoi : gioiHan).trim()}.`;
}
