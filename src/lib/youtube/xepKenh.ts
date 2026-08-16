/**
 * Xếp từng kênh YouTube vào một chuyên mục cố định — chạy mỗi tuần một lần.
 *
 * ## Vì sao xếp ở mức KÊNH chứ không chỉ ở mức từng video
 *
 * Chủ dự án chỉ ra 2026-08-16: *"các kênh của tôi nó theo chủ đề"*. Đúng vậy —
 * một kênh giảng pháp thì mọi video đều là giảng pháp, một kênh truyện ma thì
 * mọi video đều là truyện ma. Biết trước kênh thuộc chuyên mục nào thì:
 *
 *   - **Đỡ quét oan.** Kho có 269 kênh, phần lớn không thuộc năm mảng nào. Quét
 *     hết mỗi đêm là tốn hạn mức để mang về thứ sẽ bị loại ở bước phân loại.
 *   - **Đỡ đọc oan.** Mỗi video Claude đọc tốn hơn chục giây. Đo ngày
 *     2026-08-16: trong 411 bài phân loại lại, **264 bài bị vứt** — công đọc đổ
 *     sông cho những kênh lẽ ra không nên quét ngay từ đầu.
 *   - **Có chỗ chứa cho phần còn lại.** Kênh ngoài năm mảng không bị xoá, chỉ
 *     đứng ngoài lượt quét đêm. Khi chủ nhà muốn xem thứ ngẫu hứng thì lấy ra
 *     dùng, cùng với việc đi tìm bên ngoài.
 *
 * ## Ba nguồn thông tin, không lấy thêm gì tốn kém
 *
 * Xếp một kênh chỉ cần biết nó nói về cái gì:
 *
 *   1. **Tên kênh** — đã có sẵn trong kho
 *   2. **Mô tả kênh** — lấy qua `channels.list`, gộp 50 kênh một lệnh nên cả
 *      269 kênh chỉ tốn 6 đơn vị hạn mức
 *   3. **Vài tiêu đề video đã có trong kho** — miễn phí hoàn toàn, và thường là
 *      thứ nói thật nhất về một kênh: mô tả kênh hay viết hoa mỹ, còn tiêu đề
 *      video thì phản ánh đúng thứ kênh đăng hằng ngày
 *
 * Gộp nhiều kênh vào một lần hỏi Claude, vì xếp kênh nhẹ hơn hẳn đọc nội dung.
 */

import type { ContentGroup } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db/prisma";
import { goiClaudeCli } from "@/lib/llm/claudeCli";
import { goiYouTube } from "@/lib/youtube/goiApi";

/** Số kênh gộp vào một lần hỏi Claude. */
const KENH_MOI_LAN_HOI = 15;

/** Số tiêu đề video lấy ra làm mẫu cho mỗi kênh. */
const SO_TIEU_DE_MAU = 6;

/** Số kênh gộp vào một lệnh `channels.list`. Google cho tối đa 50. */
const KENH_MOI_LO_API = 50;

