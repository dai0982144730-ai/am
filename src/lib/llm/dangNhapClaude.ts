/**
 * Đăng nhập Claude từ trang Vận hành, không cần mở terminal.
 *
 * Am không tự làm OAuth. Máy chủ chạy `claude auth login --claudeai` và nói
 * chuyện với nó qua đầu vào/đầu ra chuẩn:
 *
 *   ① Bấm "Đăng nhập Claude": máy chủ chạy lệnh, bắt đường link CLI in ra.
 *   ② Mở link, đăng nhập Claude trên máy hoặc điện thoại. Trang Claude hiện mã.
 *   ③ Dán mã vào ô: máy chủ ghi mã vào đầu vào của CLI đang chờ, CLI tự lưu
 *      thông tin đăng nhập vào `~/.am/claude-tk`.
 *
 * Tiến trình CLI phải SỐNG QUA hai lần bấm (①→③), nên cách này cần máy chủ Node
 * chạy liên tục (máy nhà, VPS). Hosting kiểu serverless thì không dùng được.
 *
 * Viết lại từ app agent SCI (đã chạy thật trên Windows với nhiều tài khoản),
 * rút cho một người dùng và dùng lại phần chạy CLI của `claudeCli.ts`.
 */

import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  chuanBiLenhCli,
  gietCaCay,
  LoiClaudeCli,
  moiTruongCon,
} from "@/lib/llm/claudeCli";
import { thuMucTaiKhoan, thuMucChay } from "@/lib/llm/taiKhoanClaude";

interface LuotCho {
  con: ChildProcess;
  thuMuc: string;
  ra: string;
  loi: string;
  thoat: Promise<number | null>;
  hen: ReturnType<typeof setTimeout>;
}

// Giữ trên `globalThis` để sống qua việc nạp lại module của `next dev`
type ToanCuc = typeof globalThis & { __amDangNhapClaude?: LuotCho | null };
const luotDangCho = (): LuotCho | null =>
  (globalThis as ToanCuc).__amDangNhapClaude ?? null;
const datLuot = (l: LuotCho | null) => {
  (globalThis as ToanCuc).__amDangNhapClaude = l;
};

/** Link dùng được 15 phút; quá hạn thì tự tắt tiến trình đang chờ. */
const HAN_CHO_MA_MS = 15 * 60_000;
const CHO_LINK_MS = 30_000;
const CHO_XAC_NHAN_MS = 60_000;
const RE_LINK = /https:\/\/\S+\/oauth\/authorize\?\S+/;

const boMauChu = (s: string) => s.replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, "");

/**
 * Lệnh rỗng cho biến BROWSER: CLI tưởng đã "mở trình duyệt" nhưng máy chủ không
 * bật gì cả. Link được đưa về giao diện để người dùng tự mở trên máy mình.
 */
function lenhTrinhDuyetRong(): string {
  if (process.platform !== "win32") return "true";
  const tep = path.join(os.tmpdir(), "am-trinh-duyet-rong.cmd");
  try {
    if (!fs.existsSync(tep)) fs.writeFileSync(tep, "@exit /b 0\r\n");
  } catch {
    // Không ghi được thì máy chủ bật thừa một tab: không hại gì
  }
  return tep;
}

/**
 * Chuẩn hoá mã người dùng dán: bỏ khoảng trắng, chỉ nhận ký tự có thể có trong
 * mã. Mã chỉ đi qua đầu vào chuẩn, không bao giờ vào dòng lệnh.
 */
