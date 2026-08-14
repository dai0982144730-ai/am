/**
 * Nhờ Claude đọc nội dung rồi xếp vào đúng chuyên mục.
 *
 * HAI ĐƯỜNG GỌI, tự chọn:
 *
 *   1. **Qua Claude CLI trên máy** (mặc định) — dùng gói Claude Pro/Max trả tiền
 *      theo tháng. Không cần khoá API, không tính tiền theo từng nghìn chữ.
 *   2. **Qua khoá API** — dùng khi máy không có Claude CLI, hoặc khi khai
 *      `CACH_GOI_CLAUDE="api"` trong .env.
 *
 * Khác biệt đáng kể giữa hai đường: bản API có chế độ **bắt buộc trả lời theo
 * khuôn** — Claude không thể trả về thứ sai khuôn được. Bản CLI không có, nên
 * phải tự dặn trong lời nhắc rồi tự kiểm tra lại bằng đúng khuôn Zod đó. Kết quả
 * cuối cùng giống nhau, chỉ khác chỗ ai đứng ra bảo đảm.
 *
 * BA QUYẾT ĐỊNH VỀ CHI PHÍ, vì đây là chỗ tốn nhất — mọi video quét về đều đi qua:
 *
 * 1. **Dùng Haiku, không dùng Sonnet.** Việc ở bước này là xếp nhóm và điền vài
 *    trường, không phải phân tích sâu. Sonnet để dành cho bước chấm chất lượng
 *    (Phase 4), khi chỉ còn vài chục ứng viên đứng đầu.
 * 2. **Cắt bớt lời thoại.** Để biết một video thuộc chuyên mục nào thì mấy nghìn
 *    chữ đầu là đủ; gửi cả bản 160.000 chữ chỉ tốn công vô ích.
 * 3. **Bên đường API còn ghi nhớ tạm phần lời dặn** giữa các lần gọi. Bên CLI
 *    thì việc tắt hết công cụ đã tiết kiệm sẵn 94% (xem `claudeCli.ts`).
 */

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import * as z from "zod/v4";

import { coClaudeCli, goiClaudeCli } from "./claudeCli";
import { KhungPhanLoai, type KetQuaPhanLoai } from "./khungPhanLoai";

/**
 * Model mặc định, khác nhau theo đường gọi — và đây là kết luận từ đo thật,
 * không phải phỏng đoán (2026-08-14, tám video, xem `scripts/so-sanh-model.ts`):
 *
 * | | Haiku 4.5 | Sonnet 5 |
 * |---|---|---|
 * | Bốn video dễ (đều nhóm "khác") | đúng 4/4 | đúng 4/4 |
 * | Bốn video khó (triết học, giảng pháp) | **sai khuôn 2/4** | đúng 4/4 |
 * | Thời gian mỗi video | ~9 giây | ~12 giây |
 *
 * Haiku hỏng đúng chỗ cần nhất: với bài giảng Phật pháp, nó điền trường riêng
 * của nhóm AI vào, dù lời dặn đã ghi rõ "trường không thuộc chuyên mục thì để
 * trống". Nhận xét chất lượng của Sonnet cũng sắc hơn hẳn — nó nhận ra được
 * "không sa vào kiểu trích dẫn khắc kỷ sáo rỗng thường thấy trên mạng", đúng
 * loại phân biệt tinh tế mà bản thiết kế đặt ra.
 *
 * Nên:
 *   - Đi đường CLI (gói tháng, không tính tiền theo chữ) → **Sonnet**, vì dùng
 *     model mạnh hơn không tốn thêm đồng nào.
 *   - Đi đường khoá API (tính tiền theo chữ) → **Haiku**, rẻ hơn ba lần; chấp
 *     nhận thỉnh thoảng sai khuôn, đã có cơ chế thử lại.
 */
const MODEL_THEO_DUONG: Record<CachGoi, string> = {
  cli: "claude-sonnet-5",
  api: "claude-haiku-4-5",
};

/** Số chữ lời thoại gửi cho Claude. Đủ để biết chuyên mục. */
const TOI_DA_CHU_LOI_THOAI = 4_000;

/** Phiên bản hướng dẫn — đổi hướng dẫn thì tăng số này để biết bản ghi cũ mới. */
// v2 (2026-08-15): thêm chuyên mục khoa_hoc
export const PHIEN_BAN_HUONG_DAN = "v2";

export type CachGoi = "cli" | "api";

/**
 * Hướng dẫn phân loại.
 *
 * Viết dài có chủ đích: mô tả rõ từng chuyên mục và từng cạm bẫy cho kết quả ổn
 * định hơn nhiều so với một câu chung chung.
 */
