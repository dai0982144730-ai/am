/**
 * Dựng hồ sơ gu cá nhân — Claude đọc hành vi rồi viết ra thứ máy dùng được.
 *
 * ## Phần nào của Phase 9 làm được bây giờ, phần nào chưa
 *
 * Phase 9 có bốn phần: hồ sơ gu, embeddings, gu theo khung giờ, và khởi động
 * nguội. Chỉ **embeddings** cần pgvector — mà bản PostgreSQL portable đang chạy
 * ở máy này không có, và cũng không cài thêm được (`pg_available_extensions`
 * không liệt kê `vector`). Ba phần còn lại chỉ cần đọc dữ liệu đã có, nên làm
 * được ngay. File này làm ba phần đó.
 *
 * ## Nguồn tín hiệu chính KHÔNG phải hành vi trong app
 *
 * Đo ngày 2026-08-16:
 *
 * | Nguồn | Số lượng |
 * |---|---|
 * | Tín hiệu từ tài khoản YouTube | **1.029** |
 * | Phiên nghe trong app | 39, xem hết 0 |
 *
 * 39 phiên mà không phiên nào xem hết thì kết luận gì cũng là bịa. Còn 282
 * video đã thích và 523 video tự tay bỏ vào playlist thì đó là gu thật, tích
 * trong nhiều năm. Đây chính là việc `YouTubeAccountSignal` sinh ra để làm —
 * bản thiết kế gọi là "giải cold start".
 *
 * Nên hồ sơ dựng **chủ yếu từ tín hiệu YouTube**, còn hành vi trong app chỉ là
 * lớp phủ mỏng, và lời dặn nói thẳng với Claude điều đó để nó đừng rút kết luận
 * mạnh từ vài chục phiên nghe dở dang.
 *
 * ## Vì sao lưu theo phiên bản
 *
 * `UserTasteProfile.version` là số tăng dần, mỗi lần dựng là một bản mới chứ
 * không đè lên bản cũ. Một đợt dữ liệu nhiễu — một tuần mở toàn video linh tinh
 * — có thể làm hồ sơ lệch hẳn, và lúc đó phải quay lại được bản trước. Bản
 * thiết kế đã ghi sẵn yêu cầu này trong chính lời chú thích của model.
 */

import { z } from "zod";

