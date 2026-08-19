/**
 * Gieo danh sách chủ đề con ban đầu — đúng những chủ đề trước đây khoá cứng
 * trong code, để chuyển sang cấu hình được mà không mất gì.
 *
 * Chạy lại nhiều lần vô hại: cái đã có thì bỏ qua, không đè lên sửa đổi của
 * chủ nhà.
 *
 *     npx tsx scripts/gieo-chu-de-con.ts
 */
import "dotenv/config";
import { prisma } from "@/lib/db/prisma";
import {
  CHUYEN_MUC_CO_CHU_DE,
  gieoChuDeConLanDau,
  layChuDeCon,
} from "@/lib/nghiepVu/chuDeCon";

async function main() {
  const them = await gieoChuDeConLanDau();
  console.log(`Đã thêm ${them} chủ đề con.\n`);
  for (const m of CHUYEN_MUC_CO_CHU_DE) {
    const cac = await layChuDeCon(m, true);
    console.log(`${m.padEnd(12)} ${cac.map((c) => c.ten).join(" · ")}`);
  }
}
main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
