/**
 * Gọi Claude qua Claude Code CLI đã cài trên máy, thay vì qua khoá API.
 *
 * VÌ SAO: gói Claude Pro/Max trả tiền theo tháng, dùng bao nhiêu cũng vậy. Còn
 * khoá API tính tiền theo từng nghìn chữ. Với việc phải đọc cả nghìn video mỗi
 * ngày, đi đường CLI là tiết kiệm hẳn một khoản.
 *
 * CÁCH LÀM: chạy lệnh `claude --print` ở chế độ không tương tác, đẩy câu hỏi vào
 * qua đầu vào chuẩn, đọc câu trả lời ra dạng JSON. Không gọi REST API, không cần
 * khoá. Quyền đăng nhập lấy từ lần `claude` đăng nhập sẵn trên máy.
 *
 * BỐN CỜ QUAN TRỌNG — đo thật ngày 2026-08-14, mỗi lần gọi:
 *
 *   Cách thường (--append-system-prompt)        30.087 chữ
 *   Thay hẳn lời dặn (--system-prompt)          23.689 chữ
 *   Thêm tắt hết công cụ (--tools "")            1.817 chữ  ← rẻ hơn 94%
 *
 * Sở dĩ chênh nhiều như vậy vì Claude Code vốn là trợ lý lập trình: mỗi lần chạy
 * nó nạp sẵn bản mô tả mấy chục công cụ (đọc file, chạy lệnh, tìm kiếm…). Việc
 * ở đây chỉ là đọc hiểu và xếp nhóm, không cần công cụ nào, nên tắt hết đi.
 *
 * CÁCH NÀY HỌC TỪ ĐÂU: dự án `phaply` (Web Pháp lý) của cùng chủ dự án đã chạy
 * thật theo hướng này — xem `phaply/lib/claude-cli.ts`. Bản ở đây bỏ bớt phần
 * quản lý đăng nhập trong giao diện (chưa cần), và thêm bốn cờ tiết kiệm ở trên
 * mà bản gốc chưa có.
 */

import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/** Chờ tối đa một lần gọi. Video dài, lời thoại nhiều, nên để rộng. */
const HAN_CHO_MS = Number(process.env.CLAUDE_CLI_TIMEOUT_MS) || 180_000;

/** Lỗi khi không gọi được Claude CLI. */
export class LoiClaudeCli extends Error {
  constructor(thongDiep: string) {
    super(thongDiep);
    this.name = "LoiClaudeCli";
  }
}

let duongDanDaTim: string | null | undefined;

/**
 * Tìm chỗ cài Claude CLI.
 *
 * Ưu tiên file `.exe` thật thay vì file `.cmd` bọc ngoài: gọi thẳng `.exe` thì
 * không phải nhờ tới cửa sổ lệnh của Windows, nhờ vậy tham số chứa dấu ngoặc
 * kép hay chuỗi rỗng không bị hiểu sai.
 */
export function timClaudeCli(): string | null {
  if (duongDanDaTim !== undefined) return duongDanDaTim;

  const khai = process.env.CLAUDE_CLI_PATH;
  if (khai && fs.existsSync(khai)) {
    duongDanDaTim = khai;
    return duongDanDaTim;
  }

  const nha = os.homedir();
  const cacCho = [
    // File thật do npm cài — ưu tiên cao nhất
    path.join(
      process.env.APPDATA ?? path.join(nha, "AppData", "Roaming"),
      "npm",
      "node_modules",
      "@anthropic-ai",
      "claude-code",
      "bin",
      "claude.exe",
    ),
    path.join(nha, ".local", "bin", "claude.exe"),
    path.join(nha, ".claude", "local", "claude.exe"),
    // Bản bọc ngoài — dùng khi không thấy file thật
    path.join(
      process.env.APPDATA ?? path.join(nha, "AppData", "Roaming"),
      "npm",
      "claude.cmd",
    ),
    // Linux, macOS
    path.join(nha, ".local", "bin", "claude"),
    "/usr/local/bin/claude",
  ];

  duongDanDaTim = cacCho.find((cho) => fs.existsSync(cho)) ?? null;
  return duongDanDaTim;
}

/** File `.cmd`/`.bat` phải nhờ cửa sổ lệnh của Windows mới chạy được. */
function canCuaSoLenh(duongDan: string): boolean {
  return /\.(cmd|bat)$/i.test(duongDan);
}

