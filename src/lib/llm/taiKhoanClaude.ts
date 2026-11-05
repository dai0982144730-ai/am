/**
 * Tài khoản Claude RIÊNG của Am, đăng nhập ở trang Vận hành.
 *
 * Claude CLI cất thông tin đăng nhập trong thư mục do biến `CLAUDE_CONFIG_DIR`
 * chỉ định. Am dùng một thư mục riêng, `~/.am/claude-tk`, nằm ngoài dự án nên
 * không bao giờ bị đưa lên Git.
 *
 * "Đã đăng nhập" nghĩa là có file `.credentials.json` trong thư mục đó. Am không
 * đọc, không sao chép, không lưu token: file do chính CLI ghi và CLI đọc.
 *
 * Chưa đăng nhập riêng thì mọi lệnh gọi Claude vẫn chạy bằng tài khoản mặc định
 * của máy, đúng như trước khi có tính năng này.
 *
 * Mã này lấy ý tưởng từ app agent SCI (phiên "11 Việc chung"), rút lại cho một
 * người dùng: một thư mục, không có hai tài khoản luân phiên.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const TEP_DANG_NHAP = ".credentials.json";

/** Thư mục đăng nhập riêng của Am. Tên không dấu vì cmd.exe đọc sai đường dẫn có dấu. */
export function thuMucTaiKhoan(): string {
  return path.join(os.homedir(), ".am", "claude-tk");
}

/** Am đã có đăng nhập Claude riêng chưa. */
export function coDangNhap(): boolean {
  try {
    return fs.existsSync(path.join(thuMucTaiKhoan(), TEP_DANG_NHAP));
  } catch {
    return false;
  }
}

/**
 * Giá trị `CLAUDE_CONFIG_DIR` khi gọi Claude: thư mục riêng nếu đã đăng nhập,
 * `undefined` nếu chưa (dùng tài khoản mặc định của máy).
 */
export function thuMucChay(): string | undefined {
  return coDangNhap() ? thuMucTaiKhoan() : undefined;
}

/**
 * Đăng xuất: xoá file đăng nhập trong thư mục RIÊNG của Am. Không bao giờ đụng
 * tới tài khoản mặc định của máy (`~/.claude`).
 */
export function dangXuat(): boolean {
  try {
    fs.unlinkSync(path.join(thuMucTaiKhoan(), TEP_DANG_NHAP));
    return true;
  } catch {
    return false;
  }
}
