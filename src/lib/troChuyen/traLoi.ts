/**
 * Phần trả lời cho khung trò chuyện.
 *
 * ## Vì sao không dùng lại `hoiTroLy` có sẵn
 *
 * `hoiTroLy` (Cổng API trợ lý, Phase 15) làm gần đúng việc này rồi, nhưng nó gọi
 * Claude **qua khoá API** — tính tiền theo từng nghìn chữ. Chủ dự án dùng gói
 * Claude Pro trả theo tháng, và mọi phần khác của dự án đã đi đường Claude CLI
 * để khỏi tốn thêm. Khung trò chuyện là chỗ gọi Claude nhiều nhất trong cả app
 * (mỗi câu hỏi một lần), nên để nó đi đường khoá API thì mỗi lần trò chuyện là
 * một lần trừ tiền thật.
 *
 * Còn `hoiTroLy` vẫn giữ nguyên cho app Android gọi vào — nó chạy trên máy chủ
 * xa, chỗ đó không có Claude CLI.
 *
 * ## Chỉ dựa vào kho, không trả lời bằng kiến thức chung
 *
 * Hỏi "Grok Bot là gì" mà nhận về một đoạn Wikipedia thì vô nghĩa — chủ nhà đã
 * có Google. Cái Am biết mà Google không biết là **trong kho của chủ nhà có gì**.
 * Nên khi không tìm được thì nói thẳng là kho chưa có, đừng suy đoán.
 *
 * ## Nhớ mạch câu chuyện
 *
 * Gửi kèm mấy lượt trao đổi gần nhất, để hỏi tiếp "còn cái nào nữa không" thì
 * Claude hiểu "cái nào" là cái gì. Chỉ giữ vài lượt gần nhất — gửi cả cuộc trò
 * chuyện thì lời dặn phình ra và câu trả lời cũng loãng đi.
 */

import { goiClaudeCli } from "@/lib/llm/claudeCli";
import { prisma } from "@/lib/db/prisma";

/** Số nội dung lấy ra cho Claude đọc. */
const SO_NOI_DUNG_DOC = 6;

/** Cắt bớt lời thoại: một video hai tiếng có thể dài hàng chục nghìn chữ. */
const DAI_TOI_DA_MOI_MUC = 4_000;

/** Số lượt trao đổi cũ gửi kèm để giữ mạch. */
const SO_LUOT_NHO = 6;

export interface LuotNoi {
  vaiTro: "nguoi" | "may";
  chu: string;
}

export interface NguonDanRa {
  id: string;
  tieuDe: string;
  kenh: string;
  diem: number | null;
}

export interface KetQuaTraLoi {
  traLoi: string;
  nguon: NguonDanRa[];
  /** Có gọi tới Claude thật không — dùng để hiện lời báo khi kho trống */
  daGoiClaude: boolean;
}

const LOI_DAN = `Bạn là trợ lý riêng của một kho nội dung cá nhân tên "Am". Kho này chứa video YouTube, bài blog, bài diễn đàn, tập podcast và nhạc mà chủ nhà đã chọn lọc, thuộc năm mảng: AI, triết học và Phật giáo Nguyên thuỷ, truyện kể, khoa học ứng dụng, và âm nhạc.

QUY TẮC BẮT BUỘC:

1. Trả lời hoàn toàn bằng tiếng Việt, kể cả khi nội dung gốc bằng tiếng Anh.

2. CHỈ dựa vào phần nội dung được cung cấp. Không tìm được thì nói thẳng "kho chưa có nội dung nào về chuyện này" — tuyệt đối không trả lời bằng kiến thức chung của bạn. Chủ nhà hỏi là để biết TRONG KHO CỦA MÌNH có gì; muốn kiến thức chung thì họ đã dùng Google.

3. Chủ nhà là người NGHE và NHÌN, không phải người đọc. Viết ngắn, thành câu nói được, không dùng bảng biểu và không dùng dấu đầu dòng lồng nhau. Ba tới sáu câu là vừa; dài hơn chỉ khi được hỏi kỹ.

4. Khi nhắc tới một nội dung, gọi bằng tên tiếng Việt của nó nếu có. Không dán đường dẫn vào câu trả lời — giao diện tự hiện danh sách nguồn bên dưới.

5. Xưng "tôi", gọi người hỏi là "bạn". Nói chuyện tự nhiên như người quen, đừng trịnh trọng.`;

/** Rút từ khoá đáng tìm ra khỏi câu hỏi. */
function locTuKhoa(cauHoi: string): string {
  // Bỏ những từ hỏi và từ nối, giữ lại phần mang nghĩa. Danh sách ngắn có chủ
  // đích: chặt quá thì câu hỏi ngắn sẽ chẳng còn chữ nào để tìm.
  const BO = new Set([
    "có", "gì", "nào", "không", "là", "của", "về", "cho", "tôi", "bạn",
    "mà", "thì", "và", "hay", "những", "các", "một", "này", "đó", "kia",
    "xem", "nghe", "nói", "hỏi", "cái", "ở", "trong", "với", "được",
  ]);
  return cauHoi
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !BO.has(t))
    .slice(0, 6)
    .join(" ");
}

