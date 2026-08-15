/**
 * Bù điểm chất lượng cho nội dung đã phân loại trước khi có trường này.
 *
 *   npx tsx scripts/bu-diem-chat-luong.ts [số lượng]
 *
 * VÌ SAO CẦN: trường `contentQualityScore` mới thêm ngày 2026-08-15. Nội dung
 * phân loại trước đó không có nó, mà **với blog và diễn đàn thì đó là trụ tín
 * hiệu duy nhất dùng được** — chúng không có lượt xem, lượt thích hay bình luận
 * công khai nào. Thiếu nó thì mọi bài blog cùng tầng uy tín ra đúng một điểm
 * như nhau, không xếp hạng được.
 *
 * Ưu tiên blog và diễn đàn trước, vì đó là chỗ thiếu nó thì hỏng hẳn. Video
 * YouTube vẫn còn ba trụ kia nên chỉ hơi kém chính xác, không hỏng.
 *
 * Chạy được nhiều lần: mục nào đã có điểm thì bỏ qua.
 */

import "dotenv/config";

import { prisma } from "../src/lib/db/prisma";
import { phanLoaiMotNoiDung } from "../src/lib/llm/phanLoai";

async function main() {
  const soToiDa = Number(process.argv[2]) || 20;

  // Lấy blog và diễn đàn thành MỘT LƯỢT RIÊNG, không xếp thứ tự rồi cắt.
  //
  // Đã vấp: bản đầu dùng `orderBy: { source: { type: "asc" } }` tưởng sẽ đưa
  // "blog_feed" lên trước "youtube_channel" theo bảng chữ cái. Nhưng Postgres
  // sắp xếp kiểu enum theo **thứ tự khai báo trong schema**, mà
  // `youtube_channel` khai đầu tiên — nên nó chạy 16 video YouTube và không
  // đụng tới bài blog nào, đúng thứ cần bù nhất.
  const dieuKienThieu = {
    status: "classified" as const,
    classification: { isNot: null, is: { contentQualityScore: null } },
  };

  const truongCanLay = {
    id: true,
    title: true,
    description: true,
    durationSeconds: true,
    source: { select: { title: true, type: true } },
    transcript: { select: { rawText: true, fetchStatus: true } },
  };

  const uuTien = await prisma.contentItem.findMany({
    where: {
      ...dieuKienThieu,
      source: { type: { in: ["blog_feed", "forum_community"] } },
    },
    orderBy: { publishedAt: "desc" },
    take: soToiDa,
    select: truongCanLay,
  });

  const conThieu = soToiDa - uuTien.length;
  const phanConLai =
    conThieu > 0
      ? await prisma.contentItem.findMany({
          where: {
            ...dieuKienThieu,
            source: { type: { notIn: ["blog_feed", "forum_community"] } },
          },
          orderBy: { publishedAt: "desc" },
          take: conThieu,
          select: truongCanLay,
        })
      : [];

  const canBu = [...uuTien, ...phanConLai];

  if (canBu.length === 0) {
    console.log("Mọi nội dung đã có điểm chất lượng.");
    await prisma.$disconnect();
    return;
  }

  console.log(`Bù điểm cho ${canBu.length} nội dung…\n`);

  let xong = 0;
  let hong = 0;

  for (const muc of canBu) {
    try {
      const kq = await phanLoaiMotNoiDung({
        tieuDe: muc.title,
        moTa: muc.description,
        tenKenh: muc.source.title,
        thoiLuongGiay: muc.durationSeconds,
        loiThoai: muc.transcript?.rawText ?? null,
      });

      await prisma.contentClassification.update({
        where: { contentItemId: muc.id },
        data: {
          contentQualityScore: kq.ketQua.diemChatLuong,
          contentQualityNotes: kq.ketQua.nhanXetChatLuong,
          titleVi: kq.ketQua.tieuDeTiengViet,
        },
      });

      console.log(
        `  ${kq.ketQua.diemChatLuong.toFixed(2)} ${
          kq.ketQua.tieuDeTiengViet
            ? `→ ${kq.ketQua.tieuDeTiengViet.slice(0, 60)}`
            : muc.title.slice(0, 60)
        }`,
      );
      xong += 1;
    } catch (e) {
      console.log(
        `  ✗ ${muc.title.slice(0, 50)} — ${e instanceof Error ? e.message : String(e)}`,
      );
      hong += 1;
    }
  }

  const conLai = await prisma.contentItem.count({
    where: {
      status: "classified",
      classification: { isNot: null, is: { contentQualityScore: null } },
    },
  });

  console.log(`\nXong ${xong}, hỏng ${hong}. Còn ${conLai} nội dung chưa bù.`);
  console.log("Chạy `npx tsx scripts/cham-diem.ts` để tính lại điểm.");

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
