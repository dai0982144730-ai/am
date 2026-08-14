/**
 * Thử gọi YouTube API và kiểm tra bộ đếm hạn mức.
 *
 *   npx tsx scripts/thu-youtube.ts
 *
 * Chỉ gọi dữ liệu công khai bằng khoá API, không cần đăng nhập. Mục đích là
 * xác nhận ba việc chạy đúng: gọi được API, hạn mức được ghi vào database, và
 * lỗi được dịch sang tiếng Việt.
 */

import "dotenv/config";

import { goiYouTube } from "../src/lib/youtube/goiApi";
import { xemTinhHinh } from "../src/lib/youtube/hanMuc";

interface KenhYouTube {
  id: string;
  snippet?: { title?: string; publishedAt?: string };
  statistics?: { subscriberCount?: string; videoCount?: string };
  contentDetails?: { relatedPlaylists?: { uploads?: string } };
}

async function main() {
  const truoc = await xemTinhHinh();
  console.log(
    `Hạn mức trước khi gọi: đã dùng ${truoc.daDung}/${truoc.nganSach} đơn vị\n`,
  );

  // Kênh Anthropic — lấy luôn id playlist "uploads" để sau này quét video mới
  // với giá 1 đơn vị thay vì 100.
  const ketQua = await goiYouTube<{ items?: KenhYouTube[] }>(
    "channels.list",
    "channels",
    {
      part: "snippet,statistics,contentDetails",
      forHandle: "@anthropic-ai",
    },
  );

  const kenh = ketQua.items?.[0];
  if (!kenh) {
    console.log("Không tìm thấy kênh.");
  } else {
    console.log("Kênh lấy được:");
    console.log(`  Tên:            ${kenh.snippet?.title}`);
    console.log(`  Id kênh:        ${kenh.id}`);
    console.log(`  Người đăng ký:  ${kenh.statistics?.subscriberCount}`);
    console.log(`  Số video:       ${kenh.statistics?.videoCount}`);
    console.log(
      `  Playlist uploads: ${kenh.contentDetails?.relatedPlaylists?.uploads}`,
    );
  }

  // Bộ đếm hạn mức ghi bất đồng bộ, chờ một nhịp cho nó kịp vào database
  await new Promise((nghi) => setTimeout(nghi, 1500));

  const sau = await xemTinhHinh();
  console.log(
    `\nHạn mức sau khi gọi: đã dùng ${sau.daDung}/${sau.nganSach} đơn vị ` +
      `(tăng ${sau.daDung - truoc.daDung})`,
  );
  console.log(`Còn lại: ${sau.conLai} đơn vị`);
  console.log(`Đã chạm mốc ngắt tìm kiếm chưa: ${sau.daChamMocNgat ? "rồi" : "chưa"}`);
}

main().catch((loi) => {
  console.error("\nLỗi:", loi instanceof Error ? loi.message : loi);
  process.exit(1);
});