const LOI_DAN = `Bạn giúp một người Việt sắp xếp các kênh YouTube họ đang theo dõi.

Với mỗi kênh, hãy nói kênh đó CHỦ YẾU đăng nội dung thuộc chuyên mục nào.

## Sáu lựa chọn

- **ai** — trí tuệ nhân tạo: tin về các hãng AI, cách dùng công cụ AI, kinh
  nghiệm viết code bằng AI, hệ thống AI cho doanh nghiệp.
- **triet_hoc** — triết học, tâm lý học, Phật giáo Nguyên thuỷ. Gồm giảng pháp,
  vấn đáp, hướng dẫn thực hành đời sống, phân tích học thuật. Khắc kỷ, hiện
  sinh, tâm lý học hiện đại đều vào đây.
- **truyen** — kênh kể truyện có cốt truyện: kinh dị, viễn tưởng, phiêu lưu.
  Người đọc kể lại một câu chuyện hư cấu.
- **music** — kênh nhạc: nhạc tập thể thao theo nhịp, dance, piano, guitar rock,
  nhạc vàng, bolero.
- **khoa_hoc** — khoa học và công nghệ ứng dụng được vào đời sống thật: y học,
  vật lý, sinh học, vật liệu, năng lượng, kỹ thuật.
- **khac** — MỌI THỨ CÒN LẠI: thời sự, chính trị, giải trí, hài, thể thao, ẩm
  thực, du lịch, vlog đời thường, review sản phẩm, dạy nấu ăn, drama mạng.

## Nguyên tắc

**Nhìn thứ kênh đăng ĐỀU ĐẶN, không nhìn video lẻ.** Một kênh thời sự thỉnh
thoảng có video về AI vẫn là 'khac'. Ngược lại, một kênh giảng pháp thỉnh thoảng
đăng video chúc Tết vẫn là 'triet_hoc'.

**Tiêu đề video nói thật hơn mô tả kênh.** Mô tả kênh hay viết hoa mỹ và chung
chung; tiêu đề video phản ánh đúng thứ kênh làm hằng ngày. Khi hai thứ mâu
thuẫn, tin tiêu đề video.

**Chọn 'khac' không phải là chê.** Nó chỉ có nghĩa kênh này không thuộc năm mảng
người dùng đang theo đuổi. Kênh vẫn được giữ lại để dùng khi họ muốn xem thứ
ngẫu hứng.

**Không chắc thì chọn 'khac'.** Xếp nhầm một kênh giải trí vào 'khoa_hoc' sẽ kéo
theo hàng chục video rác mỗi đêm, tốn hơn nhiều so với bỏ sót một kênh hay.

## Cách trả lời

Trả về DUY NHẤT một mảng JSON, mỗi phần tử là {"so": <số thứ tự kênh>, "nhom":
"<một trong sáu mã trên>"}. Không viết gì thêm, không bọc trong dấu \`\`\`.`;

const MA_HOP_LE = new Set([
  "ai",
  "triet_hoc",
  "truyen",
  "music",
  "khoa_hoc",
  "khac",
]);

interface KenhCanXep {
  id: string;
  externalId: string;
  ten: string;
  moTa: string;
  tieuDeMau: string[];
}

interface KetQuaChannels {
  items?: { id?: string; snippet?: { description?: string } }[];
}

/** Lấy mô tả kênh, gộp 50 kênh một lệnh cho rẻ. */
async function layMoTa(cacId: string[]): Promise<Map<string, string>> {
  const moTa = new Map<string, string>();

  for (let i = 0; i < cacId.length; i += KENH_MOI_LO_API) {
    const lo = cacId.slice(i, i + KENH_MOI_LO_API);
    const kq = await goiYouTube<KetQuaChannels>("channels.list", "channels", {
      part: "snippet",
      id: lo.join(","),
    });
    for (const k of kq.items ?? []) {
      if (k.id) moTa.set(k.id, k.snippet?.description ?? "");
    }
  }

  return moTa;
}

/** Bóc mảng JSON trong câu trả lời, kể cả khi Claude viết thêm gì đó. */
function bocMang(vanBan: string): unknown[] {
  const daBoRao = vanBan
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();
  const dau = daBoRao.indexOf("[");
  const cuoi = daBoRao.lastIndexOf("]");
  if (dau === -1 || cuoi === -1 || cuoi < dau) return [];
  const tho: unknown = JSON.parse(daBoRao.slice(dau, cuoi + 1));
  return Array.isArray(tho) ? tho : [];
}

async function hoiMotMe(cacKenh: KenhCanXep[]): Promise<Map<string, string>> {
  const cauHoi = cacKenh
    .map((k, i) => {
      const phan = [`### Kênh ${i + 1}: ${k.ten}`];
      if (k.moTa.trim()) phan.push(`Mô tả: ${k.moTa.slice(0, 400)}`);
      if (k.tieuDeMau.length) {
        phan.push(
          `Vài video đã đăng:\n${k.tieuDeMau.map((t) => `  - ${t}`).join("\n")}`,
        );
      }
      return phan.join("\n");
    })
    .join("\n\n");

  const goi = await goiClaudeCli({ loiDan: LOI_DAN, cauHoi });

  const ketQua = new Map<string, string>();
  for (const muc of bocMang(goi.vanBan)) {
    if (typeof muc !== "object" || muc === null) continue;
    const { so, nhom } = muc as { so?: unknown; nhom?: unknown };
    const chiSo = Number(so) - 1;
    if (
      Number.isInteger(chiSo) &&
      chiSo >= 0 &&
      chiSo < cacKenh.length &&
      typeof nhom === "string" &&
      MA_HOP_LE.has(nhom)
    ) {
      ketQua.set(cacKenh[chiSo].id, nhom);
    }
  }

  return ketQua;
}