/**
 * Biến môi trường cho tiến trình con.
 *
 * Phải xoá mấy biến đánh dấu phiên Claude Code, vì rất có thể chính công cụ này
 * đang được chạy từ bên trong một phiên Claude Code khác — để nguyên thì tiến
 * trình con tưởng mình là phiên cha và chạy sai.
 */
function moiTruongCon(): NodeJS.ProcessEnv {
  const moiTruong: NodeJS.ProcessEnv = {
    ...process.env,
    // Việc ở đây không cần suy nghĩ sâu, tắt đi cho nhanh và đỡ tốn
    MAX_THINKING_TOKENS: "0",
  };

  delete moiTruong.CLAUDECODE;
  delete moiTruong.CLAUDE_CODE_ENTRYPOINT;
  delete moiTruong.CLAUDE_CODE_SSE_PORT;
  delete moiTruong.ELECTRON_RUN_AS_NODE;

  // BẮT BUỘC xoá khoá API. Claude CLI thấy có khoá là dùng khoá đó, bỏ qua tài
  // khoản Claude Pro đã đăng nhập — đúng cái ta đang tránh, vì khoá API tính
  // tiền theo từng nghìn chữ còn gói Pro trả theo tháng.
  //
  // Đã vấp thật ngày 2026-08-14: `.env` còn để `ANTHROPIC_API_KEY="sk-ant-..."`
  // (giá trị mẫu). CLI ưu tiên nó, gọi bằng khoá giả, và treo im lặng 180 giây
  // rồi mới báo lỗi. Thông báo thật nằm trong stderr: "connectors are disabled
  // because ANTHROPIC_API_KEY ... takes precedence over your claude.ai login".
  delete moiTruong.ANTHROPIC_API_KEY;
  delete moiTruong.ANTHROPIC_AUTH_TOKEN;

  return moiTruong;
}

/**
 * Giết hẳn tiến trình con, kể cả đàn cháu của nó.
 *
 * `child.kill()` của Node trên Windows chỉ giết đúng tiến trình gốc, để lại các
 * tiến trình con chạy tiếp. **Đã vấp thật ngày 2026-08-14**: sau vài lần hết
 * giờ, máy còn sáu tiến trình `claude.exe` mồ côi, mỗi cái ngốn vài trăm MB.
 * Từ đó mọi lần gọi mới đều treo — mất khá lâu mới nhận ra thủ phạm không phải
 * câu lệnh sai mà là máy đã nghẽn. Dọn sạch chúng đi là chạy lại bình thường.
 */
function gietCaCay(con: ReturnType<typeof spawn>): void {
  try {
    if (process.platform === "win32" && con.pid) {
      spawn("taskkill", ["/pid", String(con.pid), "/T", "/F"], {
        windowsHide: true,
        stdio: "ignore",
      });
    } else {
      con.kill("SIGTERM");
    }
  } catch {
    // Tiến trình có thể đã tự chết — không sao
  }
}

/**
 * Xếp hàng: mỗi lúc chỉ cho một tiến trình `claude` chạy.
 *
 * Bắn một lúc mấy chục tiến trình vừa nặng máy vừa dễ bị chặn vì gọi quá nhanh.
 */
let hangDoi: Promise<void> = Promise.resolve();

function xepHang<T>(viec: () => Promise<T>): Promise<T> {
  const ketQua = hangDoi.then(viec, viec);
  hangDoi = ketQua.then(
    () => undefined,
    () => undefined,
  );
  return ketQua;
}

export interface ThongTinDung {
  tokenVao: number;
  tokenRa: number;
  tokenTaoCache: number;
  tokenDocCache: number;
}

export interface KetQuaGoiCli {
  vanBan: string;
  dung: ThongTinDung;
}

interface PhanHoiCli {
  type?: string;
  subtype?: string;
  is_error?: boolean;
  result?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
}

export interface TuyChonGoiCli {
  /** Lời dặn đặt trước, THAY HẲN lời dặn mặc định của Claude Code. */
  loiDan: string;
  /** Câu hỏi, đẩy vào qua đầu vào chuẩn nên dài bao nhiêu cũng được. */
  cauHoi: string;
  model?: string;
}

/** Gọi Claude một lần rồi trả về câu trả lời dạng chữ. */
export function goiClaudeCli(
  tuyChon: TuyChonGoiCli,
): Promise<KetQuaGoiCli> {
  return xepHang(() => goiThat(tuyChon));
}