const HUONG_DAN = `Bạn giúp một người Việt sắp xếp nội dung họ quét về mỗi ngày từ YouTube.

Nhiệm vụ: đọc thông tin một video rồi xếp vào đúng chuyên mục và điền các trường liên quan.

## Các chuyên mục

**ai** — tin tức và hướng dẫn về trí tuệ nhân tạo: tin về các hãng AI, cách dùng
công cụ AI, kinh nghiệm viết code bằng AI, hệ thống AI cho doanh nghiệp.

**triet_hoc** — triết học, tâm lý học, và Phật giáo Nguyên thuỷ (Theravada).
Gồm giảng pháp, vấn đáp, hướng dẫn thực hành đời sống, phân tích học thuật.
Chủ nghĩa khắc kỷ (Stoic), chủ nghĩa hiện sinh, tâm lý học hiện đại đều vào đây.

**truyen** — truyện kể có cốt truyện: kinh dị, viễn tưởng, phiêu lưu mạo hiểm.
Người đọc kể lại một câu chuyện hư cấu. KHÔNG tính chuyện có thật, tin tức, hay
kể chuyện đời mình.

**music** — nhạc: nhạc tập thể thao theo nhịp, dance, piano, guitar rock, nhạc vàng.

**khoa_hoc** — khoa học và công nghệ **ứng dụng được vào đời sống thật**. Không
giới hạn lĩnh vực: vật lý, sinh học, y học, vật liệu, năng lượng, kỹ thuật, môi
trường, nông nghiệp, vũ trụ — miễn là nói được nó dùng vào việc gì.

Đây là chuyên mục **khó xếp nhất**, nên đọc kỹ ranh giới:

  - VÀO nhóm này: giải thích một nguyên lý rồi chỉ ra nó đang được dùng ở đâu;
    một công nghệ mới kèm việc nó thay đổi được chuyện gì; một nghiên cứu kèm
    hệ quả thực tế; hướng dẫn tự làm dựa trên nguyên lý khoa học.
  - KHÔNG vào nhóm này: lý thuyết thuần tuý không nói tới ứng dụng (bài giảng
    về hình học đại số, video về nghịch lý lượng tử chỉ để gây tò mò); tin công
    nghệ tiêu dùng kiểu ra mắt điện thoại mới; review sản phẩm; tin giật gân về
    khoa học không có nội dung ("NASA vừa phát hiện điều gây sốc").

Câu hỏi để tự kiểm: **xem xong có biết thêm thứ gì dùng được không?** Nếu chỉ
biết thêm một sự thật thú vị thì đó là 'other', không phải 'khoa_hoc'.

Riêng nội dung về AI thì vẫn vào nhóm 'ai', không vào 'khoa_hoc' — dù AI cũng là
công nghệ. Người dùng theo dõi AI riêng và kỹ hơn.

**other** — mọi thứ còn lại. Đây là lựa chọn ĐÚNG cho phần lớn nội dung: tin thời
sự, chính trị, giải trí, hài, thể thao, ẩm thực, du lịch, công nghệ tiêu dùng,
sức khoẻ thường thức, dạy nấu ăn, review sản phẩm, vlog đời thường.

## Nguyên tắc quan trọng nhất

**Đừng cố nhét vào năm nhóm đầu.** Người dùng cần năm nhóm đó thật tinh, thà bỏ
sót còn hơn lẫn tạp. Một video tin tức nhắc thoáng qua chữ "AI" thì vẫn là
'other', không phải 'ai'. Một video kể chuyện ma có thật thì là 'other', không
phải 'truyen'. Một video khoa học chỉ kể sự thật thú vị mà không chỉ ra dùng
được vào đâu thì vẫn là 'other', không phải 'khoa_hoc'. Chỉ xếp vào năm nhóm đầu
khi nội dung CHÍNH thuộc về nhóm đó.

## Cạm bẫy

- **Đừng đoán số nhịp (BPM)**: chỉ điền khi tiêu đề hoặc mô tả ghi rõ con số.
  Nghe nhạc qua chữ là không thể.
- **Đừng nhầm tên kênh với tên tác giả**: trường tên tác giả dành cho nhà văn,
  giảng sư, diễn giả được nêu trong nội dung — không phải tên kênh đăng video.
- **Cẩn thận với truyện do AI viết**: dấu hiệu là văn phong đều đều không giọng
  riêng, tình tiết rập khuôn, nhân vật mỏng, mô tả thừa, không rõ tác giả.
- **Mê tín khác với giảng pháp**: bàn về nghiệp, luân hồi, vô thường theo kinh
  điển là giảng pháp bình thường. Chỉ gắn cờ mê tín khi cổ vũ bói toán, thần
  thông, bùa chú, hoặc bán vật phẩm hứa đổi vận.
- **Trường không thuộc chuyên mục thì để trống**: video nhóm 'ai' thì mọi trường
  của truyện, nhạc, triết học đều để null.
- **Không chắc thì để trống**, đừng đoán bừa.

Nhận xét chất lượng viết bằng tiếng Việt, ngắn gọn, nói thẳng vào cái đáng xem
hoặc cái dở của nội dung này.`;

