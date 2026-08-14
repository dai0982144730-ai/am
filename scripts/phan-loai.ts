/**
 * Nhờ Claude phân loại các nội dung đang chờ trong kho.
 *
 *   npx tsx scripts/phan-loai.ts --so 5     # chạy thử 5 video trước
 *   npx tsx scripts/phan-loai.ts --so 200   # rồi chạy nhiều
 *
 * Chạy lại an toàn: nội dung đã phân loại rồi thì bỏ qua.
 *
 * Đây là bước TỐN TIỀN, nên script luôn in ra chi phí ước tính ở cuối. Lần đầu
 * hãy chạy với `--so 5` xem kết quả có hợp lý không rồi mới chạy cả kho.
 */

import "dotenv/config";

import { prisma } from "../src/lib/db/prisma";
import { phanLoaiHangLoat } from "../src/lib/llm/luuPhanLoai";

/** Giá Haiku 4.5, đô la Mỹ cho mỗi triệu token. Đổi khi dùng model khác. */
const GIA = { vao: 1.0, ra: 5.0, nhoLai: 0.1 };

function thamSo(ten: string): number | undefined {
  const vt = process.argv.indexOf(`--${ten}`);
  if (vt === -1) return undefined;
  const so = Number(process.argv[vt + 1]);
  return Number.isFinite(so) && so > 0 ? so : undefined;
}

const TEN_NHOM: Record<string, string> = {
  ai: "AI",
  triet_hoc: "Triết học",
  truyen: "Truyện",
  music: "Nhạc",
  other: "Khác",
};

async function main() {
  const gioiHan = thamSo("so") ?? 20;

  const conCho = await prisma.contentItem.count({
    where: {
      status: { in: ["pending_classification", "transcript_unavailable"] },
      classification: null,
    },
  });
  console.log(`Đang chờ phân loại: ${conCho} nội dung`);
  console.log(`Lần này xử lý tối đa: ${gioiHan}\n`);

  if (conCho === 0) {
    console.log("Không có gì để làm. Chạy scripts/lay-loi-thoai.ts trước.");
    return;
  }

  const kq = await phanLoaiHangLoat(gioiHan, (dong) => console.log(dong));

  console.log(`\nĐã xét ${kq.daXet} — thành công ${kq.thanhCong}, lỗi ${kq.loi}`);

  if (kq.thanhCong > 0) {
    console.log("\nXếp theo chuyên mục:");
    for (const [nhom, so] of Object.entries(kq.theoNhom).sort(
      (a, b) => b[1] - a[1],
    )) {
      console.log(`  ${(TEN_NHOM[nhom] ?? nhom).padEnd(12)} ${so}`);
    }

    const tienVao = (kq.tongTokenVao / 1e6) * GIA.vao;
    const tienRa = (kq.tongTokenRa / 1e6) * GIA.ra;
    const tienNhoLai = (kq.tongTokenNhoLai / 1e6) * GIA.nhoLai;
    const tong = tienVao + tienRa + tienNhoLai;

    console.log("\nChi phí lần chạy này:");
    console.log(
      `  Token đọc vào:    ${kq.tongTokenVao.toLocaleString("vi-VN").padStart(9)}  ~${tienVao.toFixed(4)} đô`,
    );
    console.log(
      `  Token nhớ lại:    ${kq.tongTokenNhoLai.toLocaleString("vi-VN").padStart(9)}  ~${tienNhoLai.toFixed(4)} đô  (rẻ hơn 10 lần)`,
    );
    console.log(
      `  Token trả lời:    ${kq.tongTokenRa.toLocaleString("vi-VN").padStart(9)}  ~${tienRa.toFixed(4)} đô`,
    );
    console.log(`  Tổng:                       ~${tong.toFixed(4)} đô`);
    console.log(
      `  Trung bình mỗi nội dung:    ~${(tong / kq.thanhCong).toFixed(5)} đô`,
    );

    const conLai = conCho - kq.thanhCong;
    if (conLai > 0) {
      console.log(
        `\nCòn ${conLai} nội dung chưa phân loại — ước tính thêm ~${((tong / kq.thanhCong) * conLai).toFixed(2)} đô.`,
      );
    }
  }
}

main().catch((loi) => {
  console.error("\n✗ Lỗi:", loi instanceof Error ? loi.message : loi);
  process.exit(1);
});