export function chuanHoaMa(tho: unknown): string | null {
  const s = String(tho ?? "").replace(/\s+/g, "");
  return /^[A-Za-z0-9_\-.~#=%/+]{10,2000}$/.test(s) ? s : null;
}

/** Lý do hỏng viết tiếng Việt; câu gốc tiếng Anh của CLI chỉ ghi vào nhật ký máy chủ. */
function lyDoTiengViet(goc: string): string {
  const s = goc.trim();
  if (s) console.warn(`[đăng nhập Claude] ${s.slice(0, 500)}`);
  if (/ENOTFOUND|ECONNREFUSED|ECONNRESET|ETIMEDOUT|EAI_AGAIN|fetch failed|getaddrinfo|network/i.test(s)) {
    return "máy chủ không kết nối được tới Claude (mạng)";
  }
  if (/status code 5\d\d/i.test(s)) return "máy chủ của Claude đang lỗi";
  if (/status code 4\d\d/i.test(s)) return "Claude từ chối yêu cầu đăng nhập";
  return s ? "chi tiết kỹ thuật ở nhật ký máy chủ" : "";
}

/** Tắt lượt đăng nhập đang chờ (Huỷ, bấm lại, hết 15 phút). */
export function huyDangNhap(): void {
  const l = luotDangCho();
  if (!l) return;
  datLuot(null);
  clearTimeout(l.hen);
  gietCaCay(l.con);
}

export type KetQuaLink =
  | { ok: true; url: string }
  | { ok: false; message: string };

/**
 * Bước ①: chạy `claude auth login`, trả về link đăng nhập. CLI vẫn chạy tiếp,
 * chờ mã ở bước ③.
 */
export async function moDangNhap(): Promise<KetQuaLink> {
  huyDangNhap();

  let lenh: { chayBang: string; thamSoDau: string[] };
  try {
    lenh = chuanBiLenhCli();
  } catch (e) {
    return { ok: false, message: e instanceof LoiClaudeCli ? e.message : "Không chạy được Claude CLI." };
  }

  const thuMuc = thuMucTaiKhoan();
  try {
    fs.mkdirSync(thuMuc, { recursive: true });
  } catch {
    return { ok: false, message: "Không tạo được thư mục đăng nhập trên máy chủ." };
  }

  const moiTruong = moiTruongCon(thuMuc);
  moiTruong.BROWSER = lenhTrinhDuyetRong();
  // Token dài hạn đặt sẵn trong môi trường sẽ lấn file đăng nhập mới
  delete moiTruong.CLAUDE_CODE_OAUTH_TOKEN;

  let con: ChildProcess;
  try {
    con = spawn(
      lenh.chayBang,
      [...lenh.thamSoDau, "auth", "login", "--claudeai"],
      { windowsHide: true, stdio: ["pipe", "pipe", "pipe"], env: moiTruong, cwd: thuMuc },
    );
  } catch (e) {
    const ly = lyDoTiengViet(e instanceof Error ? e.message : String(e));
    return { ok: false, message: `Không chạy được Claude CLI trên máy chủ${ly ? ` — ${ly}` : ""}.` };
  }

  const luot: LuotCho = {
    con,
    thuMuc,
    ra: "",
    loi: "",
    thoat: new Promise((xong) => {
      con.on("exit", (ma) => xong(ma));
      con.on("error", () => xong(null));
    }),
    hen: setTimeout(() => {
      if (luotDangCho() === luot) datLuot(null);
      gietCaCay(con);
    }, HAN_CHO_MA_MS),
  };
  con.on("exit", () => {
    clearTimeout(luot.hen);
    if (luotDangCho() === luot) datLuot(null);
  });
  // Lỗi ghi vào đầu vào (EPIPE) đến bất đồng bộ; không bắt thì sập cả máy chủ
  con.stdin?.on("error", () => {});
  con.stdout?.on("data", (m: Buffer) => (luot.ra += m.toString("utf8")));
  con.stderr?.on("data", (m: Buffer) => (luot.loi += m.toString("utf8")));
  datLuot(luot);

  const url = await new Promise<string | null>((xong) => {
    const batDau = Date.now();
    const kiem = setInterval(() => {
      const khop = boMauChu(luot.ra).match(RE_LINK);
      if (khop) {
        clearInterval(kiem);
        xong(khop[0]);
      } else if (con.exitCode !== null || con.killed || Date.now() - batDau > CHO_LINK_MS) {
        clearInterval(kiem);
        xong(null);
      }
    }, 100);
  });

  if (!url) {
    const ly = lyDoTiengViet(boMauChu(luot.loi || luot.ra));
    huyDangNhap();
    return {
      ok: false,
      message: `Claude CLI không đưa ra link đăng nhập${ly ? ` — ${ly}` : ""}. Thử lại sau ít phút.`,
    };
  }
  return { ok: true, url };
}

/**
 * Bước ③: chuyển mã cho CLI đang chờ rồi đợi xác nhận. Thành công khi CLI thoát
 * bình thường VÀ đã có file đăng nhập.
 */
export async function guiMa(ma: string): Promise<{ ok: boolean; message: string }> {
  const luot = luotDangCho();
  if (!luot || luot.con.exitCode !== null) {
    huyDangNhap();
    return { ok: false, message: "Lượt đăng nhập này đã hết hạn. Bấm Đăng nhập Claude để lấy link mới." };
  }

  try {
    luot.con.stdin?.write(ma + "\n");
  } catch {
    huyDangNhap();
    return { ok: false, message: "Không chuyển được mã cho Claude CLI. Bấm Đăng nhập Claude để thử lại." };
  }

  const ketQua = await Promise.race([
    luot.thoat,
    new Promise<"het">((xong) => setTimeout(() => xong("het"), CHO_XAC_NHAN_MS)),
  ]);
  if (luotDangCho() === luot) datLuot(null);
  clearTimeout(luot.hen);

  if (ketQua === "het") {
    gietCaCay(luot.con);
    return { ok: false, message: "Claude chưa xác nhận mã sau 60 giây. Bấm Đăng nhập Claude để thử lại." };
  }
  if (ketQua === 0 && thuMucChay() !== undefined) return { ok: true, message: "Đã đăng nhập." };

  const goc = boMauChu(`${luot.loi}\n${luot.ra}`);
  if (/status code 400|invalid_grant|invalid.*code/i.test(goc)) {
    return {
      ok: false,
      message:
        "Mã không đúng hoặc đã quá hạn (mỗi mã chỉ dùng một lần, trong vài phút). Bấm Đăng nhập Claude để lấy link mới rồi dán mã mới.",
    };
  }
  const dong = goc
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter((x) => x && !/^https?:|Paste code|Opening browser|If the browser/i.test(x));
  const ly = lyDoTiengViet(dong.join(" "));
  return {
    ok: false,
    message: `Đăng nhập không thành công${ly ? ` — ${ly}` : ""}. Bấm Đăng nhập Claude để thử lại.`,
  };
}

// ---------------------------------------------------------------------------
// Kiểm tra trạng thái
// ---------------------------------------------------------------------------

export interface TrangThaiClaude {
  daCaiCli: boolean;
  phienBan?: string;
  daDangNhap: boolean;
  email?: string;
  goi?: string;
  /** true = đang dùng đăng nhập riêng của Am; false = tài khoản mặc định của máy */
  dungTaiKhoanRieng: boolean;
}

/** Chạy một lệnh ngắn của CLI, trả về đầu ra. Ném lỗi khi hết giờ hoặc không chạy được. */
function chayNgan(
  thamSo: string[],
  hanMs: number,
): Promise<{ ma: number | null; ra: string }> {
  const { chayBang, thamSoDau } = chuanBiLenhCli();
  return new Promise((xong, hong) => {
    const con = spawn(chayBang, [...thamSoDau, ...thamSo], {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
      env: moiTruongCon(),
    });
    let ra = "";
    const hetGio = setTimeout(() => {
      gietCaCay(con);
      hong(new Error("hết giờ"));
    }, hanMs);
    con.stdout?.on("data", (m: Buffer) => (ra += m.toString("utf8")));
    con.on("error", (e) => {
      clearTimeout(hetGio);
      hong(e);
    });
    con.on("close", (ma) => {
      clearTimeout(hetGio);
      xong({ ma, ra });
    });
  });
}

/**
 * Hỏi CLI xem đã đăng nhập chưa.
 *
 * LƯU Ý (đo bên app SCI): lệnh này chỉ nhìn file đăng nhập, KHÔNG kiểm mã còn
 * hiệu lực. Mã hết hạn hay bị thu hồi vẫn báo "đã đăng nhập". Muốn chắc thì phải
 * hỏi thử một câu thật (nút "Thử trợ lý" ở trang Vận hành).
 */
export async function docTrangThai(): Promise<TrangThaiClaude> {
  const dungTaiKhoanRieng = thuMucChay() !== undefined;
  let phienBan: string | undefined;
  try {
    const v = await chayNgan(["--version"], 8_000);
    if (v.ma !== 0) return { daCaiCli: false, daDangNhap: false, dungTaiKhoanRieng };
    phienBan = v.ra.trim().split(/\r?\n/)[0] || undefined;
  } catch {
    return { daCaiCli: false, daDangNhap: false, dungTaiKhoanRieng };
  }

  try {
    const s = await chayNgan(["auth", "status", "--json"], 15_000);
    if (s.ma !== 0) return { daCaiCli: true, phienBan, daDangNhap: false, dungTaiKhoanRieng };
    const khop = s.ra.match(/\{[\s\S]*\}/);
    if (!khop) return { daCaiCli: true, phienBan, daDangNhap: false, dungTaiKhoanRieng };
    const j = JSON.parse(khop[0]) as Record<string, unknown>;
    const chu = (v: unknown) => (typeof v === "string" && v !== "" ? v : undefined);
    return {
      daCaiCli: true,
      phienBan,
      daDangNhap: j.loggedIn === true,
      email: chu(j.email),
      goi: chu(j.subscriptionType),
      dungTaiKhoanRieng,
    };
  } catch {
    return { daCaiCli: true, phienBan, daDangNhap: false, dungTaiKhoanRieng };
  }
}
