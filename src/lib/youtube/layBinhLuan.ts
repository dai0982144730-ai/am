/**
 * Lấy bình luận nổi bật của một video.
 *
 * Rẻ: `commentThreads.list` chỉ tốn 1 đơn vị hạn mức cho tối đa 100 bình luận.
 * Nhưng vẫn không gọi cho mọi video — chỉ cho nhóm ứng viên đứng đầu mỗi ngày,
 * vì phần lớn nội dung đã bị loại từ vòng lọc đầu, đọc bình luận của chúng chỉ
 * tốn công vô ích.
 */

import { goiYouTube } from "./goiApi";

interface LuongBinhLuan {
  snippet?: {
    topLevelComment?: {
      snippet?: {
        textOriginal?: string;
        authorDisplayName?: string;
        likeCount?: number;
      };
    };
    totalReplyCount?: number;
  };
}

export interface BinhLuan {
  chu: string;
  soThich: number;
  soTraLoi: number;
}

/**
 * Lấy bình luận sắp theo mức độ được quan tâm.
 *
 * Dùng `order=relevance` chứ không phải `time`: bình luận được nhiều người thích
 * mới nói lên chất lượng thảo luận, còn bình luận mới nhất thì thường là người
 * vừa lướt qua.
 */
export async function layBinhLuanNoiBat(
  idVideo: string,
  soLuong = 20,
): Promise<BinhLuan[]> {
  const ketQua = await goiYouTube<{ items?: LuongBinhLuan[] }>(
    "commentThreads.list",
    "commentThreads",
    {
      part: "snippet",
      videoId: idVideo,
      order: "relevance",
      maxResults: Math.min(100, soLuong),
      textFormat: "plainText",
    },
  );

  return (ketQua.items ?? [])
    .map((luong) => {
      const bl = luong.snippet?.topLevelComment?.snippet;
      const chu = bl?.textOriginal?.trim();
      if (!chu) return null;

      return {
        chu,
        soThich: bl?.likeCount ?? 0,
        soTraLoi: luong.snippet?.totalReplyCount ?? 0,
      };
    })
    .filter((b): b is BinhLuan => b !== null);
}
