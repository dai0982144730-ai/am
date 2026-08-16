/**
 * Đi tìm và thêm kênh nhạc thật vào kho.
 *
 *   npx tsx scripts/them-kenh-nhac.ts          # xem tìm được gì, chưa ghi
 *   npx tsx scripts/them-kenh-nhac.ts --ghi    # ghi thật vào kho
 *
 * ## Vì sao cần
 *
 * Đo ngày 2026-08-16: **không một nguồn nào trong kho được đánh dấu là nguồn
 * nhạc**. Cả nhánh Music sống nhờ mấy clip lọt vào tình cờ từ kênh khác, và cả
 * 15 "bản nhạc" hoá ra đều là Shorts 13–33 giây từ một kênh dance challenge.
 * Sau khi luật 5 phút dọn dẹp, mục Music còn đúng 1 bài.
 *
 * ## Bài học đã học: LOẠI KÊNH TOÀN SHORTS
 *
 * Đây là chỗ đáng chú ý nhất của script này. Thêm kênh nhạc mà không kiểm thì
 * lặp lại đúng chuyện cũ — YouTube đầy kênh nhạc chỉ đăng clip 15–30 giây.
 *
 * Nên trước khi nhận một kênh, script lấy thử vài video gần nhất rồi đo thời
 * lượng thật. Kênh nào không có nổi một video dài hơn ngưỡng thì bỏ, và in ra
 * lý do để biết chứ không im lặng.
 *
 * ## Chi phí hạn mức
 *
 * Mỗi lượt `search.list` tốn 100 đơn vị, đắt gấp trăm lần các lệnh khác. Năm
 * thể loại = 500 đơn vị trong ngân sách 10.000 mỗi ngày. Phần kiểm tra kênh
 * dùng `channels.list` và `videos.list`, mỗi lượt 1 đơn vị — không đáng kể.
 */

import "dotenv/config";

import { prisma } from "../src/lib/db/prisma";
import { goiYouTube } from "../src/lib/youtube/goiApi";
import { docThoiLuong } from "../src/lib/youtube/quetKenh";
import { xemTinhHinh } from "../src/lib/youtube/hanMuc";

/**
 * Video dài hơn ngần này mới được tính là "nhạc thật".
 *
 * Chọn 5 phút cho khớp với luật lọc của trang Khám phá — thêm kênh mà nội dung
 * của nó vẫn bị luật đó loại thì thêm để làm gì.
 */
const TOI_THIEU_GIAY = 300;

/** Trong số video kiểm thử, cần ít nhất ngần này bài đủ dài. */
const TOI_THIEU_SO_BAI_DAI = 2;

/**
 * Và phải chiếm ít nhất ngần này phần trăm.
 *
 * Đếm số tuyệt đối thôi thì chưa đủ: một kênh 2/8 bài dài vẫn lọt, mà 6 bài
 * còn lại là Shorts thì mỗi lần quét vẫn kéo về một đống clip vụn.
 */
const TOI_THIEU_TY_LE_DAI = 0.4;

/** Số video gần nhất lấy ra để đo. */
const SO_BAI_KIEM = 8;

/**
 * Ít hơn ngần này video thì không đủ căn cứ để kết luận, bỏ qua.
 *
 * Khác hẳn "kênh toàn Shorts" — đây là kênh chưa có gì để nhìn. Phải tách hai
 * lý do ra, kẻo in ra dòng "bỏ vì toàn Shorts" cho một kênh vừa đăng đúng một
 * video dài 107 phút, tức là nói sai sự thật.
 */
const TOI_THIEU_MAU = 3;

/**
 * Số người theo dõi tối thiểu.
 *
 * Lượt chạy thử đầu tiên trả về vài kênh 11, 22, 28 người theo dõi — với nhạc
 * tuyển chọn thì gần như chắc chắn là kênh đăng lại của người khác, vừa kém
 * vừa hay bị gỡ. Ngưỡng này KHÔNG áp cho các chuyên mục khác: một blog chuyên
 * gia ít người đọc vẫn có thể rất hay, còn kênh tổng hợp nhạc thì không.
 */
const TOI_THIEU_NGUOI_THEO_DOI = 1_000;

/** Số kênh xét cho mỗi thể loại. */
const SO_KENH_MOI_THE_LOAI = 4;

interface TruyTim {
  theLoai: string;
  tuKhoa: string;
}

/**
 * Từ khoá tìm kênh, viết theo cách các kênh đó tự đặt tên.
 *
 * Nhạc tập thể thao để tiếng Anh vì kênh ghi rõ số nhịp gần như đều là kênh
 * nước ngoài, và đây là nhánh KHÔNG cần hiểu lời — nghe nhịp chứ không nghe
 * chữ, nên rào ngôn ngữ không thành vấn đề. Nhạc vàng thì ngược lại.
 */
