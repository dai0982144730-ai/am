/**
 * Wiki cá nhân — Claude viết lại toàn bộ ghi chú trong một ngăn thành một bài.
 *
 * ## Vì sao cần
 *
 * `ganNhan.ts` đã xếp ghi chú vào ngăn theo chủ đề. Nhưng một ngăn hai chục ghi
 * chú vẫn chỉ là hai chục mẩu rời — mỗi mẩu viết cụt trong lúc đang xem dở, ba
 * tháng sau đọc lại không nối được thành cái gì. Bản thiết kế gọi phần này là
 * "wiki cá nhân": thứ đọng lại sau khi xem, chứ không phải nhật ký những lần
 * bấm ghi.
 *
 * ## Vì sao chạy ĐỊNH KỲ chứ không chạy mỗi lần thêm ghi chú
 *
 * Viết lại cả ngăn tốn một lần gọi Claude cho **toàn bộ** ghi chú trong đó.
 * Chạy lại sau mỗi lần ghi thì ngăn hai chục ghi chú tốn hai chục lần gọi, mà
 * mười chín bản đầu bị bản sau đè mất ngay. Nên chỉ viết lại khi ngăn **thật sự
 * đổi** kể từ lần tổng hợp trước.
 *
 * ## Điều kiện để một ngăn được viết lại
 *
 *   1. Có ít nhất `TOI_THIEU_GHI_CHU` ghi chú — dưới mức đó thì "tổng hợp" chỉ
 *      là chép lại, không thêm được gì.
 *   2. Chưa tổng hợp lần nào, HOẶC có ghi chú mới/sửa sau lần tổng hợp gần nhất.
 *
 * Điều kiện 2 là chỗ giữ tiền: đêm nào cũng chạy nhưng ngăn không đổi thì không
 * gọi Claude lần nào.
 */

import { z } from "zod";

import { prisma } from "@/lib/db/prisma";
import { goiClaudeCli } from "@/lib/llm/claudeCli";
import { chonCachGoi } from "@/lib/llm/phanLoai";

/**
 * Ngăn ít hơn ngần này ghi chú thì chưa viết lại.
 *
 * Ba là mức thấp nhất mà việc "tổng hợp" còn có nghĩa: hai mẩu thì đọc thẳng
 * cả hai còn nhanh hơn đọc bản tóm tắt.
 */
const TOI_THIEU_GHI_CHU = 3;

/** Cắt bớt ghi chú quá dài trước khi gửi đi, để một ngăn không phình vô hạn. */
const TOI_DA_CHU_MOI_GHI_CHU = 1_500;

const KhungTongHop = z.object({
  baiViet: z
    .string()
    .describe(
      "Bài tổng hợp bằng tiếng Việt, 3–8 đoạn văn. Viết như một trang wiki cá nhân",
    ),
});

type KetQuaTongHop = z.infer<typeof KhungTongHop>;