/**
 * Phần dặn thêm chỉ dùng cho đường CLI.
 *
 * Bên API, khuôn trả lời do máy chủ bắt buộc nên không cần dặn. Bên CLI thì phải
 * nói rõ, kèm nguyên bản mô tả khuôn để Claude biết từng trường tên gì kiểu gì.
 */
function dinhKemKhuon(): string {
  const khuon = JSON.stringify(z.toJSONSchema(KhungPhanLoai), null, 1);
  return `\n\n## Cách trả lời

Trả lời DUY NHẤT một object JSON hợp lệ theo đúng khuôn dưới đây. Không viết gì
thêm trước hay sau nó. Không bọc trong dấu \`\`\`. Không giải thích.

Mọi trường trong "required" đều phải có mặt; trường nào không áp dụng thì điền null.

Khuôn:
${khuon}`;
}

let khachHang: Anthropic | null = null;

function layKhachHangApi(): Anthropic {
  const khoa = process.env.ANTHROPIC_API_KEY?.trim();

  if (!khoa || khoa === "sk-ant-..." || !khoa.startsWith("sk-ant-")) {
    throw new Error(
      "Chưa có ANTHROPIC_API_KEY thật trong .env " +
        `(hiện tại: ${khoa ? "giá trị mẫu" : "để trống"}).\n` +
        "Lấy tại https://console.anthropic.com → Settings → API Keys, " +
        "hoặc chuyển sang dùng Claude CLI bằng cách đặt CACH_GOI_CLAUDE=\"cli\".",
    );
  }

  khachHang ??= new Anthropic();
  return khachHang;
}

/**
 * Chọn đường gọi.
 *
 * Ưu tiên CLI vì rẻ hơn hẳn: gói tháng đã trả rồi, dùng thêm không mất thêm.
 * Chỉ quay sang khoá API khi máy không có Claude CLI.
 */
export function chonCachGoi(): CachGoi {
  const khai = process.env.CACH_GOI_CLAUDE?.trim().toLowerCase();
  if (khai === "api") return "api";
  if (khai === "cli") return "cli";
  return coClaudeCli() ? "cli" : "api";
}

export interface NoiDungCanPhanLoai {
  tieuDe: string;
  moTa?: string | null;
  tenKenh?: string | null;
  thoiLuongGiay?: number | null;
  loiThoai?: string | null;
}

export interface KetQuaGoiClaude {
  ketQua: KetQuaPhanLoai;
  cachGoi: CachGoi;
  modelDaDung: string;
  tokenVao: number;
  tokenRa: number;
  /** Số token đọc lại từ bộ nhớ tạm — càng cao càng rẻ */
  tokenNhoLai: number;
}

/** Gói thông tin một video thành đoạn văn bản gửi cho Claude. */
function soanNoiDung(noiDung: NoiDungCanPhanLoai): string {
  const phan: string[] = [`Tiêu đề: ${noiDung.tieuDe}`];

  if (noiDung.tenKenh) phan.push(`Kênh: ${noiDung.tenKenh}`);

  if (noiDung.thoiLuongGiay) {
    const phut = Math.round(noiDung.thoiLuongGiay / 60);
    phan.push(`Thời lượng: ${phut} phút`);
  }

  if (noiDung.moTa) {
    // Mô tả YouTube thường có một đoạn đầu hữu ích rồi tới hàng loạt link và
    // hashtag — phần đuôi đó không giúp gì cho việc phân loại
    phan.push(`Mô tả: ${noiDung.moTa.slice(0, 1_500)}`);
  }

  if (noiDung.loiThoai) {
    const catBot = noiDung.loiThoai.length > TOI_DA_CHU_LOI_THOAI;
    phan.push(
      `Lời thoại${catBot ? " (phần đầu)" : ""}: ` +
        noiDung.loiThoai.slice(0, TOI_DA_CHU_LOI_THOAI),
    );
  } else {
    phan.push("Lời thoại: (không lấy được — hãy dựa vào tiêu đề và mô tả)");
  }

  return phan.join("\n\n");
}

/**
 * Bóc lấy phần JSON trong câu trả lời.
 *
 * Dù đã dặn kỹ, mô hình vẫn thỉnh thoảng bọc JSON trong dấu ``` hoặc viết thêm
 * một câu dẫn. Cắt lấy từ dấu ngoặc nhọn đầu tiên tới dấu đóng cuối cùng.
 */
