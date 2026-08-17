/**
 * Tìm và thêm kênh YouTube nhạc dài thật vào kho — chạy tay khi cần bổ sung.
 *
 * VÌ SAO CẦN: đo được 2026-08-17, nhánh Music gần như không có gì để bày ra —
 * các kênh nhạc trước đó (`3 Fingers`, ...) hoá ra đăng toàn YouTube Shorts
 * thử thách nhảy 17–33 giây, đã bị chặn bởi luật cấm Shorts <60 giây thêm
 * cùng ngày. Việc cần làm không phải sửa thêm bộ lọc, mà là bổ sung NGUỒN
 * thật đăng nhạc dài — mix tập luyện, playlist piano, nhạc vàng, v.v.
 *
 * CÁCH LÀM: tìm kênh (không phải video) qua `search.list(type=channel)` theo
 * từng thể loại đúng năm mục "Thể loại nhạc" đã có sẵn ở Khám phá
 * (`ThanhCuongDoQuet`/`ChipLoc.tsx`), lấy vài video gần nhất của mỗi kênh ứng
 * viên để xác nhận THẬT SỰ dài (trên 5 phút, tránh lặp lại đúng lỗi Shorts),
 * rồi thêm thẳng vào bảng `Source` với `contentGroupHint: "music"`. Từ đêm
 * sau, `quetVideoMoi` tự quét kênh này như mọi kênh nhạc khác — không cần
 * đụng gì thêm.
 *
 * ĐÂY LÀ GHI VÀO DATABASE CỦA AM, KHÔNG PHẢI GHI LÊN TÀI KHOẢN YOUTUBE THẬT —
 * không cần qua đề xuất/duyệt theo đúng nguyên tắc CLAUDE.md (chỉ ghi thật
 * lên YouTube mới cần duyệt).
 *
 * Chạy:
 *   npx tsx scripts/them-nguon-nhac.ts
 */
import "dotenv/config";

import { prisma } from "../src/lib/db/prisma";
import { GIA_LENH } from "../src/lib/youtube/giaLenh";
import { goiYouTube } from "../src/lib/youtube/goiApi";
import { docThoiLuong } from "../src/lib/youtube/quetKenh";

/** Khớp đúng năm mục "Thể loại nhạc" đã có trong `ChipLoc.tsx`. */
const TU_KHOA_THEO_THE_LOAI: Record<string, string[]> = {
  workout_bpm: ["nhạc tập gym không lời", "workout music mix nonstop"],
  dance: ["nonstop vinahouse remix", "edm mix nonstop"],
  piano: ["nhạc piano thư giãn không lời", "piano relax playlist"],
  guitar_rock: ["guitar rock instrumental mix", "rock guitar solo compilation"],
  nhac_vang: ["nhạc vàng tuyển chọn hay nhất", "bolero trữ tình tuyển chọn"],
};

/** Mỗi thể loại tìm tối đa ngần này kênh ứng viên — vừa đủ, không tốn quá tay. */
const TOI_DA_KENH_MOI_THE_LOAI = 2;

/** Video mẫu để xác nhận kênh thật sự đăng nhạc dài, không phải Shorts. */
const SO_VIDEO_MAU = 3;

/** Thời lượng trung bình tối thiểu để coi là "nhạc dài" — 5 phút. */
const NGUONG_DAI_TB_GIAY = 300;

interface KetQuaTimKenh {
  items?: { id?: { channelId?: string }; snippet?: { channelTitle?: string } }[];
}

interface ThongTinKenh {
  id?: string;
  snippet?: { title?: string };
  statistics?: { subscriberCount?: string };
  contentDetails?: { relatedPlaylists?: { uploads?: string } };
}

interface MucPlaylist {
  snippet?: { resourceId?: { videoId?: string } };
}

interface ChiTietVideo {
  id?: string;
  contentDetails?: { duration?: string };
  snippet?: { liveBroadcastContent?: string };
}

let hanMucDaTieu = 0;

async function timKenhTheoTuKhoa(tuKhoa: string): Promise<string[]> {
  const kq = await goiYouTube<KetQuaTimKenh>("search.list", "search", {
    part: "snippet",
    q: tuKhoa,
    type: "channel",
    maxResults: 5,
  });
  hanMucDaTieu += GIA_LENH["search.list"];
  return (kq.items ?? [])
    .map((i) => i.id?.channelId)
    .filter((id): id is string => Boolean(id));
}