const CAC_TRUY_TIM: TruyTim[] = [
  { theLoai: "workout_bpm", tuKhoa: "running music 160 bpm workout mix" },
  { theLoai: "piano", tuKhoa: "relaxing piano music long play" },
  { theLoai: "guitar_rock", tuKhoa: "guitar rock instrumental full album" },

  // Hai thể loại dưới đây cần nhiều lượt tìm hơn, và đó là chuyện có thật chứ
  // không phải đoán: lượt chạy 2026-08-16 với một từ khoá mỗi loại thì **dance
  // và nhạc vàng không nhận được kênh nào** — cả tám kết quả trả về đều là kênh
  // đăng lại dưới 1.000 người theo dõi.
  //
  // Cách chữa là tìm theo TÊN NGƯỜI và TÊN CHƯƠNG TRÌNH thay vì tìm theo mô tả
  // chung chung. Kênh gốc bao giờ cũng mang tên riêng; kênh đăng lại thì đặt
  // tên theo từ khoá để hứng tìm kiếm.
  { theLoai: "dance", tuKhoa: "Defected Records house set" },
  { theLoai: "dance", tuKhoa: "Cercle live electronic set" },
  { theLoai: "nhac_vang", tuKhoa: "Chế Linh live" },
  { theLoai: "nhac_vang", tuKhoa: "Thuý Nga Paris By Night bolero" },
  { theLoai: "nhac_vang", tuKhoa: "Lệ Quyên bolero album" },
];

interface KenhTim {
  id: string;
  ten: string;
}

interface KetQuaSearch {
  items?: { snippet?: { channelId?: string; channelTitle?: string } }[];
}

interface KetQuaChannels {
  items?: {
    id?: string;
    snippet?: { title?: string };
    statistics?: { subscriberCount?: string };
    contentDetails?: { relatedPlaylists?: { uploads?: string } };
  }[];
}

interface KetQuaPlaylist {
  items?: { snippet?: { resourceId?: { videoId?: string } } }[];
}

interface KetQuaVideos {
  items?: { contentDetails?: { duration?: string } }[];
}

async function timKenh(tuKhoa: string): Promise<KenhTim[]> {
  const kq = await goiYouTube<KetQuaSearch>("search.list", "search", {
    part: "snippet",
    q: tuKhoa,
    type: "channel",
    maxResults: SO_KENH_MOI_THE_LOAI,
  });

  const thay = new Map<string, string>();
  for (const m of kq.items ?? []) {
    const id = m.snippet?.channelId;
    if (id && !thay.has(id)) thay.set(id, m.snippet?.channelTitle ?? "(không rõ)");
  }
  return [...thay].map(([id, ten]) => ({ id, ten }));
}

interface HoSoKenh {
  ten: string;
  soTheoDoi: number | null;
  playlistTaiLen: string | null;
}

async function docHoSo(idKenh: string): Promise<HoSoKenh | null> {
  const kq = await goiYouTube<KetQuaChannels>("channels.list", "channels", {
    part: "snippet,statistics,contentDetails",
    id: idKenh,
  });
  const k = kq.items?.[0];
  if (!k) return null;
  return {
    ten: k.snippet?.title ?? "(không rõ)",
    soTheoDoi: k.statistics?.subscriberCount
      ? Number(k.statistics.subscriberCount)
      : null,
    playlistTaiLen: k.contentDetails?.relatedPlaylists?.uploads ?? null,
  };
}

/** Đo thời lượng vài video gần nhất — chốt chặn kênh toàn Shorts. */
async function doThoiLuong(playlist: string): Promise<number[]> {
  const ds = await goiYouTube<KetQuaPlaylist>(
    "playlistItems.list",
    "playlistItems",
    { part: "snippet", playlistId: playlist, maxResults: SO_BAI_KIEM },
  );

  const id = (ds.items ?? [])
    .map((m) => m.snippet?.resourceId?.videoId)
    .filter((v): v is string => Boolean(v));
  if (id.length === 0) return [];

  const chiTiet = await goiYouTube<KetQuaVideos>("videos.list", "videos", {
    part: "contentDetails",
    id: id.join(","),
  });

  return (chiTiet.items ?? [])
    .map((v) => docThoiLuong(v.contentDetails?.duration))
    .filter((g): g is number => g !== null);
}

