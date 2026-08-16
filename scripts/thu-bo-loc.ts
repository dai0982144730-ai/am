/**
 * Bấm thử mọi nút lọc của trang Khám phá, in ra số kết quả từng cái.
 *
 *   npx tsx scripts/thu-bo-loc.ts
 *
 * Dùng khi sửa `lib/nghiepVu/timVaLoc.ts` hoặc `components/ChipLoc.tsx`. Giao
 * diện trông đúng không có nghĩa truy vấn đúng — bộ lọc hỏng thường im lặng,
 * chỉ trả về ít kết quả hơn chứ không báo lỗi. Chạy cái này thì thấy ngay nút
 * nào ra 0 mà lẽ ra không được là 0.
 *
 * Đã bắt được một chuyện thật lúc dựng (2026-08-16): mục Music ra 0 kết quả.
 * Không phải lỗi lọc — cả 15 "bản nhạc" trong kho đều là Shorts 13–33 giây,
 * bị luật 5 phút loại đúng như thiết kế.
 */

import "dotenv/config";
import { prisma } from "../src/lib/db/prisma";
import { demTheoNhom, timNoiDung, type BoLoc } from "../src/lib/nghiepVu/timVaLoc";

async function thu(nhan: string, loc: BoLoc) {
  const kq = await timNoiDung(loc);
  const dau = kq.cacThe[0];
  console.log(`  ${nhan.padEnd(40)} ${String(kq.tongSo).padStart(4)}  ${dau ? dau.title.slice(0,40) : "—"}`);
  return kq.tongSo;
}

async function main() {
  console.log("=== Đếm theo chuyên mục (dùng cho chip) ===");
  const dem = await demTheoNhom();
  for (const [k, v] of Object.entries(dem)) console.log(`  ${k.padEnd(12)} ${v}`);
  console.log(`  CÓ 'other' không? ${"other" in dem ? "CÓ — SAI" : "không — đúng"}`);

  // Con số trên chip là một LỜI HỨA: bấm vào sẽ thấy đúng chừng đó. Kiểm thẳng.
  console.log("\n=== Chip có nói dối không? ===");
  for (const [ma, so] of Object.entries(dem)) {
    const that = (await timNoiDung({ nhom: ma as never })).tongSo;
    const khop = so === that;
    console.log(`  ${ma.padEnd(12)} chip ${String(so).padStart(3)} · danh sách ${String(that).padStart(3)}  ${khop ? "khớp" : "LỆCH — SAI"}`);
  }

  console.log("\n=== Luật 5 phút ===");
  const duoi5 = await prisma.contentItem.count({
    where: { status: "classified", durationSeconds: { lt: 300, not: null } },
  });
  const tong = await thu("Tất cả (không lọc gì)", {});
  console.log(`  Trong kho có ${duoi5} clip ngắn hơn 5 phút — phải KHÔNG nằm trong ${tong} kết quả trên`);

  console.log("\n=== Bộ lọc chung ===");
  await thu("Thời gian: dưới 15 phút", { thoiGian: "duoi15" });
  await thu("Thời gian: trên 30 phút", { thoiGian: "tren30" });
  await thu("Thời gian: trên 45 phút", { thoiGian: "tren45" });
  await thu("Kênh theo dõi", { kenh: "theo_doi" });
  await thu("Kênh mới", { kenh: "moi" });
  await thu("Nguồn: YouTube", { nguon: "youtube" });
  await thu("Nguồn: Podcast & SoundCloud", { nguon: "podcast" });
  await thu("Nguồn: Blog & Diễn đàn", { nguon: "blog" });
  await thu("Tiếng Việt: giọng gốc", { tiengViet: "goc" });
  await thu("Tiếng Việt: thuyết minh lại", { tiengViet: "thuyet_minh" });

  console.log("\n=== Sắp xếp ===");
  await thu("Mới nhất trước", { sapXep: "moi_nhat" });
  await thu("Điểm cao trước", { sapXep: "diem_cao" });
  await thu("Tỷ lệ thích cao", { sapXep: "thich_cao" });
  await thu("Tỷ lệ bình luận cao", { sapXep: "binh_luan_cao" });

  console.log("\n=== Bộ lọc riêng ===");
  await thu("AI", { nhom: "ai" });
  await thu("AI › tin Claude", { nhom: "ai", aiChuDe: "claude_news" });
  await thu("Triết học", { nhom: "triet_hoc" });
  await thu("Triết học › Phật giáo Nguyên thuỷ", { nhom: "triet_hoc", thTruongPhai: "phat_giao_nguyen_thuy" });
  await thu("Triết học › giảng pháp", { nhom: "triet_hoc", thDang: "giang_phap" });
  await thu("Truyện", { nhom: "truyen" });
  await thu("Truyện › kinh dị", { nhom: "truyen", trTheLoai: "kinh_di" });
  await thu("Truyện › dịch Trung Quốc", { nhom: "truyen", trXuatXu: "dich_trung_quoc" });
  await thu("Music", { nhom: "music" });
  await thu("Music › nhạc vàng", { nhom: "music", msTheLoai: "nhac_vang" });
  await thu("Khoa học", { nhom: "khoa_hoc" });
  await thu("Khoa học › y học", { nhom: "khoa_hoc", khLinhVuc: "y_hoc_suc_khoe" });
  await thu("Ngẫu hứng", { nhom: "ngau_hung" });

  console.log("\n=== Kết hợp nhiều tầng ===");
  await thu("Triết học + giảng pháp + trên 30 phút", { nhom: "triet_hoc", thDang: "giang_phap", thoiGian: "tren30" });

  await prisma.$disconnect();
}
main().catch(async e => { console.error(e); await prisma.$disconnect(); process.exit(1); });