export interface KetQuaXepKenh {
  daXet: number;
  daXep: number;
  loi: number;
  theoNhom: Record<string, number>;
}

/**
 * Xếp các kênh chưa có chuyên mục.
 *
 * @param lamLaiHet Xếp lại cả những kênh đã có chuyên mục. Dùng khi đổi lời dặn.
 */
export async function xepKenhHangLoat(
  gioiHan = 1_000,
  bao?: (dong: string) => void,
  lamLaiHet = false,
): Promise<KetQuaXepKenh> {
  const cacNguon = await prisma.source.findMany({
    where: {
      type: "youtube_channel",
      ...(lamLaiHet ? {} : { contentGroupHint: null }),
    },
    select: { id: true, externalId: true, title: true },
    take: gioiHan,
  });

  if (cacNguon.length === 0) {
    return { daXet: 0, daXep: 0, loi: 0, theoNhom: {} };
  }

  bao?.(`Lấy mô tả của ${cacNguon.length} kênh…`);
  const moTa = await layMoTa(cacNguon.map((n) => n.externalId));

  // Tiêu đề video đã có sẵn trong kho — không tốn hạn mức nào, mà lại là thứ
  // nói thật nhất về một kênh.
  const video = await prisma.contentItem.findMany({
    where: { sourceId: { in: cacNguon.map((n) => n.id) } },
    select: { sourceId: true, title: true },
    orderBy: { publishedAt: "desc" },
  });

  const theoNguon = new Map<string, string[]>();
  for (const v of video) {
    const ds = theoNguon.get(v.sourceId) ?? [];
    if (ds.length < SO_TIEU_DE_MAU) {
      ds.push(v.title);
      theoNguon.set(v.sourceId, ds);
    }
  }

  const canXep: KenhCanXep[] = cacNguon.map((n) => ({
    id: n.id,
    externalId: n.externalId,
    ten: n.title,
    moTa: moTa.get(n.externalId) ?? "",
    tieuDeMau: theoNguon.get(n.id) ?? [],
  }));

  let daXep = 0;
  let loi = 0;
  const theoNhom: Record<string, number> = {};

  for (let i = 0; i < canXep.length; i += KENH_MOI_LAN_HOI) {
    const me = canXep.slice(i, i + KENH_MOI_LAN_HOI);
    try {
      const ketQua = await hoiMotMe(me);

      for (const kenh of me) {
        const nhom = ketQua.get(kenh.id);
        if (!nhom) {
          loi += 1;
          continue;
        }
        // "khac" trong lời dặn ứng với `other` trong database — không có mã
        // riêng cho "ngoài năm mảng", và cũng không cần thêm.
        const maDb = (nhom === "khac" ? "other" : nhom) as ContentGroup;
        await prisma.source.update({
          where: { id: kenh.id },
          data: { contentGroupHint: maDb },
        });
        daXep += 1;
        theoNhom[nhom] = (theoNhom[nhom] ?? 0) + 1;
        if (nhom !== "khac") {
          bao?.(`  ${nhom.padEnd(10)} ${kenh.ten.slice(0, 46)}`);
        }
      }
    } catch (e) {
      loi += me.length;
      bao?.(`  ✗ mẻ ${i / KENH_MOI_LAN_HOI + 1} hỏng: ${e instanceof Error ? e.message.slice(0, 80) : e}`);
    }
  }

  return { daXet: canXep.length, daXep, loi, theoNhom };
}