const LOI_DAN = `Bạn đang viết một trang wiki cá nhân cho một người, từ chính những ghi chú họ đã ghi trong lúc xem video và đọc bài.

## Việc cần làm

Đọc hết các ghi chú trong ngăn này rồi viết lại thành MỘT bài liền mạch bằng
tiếng Việt, 3–8 đoạn.

## Viết thế nào

**Gom ý trùng lại.** Cùng một điều được ghi ba lần ở ba video khác nhau thì viết
một lần, và nói rõ nó lặp lại — chỗ lặp lại chính là chỗ người ta thật sự quan
tâm.

**Giữ nguyên chỗ mâu thuẫn.** Hai nguồn nói ngược nhau thì bày cả hai ra chứ
đừng chọn hộ một bên. Người đọc là người đã ghi những dòng này; họ tự quyết
được, và giấu đi một vế là làm hỏng cái họ đang tìm.

**Đừng bịa phần không có trong ghi chú.** Đây là tổng hợp lại thứ họ đã ghi,
không phải bài giảng về chủ đề đó. Ghi chú sơ sài thì bài ngắn, thế là đúng.

**Nhắc tên nguồn khi nó giúp nhớ lại.** "Trong bài về X có nói…" giúp tìm lại
được chỗ gốc.

## Giọng văn

Viết như người đó tự viết cho chính mình đọc lại sau này. Không mở bài kiểu
"Trong bài viết này chúng ta sẽ…", không kết luận sáo. Vào thẳng nội dung.

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

interface GhiChuTrongNgan {
  rawText: string;
  timestampSeconds: number | null;
  createdAt: Date;
  contentItem: { title: string; source: { title: string } };
}

function soanCauHoi(tenNgan: string, cacGhiChu: GhiChuTrongNgan[]): string {
  const dong = cacGhiChu.map((g, i) => {
    const moc =
      g.timestampSeconds === null
        ? ""
        : ` — phút ${Math.floor(g.timestampSeconds / 60)}`;
    return (
      `${i + 1}. [${g.contentItem.title.slice(0, 70)}` +
      ` · ${g.contentItem.source.title.slice(0, 40)}${moc}]\n` +
      `   ${g.rawText.slice(0, TOI_DA_CHU_MOI_GHI_CHU)}`
    );
  });

  return [
    `Ngăn: "${tenNgan}"`,
    `Số ghi chú: ${cacGhiChu.length}`,
    "",
    "Các ghi chú, theo thứ tự thời gian:",
    "",
    ...dong,
  ].join("\n");
}

export interface KetQuaTongHopWiki {
  daXet: number;
  thanhCong: number;
  boQuaChuaDoi: number;
  cacNganDaViet: string[];
  loi: { ngan: string; lyDo: string }[];
}

/**
 * Viết lại các ngăn đã đổi kể từ lần tổng hợp trước.
 *
 * @param soToiDa Số ngăn viết lại nhiều nhất trong một lượt
 */
export async function tongHopWikiHangLoat(
  soToiDa = 3,
): Promise<KetQuaTongHopWiki> {
  const kq: KetQuaTongHopWiki = {
    daXet: 0,
    thanhCong: 0,
    boQuaChuaDoi: 0,
    cacNganDaViet: [],
    loi: [],
  };

  if (soToiDa <= 0) return kq;

  if (chonCachGoi() !== "cli") {
    throw new Error("Phần tổng hợp wiki hiện chỉ chạy qua Claude CLI.");
  }
  const model = process.env.MODEL_TONG_HOP_WIKI?.trim() || "claude-sonnet-5";

  const cacNgan = await prisma.knowledgeCollection.findMany({
    select: {
      id: true,
      title: true,
      lastSynthesizedAt: true,
      notes: {
        orderBy: { createdAt: "asc" },
        select: {
          rawText: true,
          timestampSeconds: true,
          createdAt: true,
          updatedAt: true,
          contentItem: {
            select: { title: true, source: { select: { title: true } } },
          },
        },
      },
    },
  });

  const canViet = cacNgan.filter((n) => {
    if (n.notes.length < TOI_THIEU_GHI_CHU) return false;
    if (!n.lastSynthesizedAt) return true;

    // Đổi = có ghi chú được tạo HOẶC sửa sau lần tổng hợp gần nhất. Chỉ nhìn
    // `createdAt` thì sửa lại một ghi chú cũ sẽ không kích hoạt viết lại, và
    // bản tổng hợp im lặng lạc hậu.
    const moc = n.lastSynthesizedAt;
    return n.notes.some((g) => g.createdAt > moc || g.updatedAt > moc);
  });

  kq.boQuaChuaDoi = cacNgan.filter(
    (n) => n.notes.length >= TOI_THIEU_GHI_CHU && !canViet.includes(n),
  ).length;

  for (const ngan of canViet.slice(0, soToiDa)) {
    kq.daXet += 1;
    try {
      const bai = await vietMotNgan(ngan.title, ngan.notes, model);
      await prisma.knowledgeCollection.update({
        where: { id: ngan.id },
        data: {
          synthesizedSummary: bai.baiViet,
          lastSynthesizedAt: new Date(),
        },
      });
      kq.thanhCong += 1;
      kq.cacNganDaViet.push(ngan.title);
    } catch (e) {
      // Một ngăn hỏng không được làm chết cả mẻ
      kq.loi.push({
        ngan: ngan.title,
        lyDo: e instanceof Error ? e.message.slice(0, 200) : String(e),
      });
    }
  }

  return kq;
}

/** Gọi Claude viết lại một ngăn. Thử lại một lần nếu JSON hỏng. */
async function vietMotNgan(
  tenNgan: string,
  cacGhiChu: GhiChuTrongNgan[],
  model: string,
): Promise<KetQuaTongHop> {
  const loiDan = `${LOI_DAN}\n\n${JSON.stringify(z.toJSONSchema(KhungTongHop), null, 1)}`;
  let nhacLoi = "";

  for (let lan = 0; lan < 2; lan += 1) {
    const goi = await goiClaudeCli({
      loiDan,
      cauHoi: soanCauHoi(tenNgan, cacGhiChu) + nhacLoi,
      model,
    });

    let tho: unknown;
    try {
      tho = JSON.parse(bocJson(goi.vanBan));
    } catch {
      nhacLoi = "\n\nLần trước bạn trả về thứ không phải JSON. Chỉ trả JSON.";
      continue;
    }

    const kiem = KhungTongHop.safeParse(tho);
    if (kiem.success) return kiem.data;
    nhacLoi = `\n\nLần trước JSON sai khuôn: ${kiem.error.issues
      .map((v) => v.path.join("."))
      .join(", ")}. Trả đúng khuôn.`;
  }

  throw new Error("Claude không trả về JSON đúng khuôn sau hai lần thử.");
}
