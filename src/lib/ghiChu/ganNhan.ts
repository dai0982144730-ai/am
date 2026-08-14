/**
 * Claude đọc ghi chú rồi gắn nhãn, xếp vào bộ sưu tập, tách việc cần làm.
 *
 * VÌ SAO KHÔNG ĐỂ NGƯỜI DÙNG TỰ GẮN NHÃN: ai cũng định gắn nhãn tử tế, nhưng
 * đang xem dở thì chẳng ai dừng lại nghĩ xem cái này nên bỏ vào ngăn nào. Vài
 * tháng sau còn hai trăm ghi chú không nhãn, và không tìm lại được gì.
 *
 * VÌ SAO CLAUDE ĐƯỢC ĐỌC ĐOẠN LỜI THOẠI QUANH ĐÓ: ghi chú thường viết cụt vì
 * người viết đang có ngữ cảnh trong đầu — *"chỗ này hay"*, *"thử cách này"*.
 * Chỉ nhìn mỗi câu đó thì không gắn nhãn nổi. Đưa kèm đoạn lời thoại quanh mốc
 * thời gian thì Claude biết "cách này" là cách gì.
 *
 * CHẠY GỘP, KHÔNG CHẠY NGAY LÚC GHI. Người dùng đang xem dở, bắt chờ Claude
 * mười lăm giây thì lần sau họ không ghi nữa.
 */

import { z } from "zod";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { goiClaudeCli } from "@/lib/llm/claudeCli";
import { chonCachGoi } from "@/lib/llm/phanLoai";

/** Bao nhiêu ký tự lời thoại lấy quanh mốc thời gian, mỗi bên. */
const CHU_QUANH_MOC = 1200;

const KhungGanNhan = z.object({
  nhan: z
    .array(z.string())
    .max(5)
    .describe("2–5 nhãn ngắn bằng tiếng Việt, mỗi nhãn 1–3 từ"),
  loaiGhiChu: z
    .enum(["freeform", "action_item", "quote"])
    .describe(
      "action_item khi người viết định làm gì đó; quote khi đang chép lại lời người khác nói; còn lại là freeform",
    ),
  tenBoSuuTap: z
    .string()
    .describe("Tên chủ đề để xếp ghi chú này vào, 2–5 từ tiếng Việt"),
  viecCanLam: z
    .string()
    .nullable()
    .describe(
      "Chỉ điền khi loaiGhiChu là action_item: câu mô tả việc cần làm, viết rõ ràng thành câu hoàn chỉnh",
    ),
});

type KetQuaGanNhan = z.infer<typeof KhungGanNhan>;

const LOI_DAN = `Bạn đang giúp sắp xếp ghi chú cá nhân của một người, ghi lại trong lúc họ xem video.

Ghi chú thường viết rất cụt vì lúc viết họ đang có sẵn ngữ cảnh trong đầu —
"chỗ này hay", "thử cách này". Bạn được đưa kèm đoạn lời thoại quanh mốc thời
gian đó, hãy dùng nó để hiểu họ đang nói về cái gì.

## Về nhãn

Từ 2 đến 5 nhãn, mỗi nhãn 1–3 từ tiếng Việt. Nhãn phải cụ thể đủ để sau này tìm
lại được. "AI" thì quá rộng; "prompt caching", "chi phí token" thì dùng được.

## Về tên bộ sưu tập

Đây là ngăn chủ đề để gom nhiều ghi chú lại, kiểu như một trang wiki cá nhân.
Đặt tên **rộng hơn nhãn một bậc** — nhiều ghi chú khác nhau phải xếp chung vào
được. Ví dụ nhãn là "prompt caching" thì bộ sưu tập là "Tối ưu chi phí LLM".

Nếu ghi chú không rõ chủ đề gì thì đặt tên theo chuyên mục của video.

## Về việc cần làm

Chỉ đánh dấu action_item khi người viết thật sự định làm gì đó — "thử cái này",
"đọc bài kia", "cài thư viện nọ". Nghĩ về một chuyện không phải là việc cần làm.
Đánh dấu bừa thì danh sách việc đầy thứ không phải việc, và họ sẽ thôi nhìn nó.

Trả lời DUY NHẤT một object JSON theo đúng khuôn dưới đây, không viết gì thêm.`;