function goiThat(tuyChon: TuyChonGoiCli): Promise<KetQuaGoiCli> {
  const duongDan = timClaudeCli();
  if (!duongDan) {
    throw new LoiClaudeCli(
      "Không tìm thấy Claude CLI trên máy.\n" +
        "Cài bằng: npm install -g @anthropic-ai/claude-code\n" +
        "Rồi đăng nhập một lần bằng: claude\n" +
        "Hoặc khai đường dẫn vào CLAUDE_CLI_PATH trong .env.",
    );
  }

  const dungCuaSoLenh = canCuaSoLenh(duongDan);

  const thamSo = [
    "--print",
    "--output-format",
    "json",
    "--system-prompt",
    tuyChon.loiDan,
    // Tắt hết công cụ — chỗ tiết kiệm lớn nhất, xem phần đầu file
    "--tools",
    "",
    // Không nạp máy chủ công cụ ngoài, không lưu lại phiên
    "--strict-mcp-config",
    "--no-session-persistence",
  ];

  if (tuyChon.model) thamSo.push("--model", tuyChon.model);

  return new Promise<KetQuaGoiCli>((xong, hong) => {
    const con = spawn(dungCuaSoLenh ? `"${duongDan}"` : duongDan, thamSo, {
      stdio: ["pipe", "pipe", "pipe"],
      shell: dungCuaSoLenh,
      windowsHide: true,
      env: moiTruongCon(),
    });

    let raChuan = "";
    let raLoi = "";
    let daXong = false;

    const hetGio = setTimeout(() => {
      if (daXong) return;
      daXong = true;
      gietCaCay(con);
      hong(
        new LoiClaudeCli(
          `Claude CLI không trả lời sau ${Math.round(HAN_CHO_MS / 1000)} giây.`,
        ),
      );
    }, HAN_CHO_MS);

    con.stdout.on("data", (mieng: Buffer) => {
      raChuan += mieng.toString("utf8");
    });
    con.stderr.on("data", (mieng: Buffer) => {
      raLoi += mieng.toString("utf8");
    });

    con.on("error", (loi) => {
      if (daXong) return;
      daXong = true;
      clearTimeout(hetGio);
      hong(new LoiClaudeCli(`Không chạy được Claude CLI: ${loi.message}`));
    });

    con.on("close", (ma) => {
      if (daXong) return;
      daXong = true;
      clearTimeout(hetGio);

      let phanHoi: PhanHoiCli | null = null;
      try {
        phanHoi = JSON.parse(raChuan) as PhanHoiCli;
      } catch {
        // Rơi xuống phần báo lỗi bên dưới
      }

      if (!phanHoi) {
        return hong(
          new LoiClaudeCli(
            `Claude CLI trả về thứ không đọc được (mã thoát ${ma}).\n` +
              `Đầu ra: ${raChuan.slice(0, 300)}\n` +
              (raLoi ? `Lỗi: ${raLoi.slice(0, 300)}` : ""),
          ),
        );
      }

      if (phanHoi.is_error || phanHoi.subtype === "error") {
        const thongDiep = phanHoi.result ?? "không rõ lý do";
        return hong(
          new LoiClaudeCli(
            /not logged in|authentication/i.test(thongDiep)
              ? "Chưa đăng nhập Claude trên máy. Mở terminal gõ `claude` rồi đăng nhập một lần."
              : `Claude CLI báo lỗi: ${thongDiep.slice(0, 300)}`,
          ),
        );
      }

      const dung = phanHoi.usage ?? {};
      xong({
        vanBan: phanHoi.result ?? "",
        dung: {
          tokenVao: dung.input_tokens ?? 0,
          tokenRa: dung.output_tokens ?? 0,
          tokenTaoCache: dung.cache_creation_input_tokens ?? 0,
          tokenDocCache: dung.cache_read_input_tokens ?? 0,
        },
      });
    });

    try {
      con.stdin.write(tuyChon.cauHoi);
      con.stdin.end();
    } catch {
      // Tiến trình đã chết trước khi kịp ghi — phần `close` ở trên sẽ báo lỗi
    }
  });
}

/** Máy này đã có Claude CLI chưa. Dùng để chọn đường gọi. */
export function coClaudeCli(): boolean {
  return timClaudeCli() !== null;
}