import type { NarrationType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db/prisma";
import { goiClaudeCli } from "@/lib/llm/claudeCli";
import { chonCachGoi } from "@/lib/llm/phanLoai";

/** Số tín hiệu YouTube mỗi loại đem cho Claude đọc. */
const SO_TIN_HIEU_MOI_LOAI = 120;

/** Số phiên nghe trong app đem cho Claude đọc. */
const SO_PHIEN_NGHE = 60;

/** Dưới ngần này tín hiệu thì chưa đủ để dựng hồ sơ. */
const TOI_THIEU_TIN_HIEU = 30;

const KhungHoSo = z.object({
  chuDeUaThich: z
    .record(z.string(), z.number())
    .describe(
      "Chủ đề con → trọng số 0–1. Chỉ ghi chủ đề thấy rõ trong dữ liệu, 5–15 mục",
    ),
  thoiLuongToiThieuPhut: z
    .number()
    .nullable()
    .describe("Độ dài ngắn nhất người này hay chọn, tính bằng phút. Null nếu không rõ"),
  thoiLuongToiDaPhut: z
    .number()
    .nullable()
    .describe("Độ dài dài nhất người này còn chịu ngồi nghe. Null nếu không rõ"),
  kieuGiongUaThich: z
    .enum(["human_voice", "ai_tts", "text_only", "instrumental", "unknown"])
    .describe("unknown nếu dữ liệu chưa đủ để nói"),
  ngonNguUaThich: z
    .array(z.string())
    .describe('Mã ngôn ngữ, ví dụ ["vi", "en"], xếp theo mức ưa thích'),
  guTheoKhungGio: z
    .record(z.string(), z.string())
    .describe(
      'Khung giờ → chuyên mục ưu tiên, ví dụ {"sang": "ai", "toi": "triet_hoc"}. Để rỗng nếu dữ liệu không cho thấy nếp giờ giấc nào',
    ),
  neTranh: z
    .array(z.string())
    .describe("Kiểu nội dung người này rõ ràng không thích. Để rỗng nếu chưa thấy"),
  tomTat: z
    .string()
    .describe(
      "3–6 câu tiếng Việt mô tả gu người này, viết cho một trợ lý đọc để hiểu nên gợi ý gì",
    ),
  doTinCay: z
    .enum(["thap", "vua", "cao"])
    .describe("Mức tin cậy của chính bản hồ sơ này, dựa trên lượng dữ liệu có"),
});

type KetQuaHoSo = z.infer<typeof KhungHoSo>;

const LOI_DAN = `Bạn đang dựng hồ sơ gu cá nhân cho MỘT người dùng, từ hành vi thật của họ.

## Dữ liệu bạn có, và mức tin cậy khác nhau của từng loại

**Tín hiệu từ tài khoản YouTube** — video đã thích, video tự tay bỏ vào playlist,
kênh đã đăng ký. Đây là **tín hiệu mạnh nhất**: tích trong nhiều năm, và mỗi
hành động đều là chủ động.

**Hành vi trong app** — số phiên còn ít và phần lớn nghe dở dang. Dùng để **đối
chiếu**, không dùng để kết luận. Nghe 30% một video KHÔNG có nghĩa là chán: có
thể họ bị gọi đi việc khác.

## Nguyên tắc quan trọng nhất: đừng bịa

Chỉ ghi ra thứ **nhìn thấy được trong dữ liệu**. Không thấy nếp giờ giấc nào thì
để \`guTheoKhungGio\` rỗng, đừng đoán ra một cái lịch nghe cho đẹp. Không rõ họ
thích dài hay ngắn thì để null.

Hồ sơ này sẽ được dùng để xếp hạng thứ hiện lên mỗi sáng. Một dòng bịa ra sẽ
lặng lẽ đẩy nhầm nội dung lên đầu trong nhiều tháng, và không ai biết vì sao.

\`doTinCay\` phải trung thực: dữ liệu mỏng thì ghi "thap", đừng ghi "cao" cho
oai.

## Về chủ đề con

Cụ thể vừa phải. "AI" thì quá rộng vì đó vốn đã là cả một chuyên mục; "AI agent
cho công việc", "hướng dẫn dùng Claude", "thiền Nguyên thuỷ" thì dùng được.

Trả lời DUY NHẤT một object JSON theo đúng khuôn dưới đây, không viết gì thêm.`;

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

/** Khung giờ trong ngày, dùng để Claude thấy được nếp nghe. */
function khungGio(luc: Date): string {
  const g = luc.getHours();
  if (g < 6) return "khuya";
  if (g < 11) return "sang";
  if (g < 14) return "trua";
  if (g < 18) return "chieu";
  return "toi";
}

function docPhut(giay: number | null): string {
  return giay ? `${Math.round(giay / 60)}ph` : "?";
}

export interface KetQuaDungHoSo {
  daDung: boolean;
  lyDo: string | null;
  phienBan: number | null;
  doTinCay: string | null;
  soTinHieu: number;
}

/**
 * Dựng một bản hồ sơ gu mới.
 *
 * @param batBuoc Dựng lại kể cả khi dữ liệu chưa đổi mấy so với bản trước
 */
export async function dungHoSoGu(batBuoc = false): Promise<KetQuaDungHoSo> {
  const [daThich, trongPlaylist, daDangKy, cacPhien, banTruoc] =
    await Promise.all([
      prisma.youTubeAccountSignal.findMany({
        where: { signalType: "liked_video" },
        take: SO_TIN_HIEU_MOI_LOAI,
        orderBy: { importedAt: "desc" },
        select: { title: true, channelTitle: true },
      }),
      prisma.youTubeAccountSignal.findMany({
        where: { signalType: "playlist_member" },
        take: SO_TIN_HIEU_MOI_LOAI,
        orderBy: { importedAt: "desc" },
        select: { title: true, channelTitle: true },
      }),
      prisma.youTubeAccountSignal.findMany({
        where: { signalType: "subscription" },
        take: SO_TIN_HIEU_MOI_LOAI,
        orderBy: { importedAt: "desc" },
        select: { title: true },
      }),
      prisma.consumptionSession.findMany({
        take: SO_PHIEN_NGHE,
        orderBy: { startedAt: "desc" },
        select: {
          startedAt: true,
          percentComplete: true,
          completed: true,
          replayCount: true,
          explicitRating: true,
          emotionTags: true,
          contentItem: {
            select: {
              title: true,
              contentGroup: true,
              durationSeconds: true,
              narrationType: true,
              originalLanguage: true,
            },
          },
        },
      }),
      prisma.userTasteProfile.findFirst({
        orderBy: { version: "desc" },
        select: { version: true, createdAt: true },
      }),
    ]);

  const soTinHieu = daThich.length + trongPlaylist.length + daDangKy.length;

  if (soTinHieu < TOI_THIEU_TIN_HIEU) {
    return {
      daDung: false,
      lyDo: `mới có ${soTinHieu} tín hiệu, chưa đủ để dựng hồ sơ (cần ${TOI_THIEU_TIN_HIEU})`,
      phienBan: null,
      doTinCay: null,
      soTinHieu,
    };
  }

  // Không dựng lại mỗi đêm. Gu một người không đổi sau một ngày, còn mỗi lần
  // dựng là một lần gọi Claude với cả nghìn dòng dữ liệu.
  if (!batBuoc && banTruoc) {
    const soPhienMoi = cacPhien.filter(
      (p) => p.startedAt > banTruoc.createdAt,
    ).length;
    if (soPhienMoi < 10) {
      return {
        daDung: false,
        lyDo: `bản ${banTruoc.version} còn mới, chỉ thêm ${soPhienMoi} phiên nghe kể từ đó`,
        phienBan: banTruoc.version,
        doTinCay: null,
        soTinHieu,
      };
    }
  }

  if (chonCachGoi() !== "cli") {
    throw new Error("Phần dựng hồ sơ gu hiện chỉ chạy qua Claude CLI.");
  }
  const model = process.env.MODEL_HO_SO_GU?.trim() || "claude-sonnet-5";

  const cauHoi = soanCauHoi(daThich, trongPlaylist, daDangKy, cacPhien);
  const hoSo = await goiClaude(cauHoi, model);

  const phienBanMoi = (banTruoc?.version ?? 0) + 1;
  await prisma.userTasteProfile.create({
    data: {
      version: phienBanMoi,
      preferredSubtopics: hoSo.chuDeUaThich,
      preferredDurationMin: hoSo.thoiLuongToiThieuPhut
        ? Math.round(hoSo.thoiLuongToiThieuPhut * 60)
        : null,
      preferredDurationMax: hoSo.thoiLuongToiDaPhut
        ? Math.round(hoSo.thoiLuongToiDaPhut * 60)
        : null,
      preferredNarrationType:
        hoSo.kieuGiongUaThich === "unknown"
          ? null
          : (hoSo.kieuGiongUaThich as NarrationType),
      preferredLanguages: hoSo.ngonNguUaThich,
      moodSchedule: hoSo.guTheoKhungGio,
      dislikedPatterns: hoSo.neTranh.length > 0 ? hoSo.neTranh : undefined,
      // Ghi kèm mức tin cậy vào chính bài tóm tắt: nơi đọc nó là khung trò
      // chuyện, và ở đó không có chỗ nào khác để biết hồ sơ này đáng tin tới đâu
      freeformSummary: `[Độ tin cậy: ${hoSo.doTinCay} · dựng từ ${soTinHieu} tín hiệu YouTube và ${cacPhien.length} phiên nghe]\n\n${hoSo.tomTat}`,
    },
  });

  return {
    daDung: true,
    lyDo: null,
    phienBan: phienBanMoi,
    doTinCay: hoSo.doTinCay,
    soTinHieu,
  };
}

type TinHieu = { title: string; channelTitle?: string | null };

function soanCauHoi(
  daThich: TinHieu[],
  trongPlaylist: TinHieu[],
  daDangKy: TinHieu[],
  cacPhien: {
    startedAt: Date;
    percentComplete: number;
    completed: boolean;
    replayCount: number;
    explicitRating: number | null;
    emotionTags: string[];
    contentItem: {
      title: string;
      contentGroup: string;
      durationSeconds: number | null;
      narrationType: string;
      originalLanguage: string | null;
    };
  }[],
): string {
  const ke = (ds: TinHieu[]) =>
    ds
      .map(
        (t) =>
          `- ${t.title.slice(0, 90)}${t.channelTitle ? ` — ${t.channelTitle.slice(0, 40)}` : ""}`,
      )
      .join("\n");

  const phan = [
    `## Video đã thích trên YouTube (${daThich.length})`,
    ke(daThich),
    "",
    `## Video tự tay bỏ vào playlist (${trongPlaylist.length})`,
    ke(trongPlaylist),
    "",
    `## Kênh đã đăng ký (${daDangKy.length})`,
    ke(daDangKy),
  ];

  if (cacPhien.length > 0) {
    phan.push(
      "",
      `## Phiên nghe trong app (${cacPhien.length}) — tín hiệu YẾU, dùng để đối chiếu thôi`,
      cacPhien
        .map((p) => {
          const nd = p.contentItem;
          const them = [
            p.explicitRating ? `${p.explicitRating}/5 sao` : null,
            p.emotionTags.length ? p.emotionTags.join("/") : null,
            p.replayCount > 0 ? `nghe lại ${p.replayCount}×` : null,
          ].filter(Boolean);
          return (
            `- [${khungGio(p.startedAt)}] ${nd.title.slice(0, 70)} ` +
            `(${nd.contentGroup}, ${docPhut(nd.durationSeconds)}, ${nd.narrationType}` +
            `${nd.originalLanguage ? `, ${nd.originalLanguage}` : ""}) ` +
            `— nghe ${Math.round(p.percentComplete * 100)}%` +
            (them.length ? `, ${them.join(", ")}` : "")
          );
        })
        .join("\n"),
    );
  }

  return phan.join("\n");
}

/** Gọi Claude, thử lại một lần nếu JSON hỏng. */
async function goiClaude(cauHoi: string, model: string): Promise<KetQuaHoSo> {
  const loiDan = `${LOI_DAN}\n\n${JSON.stringify(z.toJSONSchema(KhungHoSo), null, 1)}`;
  let nhacLoi = "";

  for (let lan = 0; lan < 2; lan += 1) {
    const goi = await goiClaudeCli({ loiDan, cauHoi: cauHoi + nhacLoi, model });

    let tho: unknown;
    try {
      tho = JSON.parse(bocJson(goi.vanBan));
    } catch {
      nhacLoi = "\n\nLần trước bạn trả về thứ không phải JSON. Chỉ trả JSON.";
      continue;
    }

    const kiem = KhungHoSo.safeParse(tho);
    if (kiem.success) return kiem.data;
    nhacLoi = `\n\nLần trước JSON sai khuôn: ${kiem.error.issues
      .map((v) => v.path.join("."))
      .join(", ")}. Trả đúng khuôn.`;
  }

  throw new Error("Claude không trả về JSON đúng khuôn sau hai lần thử.");
}