/** Xem kênh có thật sự đăng nhạc dài không — sample vài video gần nhất. */
async function xacNhanNhacDai(uploadsPlaylistId: string): Promise<boolean> {
  const muc = await goiYouTube<{ items?: MucPlaylist[] }>(
    "playlistItems.list",
    "playlistItems",
    { part: "snippet", playlistId: uploadsPlaylistId, maxResults: SO_VIDEO_MAU },
  );
  hanMucDaTieu += GIA_LENH["playlistItems.list"];

  const idVideo = (muc.items ?? [])
    .map((m) => m.snippet?.resourceId?.videoId)
    .filter((id): id is string => Boolean(id));
  if (idVideo.length === 0) return false;

  const chiTiet = await goiYouTube<{ items?: ChiTietVideo[] }>("videos.list", "videos", {
    part: "contentDetails,snippet",
    id: idVideo.join(","),
  });
  hanMucDaTieu += GIA_LENH["videos.list"];

  const cacThoiLuong = (chiTiet.items ?? [])
    .filter((v) => v.snippet?.liveBroadcastContent === "none" || !v.snippet?.liveBroadcastContent)
    .map((v) => docThoiLuong(v.contentDetails?.duration))
    .filter((d): d is number => d !== null);

  if (cacThoiLuong.length === 0) return false;
  const trungBinh = cacThoiLuong.reduce((s, d) => s + d, 0) / cacThoiLuong.length;
  return trungBinh >= NGUONG_DAI_TB_GIAY;
}

async function main() {
  console.log("Bắt đầu tìm nguồn nhạc dài thật...\n");

  let tongThemMoi = 0;

  for (const [theLoai, cacTuKhoa] of Object.entries(TU_KHOA_THEO_THE_LOAI)) {
    console.log(`── ${theLoai} ──`);
    const idKenhUngVien = new Set<string>();

    for (const tuKhoa of cacTuKhoa) {
      const ids = await timKenhTheoTuKhoa(tuKhoa);
      for (const id of ids) idKenhUngVien.add(id);
    }

    // Bỏ kênh đã có trong kho
    const daCo = await prisma.source.findMany({
      where: { type: "youtube_channel", externalId: { in: [...idKenhUngVien] } },
      select: { externalId: true },
    });
    const daCoSet = new Set(daCo.map((n) => n.externalId));
    const canXet = [...idKenhUngVien].filter((id) => !daCoSet.has(id));

    if (canXet.length === 0) {
      console.log("  không có kênh mới nào để xét\n");
      continue;
    }

    const chiTietKenh = await goiYouTube<{ items?: ThongTinKenh[] }>("channels.list", "channels", {
      part: "snippet,statistics,contentDetails",
      id: canXet.join(","),
    });
    hanMucDaTieu += GIA_LENH["channels.list"];

    let themChoTheLoaiNay = 0;
    for (const kenh of chiTietKenh.items ?? []) {
      if (themChoTheLoaiNay >= TOI_DA_KENH_MOI_THE_LOAI) break;
      const uploadsId = kenh.contentDetails?.relatedPlaylists?.uploads;
      if (!kenh.id || !uploadsId) continue;

      const dai = await xacNhanNhacDai(uploadsId);
      if (!dai) {
        console.log(`  bỏ qua "${kenh.snippet?.title}" — video mẫu không đủ dài`);
        continue;
      }

      await prisma.source.create({
        data: {
          type: "youtube_channel",
          externalId: kenh.id,
          title: kenh.snippet?.title ?? "(kênh không rõ tên)",
          url: `https://www.youtube.com/channel/${kenh.id}`,
          followerCount: kenh.statistics?.subscriberCount
            ? Number(kenh.statistics.subscriberCount)
            : null,
          subscriptionStatus: "not_subscribed",
          contentGroupHint: "music",
          uploadsPlaylistId: uploadsId,
        },
      });

      console.log(`  + thêm "${kenh.snippet?.title}" (${kenh.statistics?.subscriberCount ?? "?"} theo dõi)`);
      themChoTheLoaiNay += 1;
      tongThemMoi += 1;
    }
    console.log();
  }

  console.log(`Xong. Thêm mới ${tongThemMoi} kênh nhạc. Tiêu ${hanMucDaTieu} đơn vị hạn mức.`);
  console.log("Đêm quét tới sẽ tự lấy video từ các kênh này.");
}

main()
  .catch((e) => {
    console.error("Lỗi:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
