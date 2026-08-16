/**
 * Đo độ dài một file mp3 mà không cần cài thêm gì.
 *
 * ## Vì sao phải đo
 *
 * Bản đọc tiếng Việt ngắn hơn hẳn clip gốc — nó là bản thuật lại cô đặc, không
 * phải bản dịch từng câu. Đo thật một bản: clip gốc 8 phút, file mp3 chỉ 6 phút.
 * Trang Hàng chờ cộng thời lượng lại để xếp cho vừa 30 phút, nên lấy nhầm con
 * số của clip gốc là hàng chờ luôn dài hơn thực tế khoảng một phần tư.
 *
 * ## Vì sao không gọi ffprobe
 *
 * ffprobe đo chính xác và máy này đang có sẵn. Nhưng nó là một chương trình cài
 * riêng bên ngoài repo — máy còn lại (chỗ làm) có thể không có, và lúc đó việc
 * tạo âm thanh sẽ hỏng vì một lý do chẳng liên quan gì tới âm thanh. Đọc thẳng
 * mấy byte đầu file thì chạy ở đâu cũng như nhau.
 *
 * ## Cách đọc
 *
 * File mp3 là một chuỗi khung liền nhau, mỗi khung mở đầu bằng 11 bit 1 rồi tới
 * phần khai báo tốc độ bit và tần số lấy mẫu. Google đọc thành tiếng xuất ra
 * **tốc độ bit cố định**, nên chỉ cần đọc khung đầu tiên rồi lấy số byte chia
 * cho tốc độ bit là ra số giây. Đã đối chiếu với ffprobe, xem `PROGRESS.md`.
 */

import { readFile } from "node:fs/promises";

/** Bảng tốc độ bit của MPEG-1 Layer III, tính bằng kbps. Chỉ số lấy từ header. */
const TOC_DO_BIT_V1_L3 = [
  0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0,
];

/** MPEG-2 và 2.5 Layer III — Google hay dùng 24 kHz nên rơi vào nhánh này. */
const TOC_DO_BIT_V2_L3 = [
  0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0,
];

const TAN_SO = {
  v1: [44100, 48000, 32000],
  v2: [22050, 24000, 16000],
  v25: [11025, 12000, 8000],
};

/**
 * Bỏ qua thẻ ID3v2 ở đầu file nếu có.
 *
 * Không bỏ thì mấy byte của thẻ bị đọc nhầm thành khung âm thanh, ra tốc độ bit
 * vô nghĩa và độ dài sai hẳn.
 */
function boQuaId3(du: Buffer): number {
  if (du.length < 10) return 0;
  if (du.toString("latin1", 0, 3) !== "ID3") return 0;
  // Kích thước ghi ở 4 byte cuối header, mỗi byte chỉ dùng 7 bit
  const co =
    (du[6] << 21) | (du[7] << 14) | (du[8] << 7) | du[9];
  return 10 + co;
}

/**
 * Đo độ dài file mp3, trả về số giây (làm tròn).
 *
 * Trả `null` khi không đọc được header — thà để trống còn hơn ghi một con số
 * đoán, đúng nguyên tắc đã áp cho BPM.
 */
export async function doDaiMp3(duongDanFile: string): Promise<number | null> {
  let du: Buffer;
  try {
    du = await readFile(duongDanFile);
  } catch {
    return null;
  }

  const batDau = boQuaId3(du);

  // Tìm khung đầu tiên: 11 bit 1 liên tiếp
  for (let i = batDau; i < Math.min(du.length - 4, batDau + 200_000); i++) {
    if (du[i] !== 0xff || (du[i + 1] & 0xe0) !== 0xe0) continue;

    const maPhienBan = (du[i + 1] >> 3) & 0b11;
    const maLop = (du[i + 1] >> 1) & 0b11;
    // Chỉ đọc Layer III (mã 0b01). Layer khác thì không phải mp3 thường
    if (maLop !== 0b01 || maPhienBan === 0b01) continue;

    const chiSoTocDo = (du[i + 2] >> 4) & 0b1111;
    const chiSoTanSo = (du[i + 2] >> 2) & 0b11;
    if (chiSoTocDo === 0 || chiSoTocDo === 15 || chiSoTanSo === 3) continue;

    const laV1 = maPhienBan === 0b11;
    const tocDoBit =
      (laV1 ? TOC_DO_BIT_V1_L3 : TOC_DO_BIT_V2_L3)[chiSoTocDo] * 1000;
    const tanSo = (
      laV1 ? TAN_SO.v1 : maPhienBan === 0b10 ? TAN_SO.v2 : TAN_SO.v25
    )[chiSoTanSo];
    if (!tocDoBit || !tanSo) continue;

    const soByteAmThanh = du.length - i;
    return Math.round((soByteAmThanh * 8) / tocDoBit);
  }

  return null;
}
