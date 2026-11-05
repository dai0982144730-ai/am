/**
 * Thử luồng đăng nhập Claude bằng một Claude CLI GIẢ (không đụng tài khoản thật).
 *
 *   npx tsx scripts/thu-dang-nhap-claude.ts
 *
 * CLI giả làm đúng những gì CLI thật làm theo mô tả của app agent SCI:
 *   - `auth login --claudeai`: in ra dòng "If the browser didn't open, visit: <link>",
 *     chờ một dòng mã ở đầu vào, mã đúng thì ghi `.credentials.json` vào
 *     CLAUDE_CONFIG_DIR rồi thoát 0, mã sai thì in "status code 400" và thoát 1.
 *   - `auth status --json`: đọc xem có file đăng nhập không.
 *
 * Việc cần chứng minh: tiến trình sống qua hai lần gọi, mã đi qua đầu vào chuẩn,
 * thư mục đăng nhập đúng chỗ, khoá API bị gỡ, huỷ và hết giờ dọn sạch tiến trình.
 * Chưa chứng minh được: lời lẽ của CLI thật có đổi theo phiên bản hay không.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const nha = fs.mkdtempSync(path.join(os.tmpdir(), "am-thu-dn-"));
process.env.HOME = nha;
process.env.USERPROFILE = nha;
process.env.ANTHROPIC_API_KEY = "sk-gia-phai-bi-go";

const giaCli = path.join(nha, "claude");
fs.writeFileSync(
  giaCli,
  `#!/usr/bin/env node
const fs = require("fs"), path = require("path");
const a = process.argv.slice(2);
const dir = process.env.CLAUDE_CONFIG_DIR;
fs.appendFileSync(process.env.GHI_LOG, JSON.stringify({ a, dir, browser: process.env.BROWSER, coKhoaApi: !!process.env.ANTHROPIC_API_KEY }) + "\\n");
if (a[0] === "--version") { console.log("9.9.9 (Claude Code gia)"); process.exit(0); }
if (a[0] === "auth" && a[1] === "status") {
  const co = dir && fs.existsSync(path.join(dir, ".credentials.json"));
  console.log("nhieu chu " + JSON.stringify({ loggedIn: !!co, email: co ? "chu@vi-du.test" : "", subscriptionType: co ? "max" : "" }));
  process.exit(0);
}
if (a[0] === "auth" && a[1] === "login") {
  console.log("Opening browser...");
  console.log("If the browser didn't open, visit: https://claude.ai/oauth/authorize?code=true&client_id=gia&state=xyz");
  process.stdin.setEncoding("utf8");
  let buf = "";
  process.stdin.on("data", (d) => {
    buf += d;
    if (!buf.includes("\\n")) return;
    const ma = buf.trim();
    if (ma === "MA-DUNG-1234567890") {
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, ".credentials.json"), "{}");
      process.exit(0);
    }
    console.error("Request failed with status code 400");
    process.exit(1);
  });
  setTimeout(() => process.exit(2), 600000);
} else { process.exit(3); }
`,
);
fs.chmodSync(giaCli, 0o755);
process.env.CLAUDE_CLI_PATH = giaCli;
process.env.GHI_LOG = path.join(nha, "log.jsonl");

let loi = 0;
function kiem(ten: string, dung: boolean, chiTiet?: unknown) {
  console.log(`${dung ? "ĐẠT  " : "HỎNG "} ${ten}${dung ? "" : "  → " + JSON.stringify(chiTiet)}`);
  if (!dung) loi++;
}
const doc = () =>
  fs.existsSync(process.env.GHI_LOG!)
    ? fs.readFileSync(process.env.GHI_LOG!, "utf8").trim().split("\n").map((d) => JSON.parse(d))
    : [];
// Có tiến trình nào còn chạy khớp mẫu này không (pgrep thoát 1 khi không có)
const conSong = (mau: string) => {
  try {
    execFileSync("pgrep", ["-f", mau], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
};

async function main() {
  const dn = await import("@/lib/llm/dangNhapClaude");
  const tk = await import("@/lib/llm/taiKhoanClaude");
  const cli = await import("@/lib/llm/claudeCli");

  // 0. Chưa đăng nhập
  kiem("chưa đăng nhập: không có file", !tk.coDangNhap());
  kiem("chưa đăng nhập: thuMucChay là undefined", tk.thuMucChay() === undefined);
  kiem("chưa đăng nhập: gọi hỏi KHÔNG ép CLAUDE_CONFIG_DIR", cli.moiTruongCon().CLAUDE_CONFIG_DIR === undefined);

  // 1. Mã quá ngắn bị chặn trước khi chạm vào CLI
  kiem("chuanHoaMa chặn mã ngắn", dn.chuanHoaMa("abc") === null);
  kiem("chuanHoaMa chặn ký tự lạ ($;|)", dn.chuanHoaMa("abcdefghij$(rm -rf)") === null);
  kiem("chuanHoaMa bỏ khoảng trắng", dn.chuanHoaMa("  MA-DUNG\n-1234567890 ") === "MA-DUNG-1234567890");

  // 2. Dán mã khi chưa có lượt nào
  const som = await dn.guiMa("MA-DUNG-1234567890");
  kiem("dán mã khi chưa lấy link: báo hết hạn", !som.ok && /hết hạn/.test(som.message), som);

  // 3. Lấy link
  const l = await dn.moDangNhap();
  kiem("lấy được link", l.ok && l.url.startsWith("https://claude.ai/oauth/authorize?"), l);
  const lenhLogin = doc().find((d) => d.a[0] === "auth" && d.a[1] === "login");
  kiem("lệnh là `auth login --claudeai`", lenhLogin?.a.join(" ") === "auth login --claudeai", lenhLogin);
  kiem("CLAUDE_CONFIG_DIR = ~/.am/claude-tk", lenhLogin?.dir === path.join(nha, ".am", "claude-tk"), lenhLogin?.dir);
  kiem("BROWSER là lệnh rỗng (máy chủ không tự bật trình duyệt)", lenhLogin?.browser === "true", lenhLogin?.browser);
  kiem("khoá API bị gỡ khỏi môi trường con", lenhLogin?.coKhoaApi === false);
  kiem("tiến trình đăng nhập vẫn sống chờ mã", conSong("am-thu-dn-.*claude auth login"));

  // 4. Mã sai
  const sai = await dn.guiMa("MA-SAI-0000000000");
  kiem("mã sai: báo không đúng/quá hạn", !sai.ok && /không đúng|quá hạn/.test(sai.message), sai);
  kiem("mã sai: không có file đăng nhập", !tk.coDangNhap());
  const lai = await dn.guiMa("MA-DUNG-1234567890");
  kiem("sau mã sai, lượt cũ đã đóng: dán lại báo hết hạn", !lai.ok && /hết hạn/.test(lai.message), lai);

  // 5. Huỷ giữa chừng thì tiến trình chết
  const l2 = await dn.moDangNhap();
  kiem("lấy link lần hai", l2.ok);
  dn.huyDangNhap();
  await new Promise((r) => setTimeout(r, 400));
  kiem("huỷ: tiến trình đăng nhập đã chết", !conSong("am-thu-dn-.*claude auth login"));

  // 6. Mã đúng
  const l3 = await dn.moDangNhap();
  kiem("lấy link lần ba", l3.ok);
  const dung = await dn.guiMa("MA-DUNG-1234567890");
  kiem("mã đúng: thành công", dung.ok, dung);
  kiem("mã đúng: có file đăng nhập", tk.coDangNhap());
  kiem("đã đăng nhập: thuMucChay trả thư mục riêng", tk.thuMucChay() === path.join(nha, ".am", "claude-tk"));
  kiem("đã đăng nhập: gọi hỏi tự ép CLAUDE_CONFIG_DIR", cli.moiTruongCon().CLAUDE_CONFIG_DIR === path.join(nha, ".am", "claude-tk"));

  // 7. Trạng thái
  const tt = await dn.docTrangThai();
  kiem("trạng thái: đã cài, đã đăng nhập, đúng email/gói", tt.daCaiCli && tt.daDangNhap && tt.email === "chu@vi-du.test" && tt.goi === "max" && tt.dungTaiKhoanRieng, tt);
  kiem("trạng thái: lẫn chữ nhiễu trước JSON vẫn đọc được", tt.phienBan === "9.9.9 (Claude Code gia)", tt.phienBan);

  // 8. Đăng xuất
  kiem("đăng xuất: xoá file", tk.dangXuat() && !tk.coDangNhap());
  const tt2 = await dn.docTrangThai();
  kiem("sau đăng xuất: trạng thái là chưa đăng nhập", tt2.daCaiCli && !tt2.daDangNhap && !tt2.dungTaiKhoanRieng, tt2);
  kiem("đăng xuất lần hai: báo không có gì để xoá", tk.dangXuat() === false);

  // 9. Không có CLI
  process.env.CLAUDE_CLI_PATH = path.join(nha, "khong-co-claude");
  // timClaudeCli nhớ kết quả cũ trong module; không cần thử lại ở đây

  fs.rmSync(nha, { recursive: true, force: true });
  console.log(loi === 0 ? "\nTất cả ĐẠT." : `\n${loi} mục HỎNG.`);
  process.exit(loi === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
