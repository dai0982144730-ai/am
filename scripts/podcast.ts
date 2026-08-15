/**
 * Tìm, thêm và quét kênh podcast.
 *
 *   npx tsx scripts/podcast.ts tim "Sunhuyn"          # tìm theo tên
 *   npx tsx scripts/podcast.ts them <đường-dẫn-feed>  # thêm một kênh
 *   npx tsx scripts/podcast.ts danhsach               # xem các kênh đã thêm
 *   npx tsx scripts/podcast.ts quet                   # lấy tập mới về kho
 *   npx tsx scripts/podcast.ts quet --tap 20 --ngay 60
 *   npx tsx scripts/podcast.ts bo <đường-dẫn-feed>    # bỏ một kênh
 *
 * Trong web thì mấy việc này làm bằng giao diện ở trang Cài đặt. Script này để
 * chạy hàng loạt và để kiểm khi có trục trặc.
 */

import "dotenv/config";

import { prisma } from "../src/lib/db/prisma";
import { docFeedPodcast, laTiengViet, timPodcast } from "../src/lib/nguon/podcast";
import { themKenhPodcast, quetPodcast } from "../src/lib/nguon/quetPodcast";

function thamSo(ten: string): number | undefined {
  const vt = process.argv.indexOf(`--${ten}`);
  if (vt === -1) return undefined;
  const so = Number(process.argv[vt + 1]);
  return Number.isFinite(so) && so > 0 ? so : undefined;
}

async function tim(tuKhoa: string) {
  if (!tuKhoa) {
    console.log('Thiếu tên cần tìm. Ví dụ: npx tsx scripts/podcast.ts tim "Sunhuyn"');
    return;
  }

  console.log(`Tìm podcast tên "${tuKhoa}"…\n`);
  const kq = await timPodcast(tuKhoa);

  if (kq.length === 0) {
    console.log("Không tìm thấy kênh nào.");
    return;
  }

  for (const k of kq) {
    console.log(`${k.ten}${k.tacGia ? ` — ${k.tacGia}` : ""}`);
    console.log(`  ${k.soTap ?? "?"} tập${k.theLoai ? ` · ${k.theLoai}` : ""}`);
    console.log(`  ${k.duongDanFeed}\n`);
  }

  console.log("Thêm kênh nào thì chạy:");
  console.log(`  npx tsx scripts/podcast.ts them "${kq[0].duongDanFeed}"`);
}

async function them(duongDan: string) {
  if (!duongDan) {
    console.log("Thiếu đường dẫn feed.");
    return;
  }

  const kq = await themKenhPodcast(duongDan);
  console.log(kq.thongDiep);
  if (kq.canhBaoNgonNgu) console.log(`\n⚠ ${kq.canhBaoNgonNgu}`);
  if (kq.ok) console.log('\nChạy "npx tsx scripts/podcast.ts quet" để lấy tập về.');
}

async function danhSach() {
  const cac = await prisma.source.findMany({
    where: { type: "podcast_rss" },
    select: {
      title: true,
      externalId: true,
      lastCrawledAt: true,
      _count: { select: { contentItems: true } },
    },
    orderBy: { title: "asc" },
  });

  if (cac.length === 0) {
    console.log("Chưa thêm kênh podcast nào.");
    return;
  }

  console.log(`${cac.length} kênh podcast:\n`);
  for (const k of cac) {
    const quetLuc = k.lastCrawledAt
      ? k.lastCrawledAt.toLocaleString("vi-VN")
      : "chưa quét lần nào";
    console.log(`${k.title}`);
    console.log(`  ${k._count.contentItems} tập trong kho · ${quetLuc}`);
    console.log(`  ${k.externalId}\n`);
  }
}

async function bo(duongDan: string) {
  if (!duongDan) {
    console.log("Thiếu đường dẫn feed.");
    return;
  }

  const nguon = await prisma.source.findUnique({
    where: { type_externalId: { type: "podcast_rss", externalId: duongDan } },
    select: { id: true, title: true, _count: { select: { contentItems: true } } },
  });

  if (!nguon) {
    console.log("Không có kênh nào với đường dẫn đó.");
    return;
  }

  await prisma.source.delete({ where: { id: nguon.id } });
  console.log(`Đã bỏ "${nguon.title}" cùng ${nguon._count.contentItems} tập.`);
}

async function quet() {
  const soTap = thamSo("tap") ?? 10;
  const soNgay = thamSo("ngay") ?? 30;

  console.log(`Quét tối đa ${soTap} tập mỗi kênh, trong ${soNgay} ngày gần đây…`);
  const kq = await quetPodcast(soTap, soNgay, (dong) => console.log(dong));

  console.log("\n─────────────────────────────────────────");
  console.log(`Kênh đã quét:      ${kq.soKenhQuet}`);
  console.log(`Tập đã xét:        ${kq.soTapXet}`);
  console.log(`Tập thêm vào kho:  ${kq.soTapThemMoi}`);
  console.log(`Trong đó có mô tả: ${kq.soCoMoTa}`);

  if (kq.kenhLoi.length) {
    console.log("\nKênh đọc không được:");
    for (const l of kq.kenhLoi) console.log(`  ✗ ${l.ten} — ${l.lyDo}`);
  }

  if (kq.soTapThemMoi > 0) {
    console.log('\nTiếp theo: "npx tsx scripts/phan-loai.ts" để xếp chuyên mục.');
  }
}

async function xem(duongDan: string) {
  const kenh = await docFeedPodcast(duongDan);
  console.log(`${kenh.ten}`);
  console.log(`  ngôn ngữ: ${kenh.ngonNgu ?? "không ghi"}${laTiengViet(kenh.ngonNgu) ? " (tiếng Việt)" : ""}`);
  console.log(`  ${kenh.cacTap.length} tập có file âm thanh\n`);
  for (const t of kenh.cacTap.slice(0, 5)) {
    const phut = t.giay ? `${Math.round(t.giay / 60)} phút` : "chưa rõ";
    console.log(`  · ${t.tieuDe.slice(0, 60)} — ${phut}`);
  }
}

async function main() {
  const lenh = process.argv[2];
  const doiSo = process.argv[3] ?? "";

  switch (lenh) {
    case "tim":
      await tim(doiSo);
      break;
    case "them":
      await them(doiSo);
      break;
    case "danhsach":
      await danhSach();
      break;
    case "quet":
      await quet();
      break;
    case "bo":
      await bo(doiSo);
      break;
    case "xem":
      await xem(doiSo);
      break;
    default:
      console.log(
        "Cách dùng:\n" +
          '  npx tsx scripts/podcast.ts tim "tên podcast"\n' +
          "  npx tsx scripts/podcast.ts them <đường-dẫn-feed>\n" +
          "  npx tsx scripts/podcast.ts xem <đường-dẫn-feed>\n" +
          "  npx tsx scripts/podcast.ts danhsach\n" +
          "  npx tsx scripts/podcast.ts quet [--tap 10] [--ngay 30]\n" +
          "  npx tsx scripts/podcast.ts bo <đường-dẫn-feed>",
      );
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("Lỗi:", e instanceof Error ? e.message : e);
  await prisma.$disconnect();
  process.exit(1);
});