function dinhKemKhuon(): string {
  return `\n\n${JSON.stringify(z.toJSONSchema(KhungGanNhan), null, 1)}`;
}

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
 * Cắt đoạn lời thoại quanh mốc thời gian.
 *
 * Lời thoại lưu dạng một khối chữ liền, không có mốc giờ từng câu, nên không
 * cắt chính xác theo giây được. Ước lượng bằng tỉ lệ: ghi chú ở phút 23 của
 * video dài 46 phút thì đoạn cần lấy nằm khoảng giữa bài. Thô nhưng đủ dùng —
 * mục đích chỉ là cho Claude biết đang bàn chuyện gì.
 */
function catQuanhMoc(
  loiThoai: string,
  giay: number | null,
  tongGiay: number | null,
): string {
  if (!giay || !tongGiay || tongGiay <= 0) {
    return loiThoai.slice(0, CHU_QUANH_MOC * 2);
  }

  const tam = Math.floor((giay / tongGiay) * loiThoai.length);
  return loiThoai.slice(
    Math.max(0, tam - CHU_QUANH_MOC),
    Math.min(loiThoai.length, tam + CHU_QUANH_MOC),
  );
}

function docPhutGiay(giay: number | null): string {
  if (giay === null) return "không gắn mốc";
  const p = Math.floor(giay / 60);
  const s = Math.floor(giay % 60);
  return `phút ${p}:${String(s).padStart(2, "0")}`;
}

interface GhiChuCanGanNhan {
  id: string;
  rawText: string;
  timestampSeconds: number | null;
  contentItem: {
    title: string;
    durationSeconds: number | null;
    contentGroup: string;
    transcript: { rawText: string } | null;
    classification: { extractedTopics: string[] } | null;
  };
}

function soanCauHoi(ghiChu: GhiChuCanGanNhan): string {
  const nd = ghiChu.contentItem;
  const phan = [
    `Video: "${nd.title}"`,
    `Chuyên mục: ${nd.contentGroup}`,
    nd.classification?.extractedTopics.length
      ? `Chủ đề: ${nd.classification.extractedTopics.join(", ")}`
      : null,
    ``,
    `Ghi chú của người dùng (${docPhutGiay(ghiChu.timestampSeconds)}):`,
    `"${ghiChu.rawText}"`,
  ].filter((d) => d !== null);

  if (nd.transcript?.rawText) {
    const doan = catQuanhMoc(
      nd.transcript.rawText,
      ghiChu.timestampSeconds,
      nd.durationSeconds,
    );
    if (doan.trim()) {
      phan.push("", "Đoạn lời thoại quanh chỗ đó:", doan);
    }
  }

  return phan.join("\n");
}

/** Gọi Claude gắn nhãn cho một ghi chú. */
async function ganNhanMotGhiChu(
  ghiChu: GhiChuCanGanNhan,
  model: string,
): Promise<KetQuaGanNhan> {
  const loiDan = LOI_DAN + dinhKemKhuon();
  let nhacLoi = "";

  for (let lan = 0; lan < 2; lan += 1) {
    const goi = await goiClaudeCli({
      loiDan,
      cauHoi: soanCauHoi(ghiChu) + nhacLoi,
      model,
    });

    let tho: unknown;
    try {
      tho = JSON.parse(bocJson(goi.vanBan));
    } catch {
      nhacLoi =
        "\n\nLần trước bạn trả lời không phải JSON hợp lệ. " +
        "Lần này chỉ trả về đúng một object JSON.";
      continue;
    }

    const kiemTra = KhungGanNhan.safeParse(tho);
    if (kiemTra.success) return kiemTra.data;

    const loiDau = kiemTra.error.issues[0];
    if (lan === 1) {
      throw new Error(
        `Claude trả JSON sai khuôn ở "${loiDau?.path.join(".")}": ${loiDau?.message}`,
      );
    }
    nhacLoi = `\n\nLần trước bạn điền sai trường "${loiDau?.path.join(".")}": ${loiDau?.message}.`;
  }

  throw new Error("Không gắn nhãn được sau hai lần thử.");
}