function bocJson(vanBan: string): string {
  const daBoRao = vanBan
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();

  const dau = daBoRao.indexOf("{");
  const cuoi = daBoRao.lastIndexOf("}");
  if (dau === -1 || cuoi === -1 || cuoi < dau) return daBoRao;

  return daBoRao.slice(dau, cuoi + 1);
}

/**
 * Gọi qua Claude CLI trên máy.
 *
 * Bên này không có ai bắt buộc khuôn trả lời, nên tự kiểm tra bằng đúng khuôn
 * Zod mà đường API dùng. Sai thì hỏi lại một lần, kèm chỉ rõ sai ở đâu — cách
 * này chữa được phần lớn trường hợp, vì mô hình thường chỉ nhầm một trường chứ
 * không hiểu sai cả bài.
 */
async function phanLoaiQuaCli(
  noiDung: NoiDungCanPhanLoai,
  model: string,
): Promise<KetQuaGoiClaude> {
  const loiDan = HUONG_DAN + dinhKemKhuon();
  const cauHoiGoc = soanNoiDung(noiDung);

  let tokenVao = 0;
  let tokenRa = 0;
  let tokenNhoLai = 0;
  let nhacLoi = "";

  for (let lan = 0; lan < 2; lan += 1) {
    const goi = await goiClaudeCli({
      loiDan,
      cauHoi: cauHoiGoc + nhacLoi,
      model,
    });

    tokenVao += goi.dung.tokenVao + goi.dung.tokenTaoCache;
    tokenRa += goi.dung.tokenRa;
    tokenNhoLai += goi.dung.tokenDocCache;

    let thoJson: unknown;
    try {
      thoJson = JSON.parse(bocJson(goi.vanBan));
    } catch {
      nhacLoi =
        "\n\nLần trước bạn trả lời không phải JSON hợp lệ. " +
        "Lần này chỉ trả về đúng một object JSON, không kèm gì khác.";
      continue;
    }

    const kiemTra = KhungPhanLoai.safeParse(thoJson);
    if (kiemTra.success) {
      return {
        ketQua: kiemTra.data,
        cachGoi: "cli",
        modelDaDung: model,
        tokenVao,
        tokenRa,
        tokenNhoLai,
      };
    }

    const loiDau = kiemTra.error.issues[0];
    const tenTruong = loiDau?.path.join(".") ?? "(không rõ)";

    if (lan === 1) {
      throw new Error(
        `Claude trả về JSON sai khuôn ở trường "${tenTruong}": ${loiDau?.message}`,
      );
    }

    nhacLoi =
      `\n\nLần trước bạn điền sai trường "${tenTruong}": ${loiDau?.message}. ` +
      "Nhớ rằng trường nào không thuộc chuyên mục của video này thì phải để null.";
  }

  // Không tới được đây — vòng lặp trên hoặc trả về hoặc ném lỗi
  throw new Error("Không phân loại được sau hai lần thử.");
}

/** Gọi qua khoá API. */
async function phanLoaiQuaApi(
  noiDung: NoiDungCanPhanLoai,
  model: string,
): Promise<KetQuaGoiClaude> {
  const phanHoi = await layKhachHangApi().messages.parse({
    model,
    max_tokens: 2_000,
    system: [
      {
        type: "text",
        text: HUONG_DAN,
        // Ghi nhớ tạm phần lời dặn: từ lần gọi thứ hai trở đi chỉ tốn khoảng
        // một phần mười so với đọc lại từ đầu
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: soanNoiDung(noiDung) }],
    output_config: { format: zodOutputFormat(KhungPhanLoai) },
  });

  if (!phanHoi.parsed_output) {
    throw new Error(
      `Claude trả lời không đúng khuôn (lý do dừng: ${phanHoi.stop_reason}).`,
    );
  }

  return {
    ketQua: phanHoi.parsed_output,
    cachGoi: "api",
    modelDaDung: phanHoi.model,
    tokenVao: phanHoi.usage.input_tokens,
    tokenRa: phanHoi.usage.output_tokens,
    tokenNhoLai: phanHoi.usage.cache_read_input_tokens ?? 0,
  };
}

/** Phân loại một nội dung, tự chọn đường gọi và model hợp với đường đó. */
export async function phanLoaiMotNoiDung(
  noiDung: NoiDungCanPhanLoai,
): Promise<KetQuaGoiClaude> {
  const cachGoi = chonCachGoi();
  const model =
    process.env.MODEL_PHAN_LOAI?.trim() || MODEL_THEO_DUONG[cachGoi];

  return cachGoi === "cli"
    ? await phanLoaiQuaCli(noiDung, model)
    : await phanLoaiQuaApi(noiDung, model);
}
