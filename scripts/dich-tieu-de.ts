/**
 * Dịch tiêu đề tiếng nước ngoài sang tiếng Việt.
 *
 *   npx tsx scripts/dich-tieu-de.ts        # xem còn bao nhiêu bài
 *   npx tsx scripts/dich-tieu-de.ts 60     # dịch 60 bài
 *
 * ## Vì sao cần
 *
 * Chủ dự án nói thẳng: *"nhiều bài nguồn nước ngoài tiêu đề để nguyên tiếng
 * Anh thì bố ai mà đọc được?"*. Đúng — thẻ nội dung đã biết ưu tiên tiêu đề
 * tiếng Việt rồi, nhưng 44 bài chưa hề có tiêu đề tiếng Việt nào để mà hiện.
 *
 * Bước phân loại vốn có trả về tiêu đề dịch, nhưng những bài phân loại từ trước
 * khi có trường đó thì bỏ trống, và lượt bù điểm chất lượng chạy sau lại chỉ
 * nhắm vào bài thiếu điểm chứ không nhắm vào bài thiếu tiêu đề.
 *
 * ## Dịch cả loạt trong một lần gọi
 *
 * Dịch một cái tiêu đề mà phải gọi Claude một lần thì phí: tiêu đề chỉ vài chục
 * chữ, còn lời dặn đi kèm dài gấp mấy lần. Gộp 25 tiêu đề vào một lần gọi thì
 * 44 bài chỉ tốn hai lần thay vì bốn mươi tư.
 */

import "dotenv/config";

import { prisma } from "../src/lib/db/prisma";
import { goiClaudeCli } from "../src/lib/llm/claudeCli";

/** Số tiêu đề gộp vào một lần gọi. */
const MOI_LUOT = 25;

const CHUA_DICH = {
  status: "classified" as const,
  originalLanguage: "khac",
  classification: { is: { titleVi: null } },
};

const LOI_DAN = `Bạn dịch tiêu đề nội dung sang tiếng Việt cho một ứng dụng nghe–nhìn cá nhân.

QUY TẮC:
- Dịch tự nhiên như người Việt đặt tên, KHÔNG dịch máy móc từng chữ.
- Giữ nguyên tên riêng và thuật ngữ đã quen dùng bằng tiếng Anh: AI, GPU, token, GPT, Gemini, Claude, OpenAI, podcast…
- Bỏ hết hashtag, emoji, và mấy cụm câu khách kiểu "xem ngay", "hot".
- Giữ độ dài tương đương bản gốc, đừng thêm thắt.
- Tiêu đề nào vốn ĐÃ là tiếng Việt thì chép lại y nguyên.

TRẢ VỀ: đúng một mảng JSON các chuỗi, cùng số phần tử và cùng thứ tự với danh sách nhận được. Không viết gì thêm ngoài mảng JSON đó.`;

/** Bóc mảng JSON ra khỏi câu trả lời, kể cả khi Claude bọc trong khối mã. */
function bocMang(tho: string): string[] | null {
  const chu = tho.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  const dau = chu.indexOf("[");
  const cuoi = chu.lastIndexOf("]");
  if (dau === -1 || cuoi === -1) return null;

  try {
    const m = JSON.parse(chu.slice(dau, cuoi + 1));
    if (!Array.isArray(m)) return null;
    return m.map((x) => (typeof x === "string" ? x : ""));
  } catch {
    return null;
  }
}

async function main() {
  const soToiDa = Number(process.argv[2]) || 0;
  const conLai = await prisma.contentItem.count({ where: CHUA_DICH });

  if (conLai === 0) {
    console.log("Mọi bài tiếng nước ngoài đều đã có tiêu đề tiếng Việt.");
    await prisma.$disconnect();
    return;
  }

  if (soToiDa === 0) {
    console.log(`${conLai} bài tiếng nước ngoài còn để tiêu đề gốc.`);
    console.log(`Chạy "npx tsx scripts/dich-tieu-de.ts ${conLai}" để dịch.`);
    await prisma.$disconnect();
    return;
  }

  const canDich = await prisma.contentItem.findMany({
    where: CHUA_DICH,
    orderBy: { publishedAt: "desc" },
    take: soToiDa,
    select: { id: true, title: true },
  });

  console.log(`Dịch ${canDich.length} tiêu đề, mỗi lượt ${MOI_LUOT} cái…\n`);

  let xong = 0;
  let hong = 0;

  for (let i = 0; i < canDich.length; i += MOI_LUOT) {
    const lo = canDich.slice(i, i + MOI_LUOT);
    const danhSach = lo.map((m, k) => `${k + 1}. ${m.title}`).join("\n");

    try {
      const goi = await goiClaudeCli({
        loiDan: LOI_DAN,
        cauHoi: `Dịch ${lo.length} tiêu đề sau:\n\n${danhSach}`,
      });

      const ra = bocMang(goi.vanBan);
      if (!ra || ra.length !== lo.length) {
        // Lệch số phần tử thì bỏ cả lô: gán nhầm tiêu đề bài này cho bài kia
        // còn tệ hơn là để nguyên tiếng Anh
        console.log(
          `  ✗ Lô ${i / MOI_LUOT + 1}: nhận về ${ra?.length ?? "không phải mảng"} mục, cần ${lo.length} — bỏ qua`,
        );
        hong += lo.length;
        continue;
      }

      for (const [k, m] of lo.entries()) {
        const moi = ra[k]?.trim();
        if (!moi) continue;
        await prisma.contentClassification.update({
          where: { contentItemId: m.id },
          data: { titleVi: moi },
        });
        console.log(`  ${moi.slice(0, 58)}`);
        xong += 1;
      }
    } catch (e) {
      hong += lo.length;
      console.log(
        `  ✗ Lô ${i / MOI_LUOT + 1} hỏng: ${e instanceof Error ? e.message : e}`,
      );
    }
  }

  const sot = await prisma.contentItem.count({ where: CHUA_DICH });
  console.log(`\nXong ${xong}, hỏng ${hong}. Còn ${sot} bài chưa dịch tiêu đề.`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("Lỗi:", e instanceof Error ? e.message : e);
  await prisma.$disconnect();
  process.exit(1);
});
