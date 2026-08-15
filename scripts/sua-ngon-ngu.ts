/**
 * Chốt lại kết luận ngôn ngữ cho nội dung đã phân loại.
 *
 *   npx tsx scripts/sua-ngon-ngu.ts          # xem có bao nhiêu mục cần sửa
 *   npx tsx scripts/sua-ngon-ngu.ts 40       # sửa 40 mục
 *
 * ## Vì sao cần
 *
 * Cột `originalLanguage` đang chứa **hai loại giá trị khác nhau mà nhìn vào
 * không phân biệt được**:
 *
 *   - YouTube ghi mã thô: "en", "ko", "en-US", "nl-NL", "zxx"…
 *   - Claude ghi kết luận sau khi đọc: đúng "vi" hoặc "khac"
 *
 * Bộ lọc tiếng Việt chỉ ẩn thứ mang giá trị "khac" — cố ý như vậy, vì mã của
 * YouTube sai nhiều: đã gặp video giảng pháp tiếng Việt bị gắn "en", nhạc Việt
 * gắn "nl-NL", và một bài tiếng Việt gắn "en-US". Tin theo mã đó mà ẩn thì sẽ
 * ẩn nhầm hàng loạt nội dung tiếng Việt.
 *
 * Nhưng dòng ghi đè của Claude được thêm vào **sau** khi một phần kho đã được
 * phân loại, nên những mục cũ giữ nguyên mã YouTube và lọt qua lưới. Đo được
 * hậu quả: bốn video tiếng Anh nằm ở bốn vị trí đầu trang chủ, trong khi chủ dự
 * án nói rõ nội dung tiếng Anh là **vô giá trị** với mình.
 *
 * Kết luận ngôn ngữ của Claude lại không được lưu ở đâu cả — nó chỉ ghi thẳng
 * vào cột rồi thôi — nên không chép lại được, phải hỏi lại.
 *
 * ## Không sửa mù
 *
 * Script này **chỉ đụng vào mục đã phân loại rồi**. Mục chưa phân loại thì lượt
 * phân loại thường sẽ tự ghi đúng, không cần can thiệp.
 *
 * Chạy lại an toàn: mục nào đã mang "vi" hoặc "khac" thì bỏ qua.
 */

import "dotenv/config";

import { prisma } from "../src/lib/db/prisma";
import { phanLoaiMotNoiDung } from "../src/lib/llm/phanLoai";

/** Mục đã phân loại nhưng ngôn ngữ chưa phải kết luận của Claude. */
const CHUA_CHOT = {
  status: "classified" as const,
  classification: { isNot: null },
  OR: [
    { originalLanguage: null },
    { originalLanguage: { notIn: ["vi", "khac"] } },
  ],
};

async function main() {
  const soToiDa = Number(process.argv[2]) || 0;

  const conLai = await prisma.contentItem.count({ where: CHUA_CHOT });

  if (conLai === 0) {
    console.log("Mọi nội dung đã phân loại đều đã có kết luận ngôn ngữ.");
    await prisma.$disconnect();
    return;
  }

  if (soToiDa === 0) {
    console.log(`${conLai} mục chưa có kết luận ngôn ngữ của Claude.\n`);
    const nhom = await prisma.contentItem.groupBy({
      by: ["originalLanguage"],
      where: CHUA_CHOT,
      _count: true,
    });
    for (const n of nhom.sort((a, b) => b._count - a._count)) {
      console.log(
        `  ${String(n.originalLanguage ?? "(trống)").padEnd(10)} ${n._count}`,
      );
    }
    console.log(
      `\nChạy "npx tsx scripts/sua-ngon-ngu.ts ${conLai}" để hỏi Claude và chốt lại.`,
    );
    await prisma.$disconnect();
    return;
  }

  const canSua = await prisma.contentItem.findMany({
    where: CHUA_CHOT,
    orderBy: { publishedAt: "desc" },
    take: soToiDa,
    select: {
      id: true,
      title: true,
      description: true,
      durationSeconds: true,
      originalLanguage: true,
      source: { select: { title: true } },
      transcript: { select: { rawText: true, fetchStatus: true } },
    },
  });

  console.log(`Hỏi lại ngôn ngữ cho ${canSua.length} mục…\n`);

  let soViet = 0;
  let soKhac = 0;
  let hong = 0;

  for (const muc of canSua) {
    try {
      const kq = await phanLoaiMotNoiDung({
        tieuDe: muc.title,
        moTa: muc.description,
        tenKenh: muc.source.title,
        thoiLuongGiay: muc.durationSeconds,
        loiThoai:
          muc.transcript?.fetchStatus === "success"
            ? muc.transcript.rawText
            : null,
      });

      const laViet = kq.ketQua.ngonNguNoiDung === "vi";
      await prisma.contentItem.update({
        where: { id: muc.id },
        data: { originalLanguage: laViet ? "vi" : "khac" },
      });

      if (laViet) soViet += 1;
      else soKhac += 1;

      console.log(
        `  ${laViet ? "vi  " : "KHÁC"} (YouTube ghi ${String(
          muc.originalLanguage ?? "trống",
        ).padEnd(6)}) ${muc.title.slice(0, 48)}`,
      );
    } catch (e) {
      hong += 1;
      console.log(
        `  ✗ ${muc.title.slice(0, 46)} — ${e instanceof Error ? e.message : e}`,
      );
    }
  }

  console.log(`\n─────────────────────────────────────────`);
  console.log(`Tiếng Việt:        ${soViet}`);
  console.log(`Không tiếng Việt:  ${soKhac}  ← sẽ bị ẩn khỏi trang chính`);
  if (hong) console.log(`Hỏng:              ${hong}`);

  const sot = await prisma.contentItem.count({ where: CHUA_CHOT });
  console.log(`Còn lại chưa chốt: ${sot}`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("Lỗi:", e instanceof Error ? e.message : e);
  await prisma.$disconnect();
  process.exit(1);
});