/**
 * Tìm nội dung liên quan trong kho.
 *
 * Lọc qua `ngheDuocTiengViet` giống mọi trang khác — trợ lý không được phép
 * moi ra thứ mà chính giao diện đang giấu đi vì chủ nhà không nghe được.
 */
async function timTrongKho(cauHoi: string) {
  const tuKhoa = locTuKhoa(cauHoi);
  const cacTu = tuKhoa.split(" ").filter(Boolean);

  // Không rút được chữ nào đáng tìm (câu hỏi toàn từ nối) thì lấy thứ điểm cao
  // nhất gần đây, còn hơn là trả về rỗng
  const dieuKienTu = cacTu.length
    ? {
        OR: cacTu.flatMap((t) => [
          { title: { contains: t, mode: "insensitive" as const } },
          { description: { contains: t, mode: "insensitive" as const } },
          {
            classification: {
              is: { titleVi: { contains: t, mode: "insensitive" as const } },
            },
          },
        ]),
      }
    : {};

  return prisma.contentItem.findMany({
    where: { status: "classified", ...dieuKienTu },
    orderBy: [
      { score: { compositeScore: { sort: "desc", nulls: "last" } } },
      { publishedAt: "desc" },
    ],
    take: SO_NOI_DUNG_DOC,
    select: {
      id: true,
      title: true,
      description: true,
      contentGroup: true,
      durationSeconds: true,
      publishedAt: true,
      source: { select: { title: true } },
      score: { select: { compositeScore: true } },
      classification: {
        select: { titleVi: true, contentQualityNotes: true, extractedTopics: true },
      },
      transcript: { select: { rawText: true, fetchStatus: true } },
      narrationAsset: { select: { scriptText: true, ttsAudioUrl: true } },
    },
  });
}

const TEN_NHOM: Record<string, string> = {
  ai: "AI",
  triet_hoc: "Triết học",
  truyen: "Truyện",
  music: "Nhạc",
  khoa_hoc: "Khoa học",
  new_search: "New",
  other: "Khác",
};

export async function traLoiTroChuyen(
  cauHoi: string,
  lichSu: LuotNoi[] = [],
): Promise<KetQuaTraLoi> {
  const cau = cauHoi.trim();
  if (!cau) {
    return {
      traLoi: "Bạn chưa hỏi gì cả.",
      nguon: [],
      daGoiClaude: false,
    };
  }

  const timDuoc = await timTrongKho(cau);

  if (timDuoc.length === 0) {
    return {
      traLoi:
        "Kho chưa có nội dung nào khớp với câu này. Có thể lượt quét đêm chưa " +
        "chạm tới, hoặc chưa nguồn nào của bạn nói về chuyện đó.",
      nguon: [],
      daGoiClaude: false,
    };
  }

  const phanKho = timDuoc
    .map((m, i) => {
      // Ưu tiên bản thuật lại tiếng Việt: nó chính là thứ chủ nhà nghe được,
      // và ngắn gọn hơn lời thoại gốc nhiều
      const chu =
        m.narrationAsset?.scriptText ??
        (m.transcript?.fetchStatus === "success" ? m.transcript.rawText : null);

      const phut = m.durationSeconds
        ? `${Math.round(m.durationSeconds / 60)} phút`
        : "chưa rõ";

      return [
        `--- Nội dung ${i + 1} ---`,
        `Tên: ${m.classification?.titleVi ?? m.title}`,
        `Nguồn: ${m.source.title} · ${TEN_NHOM[m.contentGroup] ?? m.contentGroup} · ${phut}`,
        m.score?.compositeScore != null
          ? `Điểm chất lượng: ${m.score.compositeScore.toFixed(1)}/10`
          : null,
        m.classification?.contentQualityNotes
          ? `Nhận xét: ${m.classification.contentQualityNotes}`
          : null,
        chu ? `Nội dung: ${chu.slice(0, DAI_TOI_DA_MOI_MUC)}` : "Nội dung: (chưa có chữ)",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");

  const phanLichSu = lichSu
    .slice(-SO_LUOT_NHO)
    .map((l) => `${l.vaiTro === "nguoi" ? "Bạn" : "Tôi"}: ${l.chu}`)
    .join("\n");

  const cauHoiDayDu = [
    phanLichSu ? `Mấy lượt vừa rồi:\n${phanLichSu}\n` : null,
    `Nội dung tìm được trong kho:\n\n${phanKho}`,
    `\n--- Câu hỏi ---\n${cau}`,
  ]
    .filter(Boolean)
    .join("\n");

  const goi = await goiClaudeCli({ loiDan: LOI_DAN, cauHoi: cauHoiDayDu });

  return {
    traLoi: goi.vanBan.trim(),
    nguon: timDuoc.map((m) => ({
      id: m.id,
      tieuDe: m.classification?.titleVi ?? m.title,
      kenh: m.source.title,
      diem: m.score?.compositeScore ?? null,
    })),
    daGoiClaude: true,
  };
}