async function main() {
  const ghiThat = process.argv.includes("--ghi");

  const truoc = await xemTinhHinh();
  console.log(`Hạn mức YouTube: đã dùng ${truoc.daDung}/${truoc.nganSach}`);
  console.log(
    `Dự kiến tốn thêm khoảng ${CAC_TRUY_TIM.length * 100 + CAC_TRUY_TIM.length * SO_KENH_MOI_THE_LOAI * 3} đơn vị\n`,
  );

  let soThem = 0;
  let soBoQua = 0;
  let soDaCo = 0;

  for (const truy of CAC_TRUY_TIM) {
    console.log(`\n── ${truy.theLoai} — tìm "${truy.tuKhoa}"`);

    let cacKenh: KenhTim[];
    try {
      cacKenh = await timKenh(truy.tuKhoa);
    } catch (e) {
      console.log(`   ✗ tìm hỏng: ${e instanceof Error ? e.message : e}`);
      continue;
    }

    for (const kenh of cacKenh) {
      const daCo = await prisma.source.findUnique({
        where: {
          type_externalId: { type: "youtube_channel", externalId: kenh.id },
        },
        select: { id: true, title: true, contentGroupHint: true },
      });
      if (daCo) {
        soDaCo += 1;
        console.log(`   • ${daCo.title.slice(0, 40)} — đã có trong kho`);
        continue;
      }

      const hoSo = await docHoSo(kenh.id);
      if (!hoSo?.playlistTaiLen) {
        soBoQua += 1;
        console.log(`   ✗ ${kenh.ten.slice(0, 40)} — không đọc được danh sách tải lên`);
        continue;
      }

      if (
        hoSo.soTheoDoi !== null &&
        hoSo.soTheoDoi < TOI_THIEU_NGUOI_THEO_DOI
      ) {
        soBoQua += 1;
        console.log(
          `   ✗ ${hoSo.ten.slice(0, 40)} — chỉ ${hoSo.soTheoDoi} người theo dõi, ` +
            `nhiều khả năng là kênh đăng lại. Bỏ.`,
        );
        continue;
      }

      const thoiLuong = await doThoiLuong(hoSo.playlistTaiLen);
      const baiDai = thoiLuong.filter((g) => g >= TOI_THIEU_GIAY);
      const daiNhat = thoiLuong.length ? Math.max(...thoiLuong) : 0;
      const tyLe = thoiLuong.length ? baiDai.length / thoiLuong.length : 0;

      if (thoiLuong.length < TOI_THIEU_MAU) {
        soBoQua += 1;
        console.log(
          `   ✗ ${hoSo.ten.slice(0, 40)} — mới có ${thoiLuong.length} video, ` +
            `chưa đủ căn cứ để kết luận. Bỏ.`,
        );
        continue;
      }

      if (baiDai.length < TOI_THIEU_SO_BAI_DAI || tyLe < TOI_THIEU_TY_LE_DAI) {
        soBoQua += 1;
        console.log(
          `   ✗ ${hoSo.ten.slice(0, 40)} — chỉ ${baiDai.length}/${thoiLuong.length} bài dài hơn 5 phút ` +
            `(dài nhất ${Math.round(daiNhat / 60)} phút). BỎ, kẻo lại đầy Shorts như lần trước.`,
        );
        continue;
      }

      const trungBinh = Math.round(
        baiDai.reduce((s, g) => s + g, 0) / baiDai.length / 60,
      );
      console.log(
        `   ✓ ${hoSo.ten.slice(0, 40)} — ${baiDai.length}/${thoiLuong.length} bài dài, ` +
          `trung bình ${trungBinh} phút` +
          (hoSo.soTheoDoi ? `, ${hoSo.soTheoDoi.toLocaleString("vi-VN")} người theo dõi` : ""),
      );

      if (ghiThat) {
        await prisma.source.create({
          data: {
            type: "youtube_channel",
            externalId: kenh.id,
            title: hoSo.ten,
            url: `https://www.youtube.com/channel/${kenh.id}`,
            subscriptionStatus: "not_subscribed",
            // Chỉ là GỢI Ý. Claude vẫn đọc từng bài rồi tự xếp — một kênh nhạc
            // vẫn có thể đăng video phỏng vấn, dán nhãn cứng theo nguồn là sai
            // ngay từ đầu.
            contentGroupHint: "music",
            followerCount: hoSo.soTheoDoi,
            uploadsPlaylistId: hoSo.playlistTaiLen,
          },
        });
      }
      soThem += 1;
    }
  }

  const sau = await xemTinhHinh();
  console.log("\n" + "=".repeat(58));
  console.log(`Thêm được:  ${soThem} kênh`);
  console.log(`Đã có sẵn:  ${soDaCo}`);
  console.log(`Bỏ qua:     ${soBoQua} (clip quá ngắn, quá ít video, hoặc kênh đăng lại)`);
  console.log(`Hạn mức đã dùng thêm: ${sau.daDung - truoc.daDung} đơn vị`);

  if (!ghiThat) {
    console.log("\nChưa ghi gì cả. Thêm --ghi để lưu thật.");
  } else if (soThem > 0) {
    console.log("\nTiếp theo: npx tsx scripts/quet-youtube.ts để lấy video về.");
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("Lỗi:", e instanceof Error ? e.message : e);
  await prisma.$disconnect();
  process.exit(1);
});
