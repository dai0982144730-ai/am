/**
 * Nhập dữ liệu sẵn có trên tài khoản YouTube để dựng gu ngay từ ngày đầu.
 *
 * Đây là lời giải cho bài toán "ngày đầu chưa biết gì về người dùng": thay vì
 * gợi ý bừa vài hôm rồi mới học được, đọc luôn ba thứ đã có sẵn trong tài khoản.
 *
 * LƯU Ý QUAN TRỌNG — thứ KHÔNG lấy được:
 *
 *   - Lịch sử xem: Google chặn từ 2016, không có đường vòng hợp pháp nào.
 *   - Danh sách "Xem sau": bị chặn cùng đợt.
 *
 * Bù lại, app tự ghi lịch sử của chính nó (`ConsumptionEvent`), dữ liệu thực ra
 * còn giàu hơn — biết xem được bao lâu, bỏ ở phút nào, xem lại mấy lần.
 *
 * Ba thứ lấy được, xếp theo độ mạnh của tín hiệu:
 *
 *   1. Video đã thích — mạnh nhất, là hành động chủ động khen một nội dung cụ thể
 *   2. Video trong playlist tự lập — đã chọn lọc và sắp xếp có chủ đích
 *   3. Kênh đã đăng ký — yếu nhất, nhiều người đăng ký rồi để đó không xem
 *
 * Toàn bộ việc này rất rẻ: mỗi lệnh 1 đơn vị hạn mức, tổng thường dưới 20 đơn vị
 * trên ngân sách 10.000/ngày.
 */

import { prisma } from "@/lib/db/prisma";

import { goiHetTrang } from "./goiApi";

/**
 * Giới hạn số mục lấy về mỗi loại.
 *
 * Đủ để dựng bức tranh gu, mà không để một tài khoản đã thích hàng chục nghìn
 * video ngốn sạch hạn mức trong một lần nhập.
 */
const GIOI_HAN = {
  kenhDangKy: 500,
  videoDaThich: 500,
  playlist: 100,
  /** Số video lấy trong mỗi playlist */
  videoMoiPlaylist: 200,
} as const;

interface KenhDaDangKy {
  snippet?: {
    title?: string;
    resourceId?: { channelId?: string };
  };
}

interface VideoDaThich {
  id?: string;
  snippet?: { title?: string; channelTitle?: string };
}

interface PlaylistCuaToi {
  id?: string;
  snippet?: { title?: string };
  contentDetails?: { itemCount?: number };
}

interface MucTrongPlaylist {
  snippet?: {
    title?: string;
    videoOwnerChannelTitle?: string;
    resourceId?: { videoId?: string };
  };
}

export interface KetQuaNhap {
  kenhDangKy: number;
  videoDaThich: number;
  videoTrongPlaylist: number;
  soPlaylist: number;
  /** Những playlist không đọc được, kèm lý do */
  playlistLoi: { ten: string; lyDo: string }[];
}

/**
 * Nhập cả ba loại tín hiệu.
 *
 * Dùng `skipDuplicates` nên chạy lại nhiều lần vẫn an toàn: mục đã có thì bỏ
 * qua, chỉ thêm mục mới. Chạy lại sau vài tháng sẽ nhặt được những gì đã thích
 * thêm trong khoảng thời gian đó.
 */
export async function nhapTinHieuTaiKhoan(): Promise<KetQuaNhap> {
  const [kenhDangKy, videoDaThich] = await Promise.all([
    nhapKenhDaDangKy(),
    nhapVideoDaThich(),
  ]);

  const tuPlaylist = await nhapPlaylist();

  return {
    kenhDangKy,
    videoDaThich,
    videoTrongPlaylist: tuPlaylist.soVideo,
    soPlaylist: tuPlaylist.soPlaylist,
    playlistLoi: tuPlaylist.loi,
  };
}

