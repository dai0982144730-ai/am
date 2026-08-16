/**
 * Phân loại lại những nội dung đã xếp bằng lời dặn cũ.
 *
 *   npx tsx scripts/phan-loai-lai.ts          # xem còn bao nhiêu bài cần làm
 *   npx tsx scripts/phan-loai-lai.ts 20       # làm lại 20 bài
 *   npx tsx scripts/phan-loai-lai.ts tat-ca   # làm lại hết, chạy tới khi xong
 *
 * ## Vì sao cần
 *
 * Lời dặn phân loại đã đổi hai lần, mỗi lần để lại một đống bản ghi sai:
 *
 *   - **191 bài xếp bằng bản v1**, tức trước khi có chuyên mục `khoa_hoc`.
 *     Mọi nội dung khoa học trong số đó buộc phải rơi vào "other" vì lúc ấy
 *     không có chỗ nào khác để đặt.
 *   - **226 bài xếp bằng bản v2**, bản mô tả "other" như một chuyên mục bình
 *     thường. Đó là lý do 304/417 bài — **73% những gì bày ra** — rơi vào đấy.
 *
 * Nên đây không phải chạy lại cho vui, mà là sửa hậu quả của hai lỗi nằm ngay
 * trong lời dặn.
 *
 * Bản v3 vá cả hai, đồng thời thêm trường lĩnh vực khoa học. Gộp chung một bản
 * là có chủ đích: tách ra thì 21 bài khoa học phải đọc lại lần thứ hai, mà mỗi
 * lần đọc tốn hơn chục giây.
 */

import "dotenv/config";

import { prisma } from "../src/lib/db/prisma";
import { PHIEN_BAN_HUONG_DAN } from "../src/lib/llm/phanLoai";
import { phanLoaiLaiHangLoat } from "../src/lib/llm/luuPhanLoai";

/** Mỗi mẻ ngần này bài. Nhỏ vừa đủ để thấy tiến độ, lớn vừa đủ để đỡ lệnh gọi. */
const MOI_ME = 20;

async function demConLai(): Promise<number> {
  return prisma.contentItem.count({
    where: { classification: { promptVersion: { not: PHIEN_BAN_HUONG_DAN } } },
  });
}

async function main() {
  const thamSo = process.argv[2];
  const conLai = await demConLai();

  console.log(`Lời dặn hiện tại: ${PHIEN_BAN_HUONG_DAN}`);
  console.log(`Còn ${conLai} bài xếp bằng lời dặn cũ.\n`);

  if (conLai === 0) {
    console.log("Không còn gì để làm.");
    await prisma.$disconnect();
    return;
  }

  if (!thamSo) {
    const cu = await prisma.contentClassification.groupBy({
      by: ["promptVersion"],
      _count: { _all: true },
    });
    console.log("Chia theo bản lời dặn:");
    for (const c of cu) console.log(`  ${c.promptVersion}: ${c._count._all}`);
    console.log("\nThêm một con số để chạy, hoặc 'tat-ca' để chạy tới khi xong.");
    await prisma.$disconnect();
    return;
  }

  const chayHet = thamSo === "tat-ca";
  const gioiHan = chayHet ? Number.POSITIVE_INFINITY : Number(thamSo);

  if (!chayHet && (!Number.isFinite(gioiHan) || gioiHan <= 0)) {
    console.error(`Không hiểu tham số "${thamSo}".`);
    await prisma.$disconnect();
    process.exit(1);
  }

  let daLam = 0;
  let tongCuu = 0;
  let tongDoi = 0;
  let tongVut = 0;
  let tongLoi = 0;
  const tongNhom: Record<string, number> = {};

  while (daLam < gioiHan) {
    const me = Math.min(MOI_ME, gioiHan - daLam);
    const kq = await phanLoaiLaiHangLoat(me, (dong) => console.log(dong));

    // Không còn bài nào để lấy — dừng, kẻo lặp vô hạn
    if (kq.daXet === 0) break;

    daLam += kq.daXet;
    tongCuu += kq.cuuVe;
    tongDoi += kq.doiNhom;
    tongVut += kq.giuNguyenVut;
    tongLoi += kq.loi;
    for (const [n, s] of Object.entries(kq.theoNhom)) {
      tongNhom[n] = (tongNhom[n] ?? 0) + s;
    }

    const con = await demConLai();
    console.log(
      `\n  … đã làm ${daLam}, cứu về ${tongCuu}, còn ${con} bài\n`,
    );
    if (con === 0) break;
  }

  console.log("\n" + "=".repeat(58));
  console.log(`Đã xét:        ${daLam}`);
  console.log(`Cứu về:        ${tongCuu}  (từng bị vứt, nay có chuyên mục thật)`);
  console.log(`Đổi chuyên mục: ${tongDoi}`);
  console.log(`Vẫn bị vứt:    ${tongVut}`);
  console.log(`Lỗi:           ${tongLoi}`);
  console.log("\nKết quả theo nhóm:");
  for (const [n, s] of Object.entries(tongNhom).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${n.padEnd(12)} ${s}`);
  }
  console.log(`\nCòn lại: ${await demConLai()} bài chưa làm.`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("Lỗi:", e instanceof Error ? e.message : e);
  await prisma.$disconnect();
  process.exit(1);
});
