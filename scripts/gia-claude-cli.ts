/**
 * Claude CLI GIẢ dùng cho các bài kiểm (không đụng tài khoản thật).
 *
 * Làm đúng những gì CLI thật làm theo mô tả của app agent SCI:
 *   - `auth login --claudeai`: in "If the browser didn't open, visit: <link>", chờ
 *     một dòng mã ở đầu vào; mã `MA-DUNG-1234567890` thì ghi `.credentials.json`
 *     vào CLAUDE_CONFIG_DIR rồi thoát 0, mã khác in "status code 400" và thoát 1.
 *   - `auth status --json`: đọc xem có file đăng nhập không.
 *   - `--version`.
 * Mỗi lần chạy ghi một dòng JSON vào file chỉ bởi biến GHI_LOG.
 */
import fs from "node:fs";
import path from "node:path";

/** Tạo file `claude` giả trong `thuMuc`, trả về đường dẫn. */
export function taoGiaCli(thuMuc: string): string {
  const duongDan = path.join(thuMuc, "claude");
  fs.writeFileSync(
    duongDan,
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
  fs.chmodSync(duongDan, 0o755);
  return duongDan;
}