/** Kênh đã đăng ký — tín hiệu yếu nhất nhưng cho biết vùng quan tâm rộng. */
export async function nhapKenhDaDangKy(): Promise<number> {
  const cacKenh = await goiHetTrang<KenhDaDangKy>(
    "subscriptions.list",
    "subscriptions",
    { part: "snippet", mine: "true" },
    GIOI_HAN.kenhDangKy,
    { canDangNhap: true },
  );

  const dong = cacKenh
    .map((kenh) => ({
      signalType: "subscription" as const,
      externalId: kenh.snippet?.resourceId?.channelId ?? "",
      title: kenh.snippet?.title ?? "(không rõ tên)",
      channelTitle: kenh.snippet?.title ?? null,
    }))
    .filter((d) => d.externalId);

  return await luuTinHieu(dong);
}

/** Video đã thích — tín hiệu gu mạnh nhất lấy được từ tài khoản. */
export async function nhapVideoDaThich(): Promise<number> {
  const cacVideo = await goiHetTrang<VideoDaThich>(
    "videos.list",
    "videos",
    { part: "snippet", myRating: "like" },
    GIOI_HAN.videoDaThich,
    { canDangNhap: true },
  );

  const dong = cacVideo
    .map((video) => ({
      signalType: "liked_video" as const,
      externalId: video.id ?? "",
      title: video.snippet?.title ?? "(không rõ tên)",
      channelTitle: video.snippet?.channelTitle ?? null,
    }))
    .filter((d) => d.externalId);

  return await luuTinHieu(dong);
}

/**
 * Video nằm trong các playlist tự lập.
 *
 * Một playlist hỏng không được làm chết cả lần nhập — playlist riêng tư hoặc
 * video đã bị gỡ là chuyện thường. Gom lỗi lại báo cuối cùng.
 */
async function nhapPlaylist(): Promise<{
  soPlaylist: number;
  soVideo: number;
  loi: { ten: string; lyDo: string }[];
}> {
  const cacPlaylist = await goiHetTrang<PlaylistCuaToi>(
    "playlists.list",
    "playlists",
    { part: "snippet,contentDetails", mine: "true" },
    GIOI_HAN.playlist,
    { canDangNhap: true },
  );

  let soVideo = 0;
  const loi: { ten: string; lyDo: string }[] = [];

  for (const playlist of cacPlaylist) {
    const ten = playlist.snippet?.title ?? "(không rõ tên)";
    if (!playlist.id) continue;

    // Playlist rỗng thì bỏ qua luôn, khỏi tốn một đơn vị hạn mức
    if (playlist.contentDetails?.itemCount === 0) continue;

    try {
      const cacMuc = await goiHetTrang<MucTrongPlaylist>(
        "playlistItems.list",
        "playlistItems",
        { part: "snippet", playlistId: playlist.id },
        GIOI_HAN.videoMoiPlaylist,
        { canDangNhap: true },
      );

      const dong = cacMuc
        .map((muc) => ({
          signalType: "playlist_member" as const,
          externalId: muc.snippet?.resourceId?.videoId ?? "",
          title: muc.snippet?.title ?? "(không rõ tên)",
          channelTitle: muc.snippet?.videoOwnerChannelTitle ?? null,
        }))
        .filter(
          (d) =>
            // Video đã bị xoá hoặc để riêng tư vẫn nằm trong playlist nhưng
            // không còn tên thật — lưu vào chỉ làm nhiễu dữ liệu gu
            d.externalId &&
            d.title !== "Deleted video" &&
            d.title !== "Private video",
        );

      soVideo += await luuTinHieu(dong);
    } catch (e) {
      loi.push({
        ten,
        lyDo: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return { soPlaylist: cacPlaylist.length, soVideo, loi };
}

/** Lưu vào database, bỏ qua mục đã có. Trả về số dòng thực sự thêm mới. */
async function luuTinHieu(
  dong: {
    signalType: "subscription" | "liked_video" | "playlist_member";
    externalId: string;
    title: string;
    channelTitle: string | null;
  }[],
): Promise<number> {
  if (dong.length === 0) return 0;

  const ketQua = await prisma.youTubeAccountSignal.createMany({
    data: dong,
    skipDuplicates: true,
  });
  return ketQua.count;
}

/** Đếm số tín hiệu đã nhập, theo từng loại. */
export async function demTinHieu(): Promise<Record<string, number>> {
  const nhom = await prisma.youTubeAccountSignal.groupBy({
    by: ["signalType"],
    _count: { _all: true },
  });

  return Object.fromEntries(
    nhom.map((n) => [n.signalType, n._count._all]),
  );
}