export interface KetQuaGanNhanHangLoat {
  daXet: number;
  thanhCong: number;
  soViecCanLam: number;
  boSuuTapMoi: string[];
  loi: { ghiChu: string; lyDo: string }[];
}

/**
 * Gắn nhãn cho mọi ghi chú chưa có nhãn.
 *
 * Bỏ qua ghi chú đã có `autoTags` — chạy lại nhiều lần không tốn thêm gì, và
 * quan trọng hơn là **không đè lên nhãn người dùng đã sửa tay**.
 */
export async function ganNhanHangLoat(
  soToiDa = 30,
): Promise<KetQuaGanNhanHangLoat> {
  if (chonCachGoi() !== "cli") {
    throw new Error("Phần gắn nhãn ghi chú hiện chỉ chạy qua Claude CLI.");
  }

  const model = process.env.MODEL_GAN_NHAN?.trim() || "claude-sonnet-5";

  const canLam = await prisma.note.findMany({
    // `DbNull` chứ không phải `null`: với cột JSON, Prisma phân biệt "ô trống
    // trong database" với "giá trị JSON null được ghi vào". Dùng nhầm thì lọc
    // không ra gì cả.
    where: { autoTags: { equals: Prisma.DbNull } },
    orderBy: { createdAt: "asc" },
    take: soToiDa,
    select: {
      id: true,
      rawText: true,
      timestampSeconds: true,
      contentItem: {
        select: {
          title: true,
          durationSeconds: true,
          contentGroup: true,
          transcript: { select: { rawText: true } },
          classification: { select: { extractedTopics: true } },
        },
      },
    },
  });

  const ketQua: KetQuaGanNhanHangLoat = {
    daXet: canLam.length,
    thanhCong: 0,
    soViecCanLam: 0,
    boSuuTapMoi: [],
    loi: [],
  };

  for (const ghiChu of canLam) {
    try {
      const nhan = await ganNhanMotGhiChu(ghiChu, model);

      // Tìm-hoặc-tạo bộ sưu tập. `autoCreated` để phân biệt ngăn máy tự đặt
      // với ngăn người dùng tự lập — sau này muốn dọn thì biết cái nào là của ai
      const daCo = await prisma.knowledgeCollection.findUnique({
        where: { title: nhan.tenBoSuuTap },
        select: { id: true },
      });

      const boSuuTap =
        daCo ??
        (await prisma.knowledgeCollection.create({
          data: { title: nhan.tenBoSuuTap, autoCreated: true },
          select: { id: true },
        }));

      if (!daCo) ketQua.boSuuTapMoi.push(nhan.tenBoSuuTap);

      await prisma.note.update({
        where: { id: ghiChu.id },
        data: {
          autoTags: nhan.nhan,
          noteType: nhan.loaiGhiChu,
          collectionId: boSuuTap.id,
        },
      });

      if (nhan.loaiGhiChu === "action_item" && nhan.viecCanLam) {
        await prisma.actionItem.upsert({
          where: { noteId: ghiChu.id },
          create: {
            noteId: ghiChu.id,
            contentItemId: (
              await prisma.note.findUniqueOrThrow({
                where: { id: ghiChu.id },
                select: { contentItemId: true },
              })
            ).contentItemId,
            description: nhan.viecCanLam,
          },
          update: { description: nhan.viecCanLam },
        });
        ketQua.soViecCanLam += 1;
      }

      ketQua.thanhCong += 1;
    } catch (e) {
      ketQua.loi.push({
        ghiChu: ghiChu.rawText.slice(0, 40),
        lyDo: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return ketQua;
}
