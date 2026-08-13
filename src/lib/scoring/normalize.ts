/**
 * Chuẩn hoá tín hiệu chất lượng.
 *
 * Nguyên tắc quan trọng nhất: mọi so sánh đều diễn ra TRONG CÙNG một loại
 * nguồn. 500.000 lượt xem YouTube và 300 điểm Hacker News không cùng thang đo,
 * so trực tiếp là vô nghĩa.
 *
 * Xem docs/plan.md, mục "Pipeline chấm điểm chất lượng".
 */

/**
 * Đổi một giá trị thô thành thứ hạng phần trăm (0–1) trong tập tham chiếu.
 *
 * Trả về 0.5 khi tập tham chiếu quá nhỏ để nói lên điều gì — thà trung tính
 * còn hơn cho điểm cực đoan dựa trên vài mẫu.
 */
export function toPercentile(value: number, population: number[]): number {
  if (population.length < 5) return 0.5;

  const sorted = [...population].sort((a, b) => a - b);
  let below = 0;
  for (const v of sorted) {
    if (v < value) below++;
    else break;
  }
  return below / sorted.length;
}

/**
 * Độ phổ biến, đã chia theo quy mô nguồn.
 *
 * Nếu chỉ nhìn lượt xem tuyệt đối thì kênh triệu subscriber luôn thắng, kênh
 * nhỏ làm nội dung hay sẽ không bao giờ lọt vào tầm mắt. Nên ta đo bằng tỷ lệ
 * "lượt xem trên mỗi người theo dõi" — kênh 4 nghìn subscriber mà được 12
 * nghìn lượt xem đang làm tốt hơn kênh 2 triệu subscriber được 50 nghìn.
 */
export function popularityScore(params: {
  viewCount: number | null;
  followerCount: number | null;
  /** Tỷ lệ xem/follower của các nội dung khác CÙNG loại nguồn */
  peerRatios: number[];
}): number | null {
  const { viewCount, followerCount, peerRatios } = params;
  if (viewCount === null) return null;

  // Nguồn không công bố số người theo dõi (blog, podcast) thì đành so
  // lượt xem thô với nhau
  if (!followerCount || followerCount <= 0) {
    return toPercentile(viewCount, peerRatios);
  }

  return toPercentile(viewCount / followerCount, peerRatios);
}

/**
 * Độ tương tác — tín hiệu mà chủ dự án quan tâm nhất.
 *
 * Video nhiều lượt xem nhưng gần như không ai bình luận thường là thứ "xem cho
 * có". Tỷ lệ bình luận cao nghĩa là nội dung có gì đó đáng bàn.
 *
 * Bình luận được tính nặng gấp đôi lượt thích, vì viết một câu bình luận tốn
 * công hơn nhiều so với bấm nút thích.
 */
export function engagementDepthScore(params: {
  viewCount: number | null;
  commentCount: number | null;
  likeCount: number | null;
  /** Tỷ lệ bình luận/lượt xem của các nội dung khác cùng loại nguồn */
  peerCommentRatios: number[];
  /** Tỷ lệ thích/lượt xem của các nội dung khác cùng loại nguồn */
  peerLikeRatios: number[];
}): number | null {
  const { viewCount, commentCount, likeCount, peerCommentRatios, peerLikeRatios } = params;
  if (!viewCount || viewCount <= 0) return null;

  const parts: Array<{ value: number; weight: number }> = [];

  if (commentCount !== null) {
    parts.push({
      value: toPercentile(commentCount / viewCount, peerCommentRatios),
      weight: 2,
    });
  }
  if (likeCount !== null) {
    parts.push({
      value: toPercentile(likeCount / viewCount, peerLikeRatios),
      weight: 1,
    });
  }

  if (parts.length === 0) return null;

  const totalWeight = parts.reduce((s, p) => s + p.weight, 0);
  return parts.reduce((s, p) => s + p.value * p.weight, 0) / totalWeight;
}

/**
 * Uy tín nguồn.
 *
 * Tác giả/nguồn đã được người dùng duyệt vào whitelist là tín hiệu mạnh nhất —
 * mạnh hơn mọi con số. Kênh mới lập bị trừ nhẹ vì chưa có gì chứng minh, nhưng
 * chỉ trừ nhẹ thôi: đây là trọng số xếp hạng, không phải ngưỡng loại bỏ.
 */
export function sourceAuthorityScore(params: {
  followerCount: number | null;
  peerFollowerCounts: number[];
  isWhitelisted: boolean;
  isVerified: boolean;
  sourceAgeDays: number | null;
}): number {
  const { followerCount, peerFollowerCounts, isWhitelisted, isVerified, sourceAgeDays } = params;

  if (isWhitelisted) return 1;

  let score = 0;

  score += followerCount !== null ? toPercentile(followerCount, peerFollowerCounts) * 0.5 : 0.25;
  if (isVerified) score += 0.2;

  // Kênh dưới 6 tháng tuổi: chưa đủ thời gian để chứng minh sự nhất quán
  if (sourceAgeDays !== null) {
    score += sourceAgeDays > 180 ? 0.3 : (sourceAgeDays / 180) * 0.3;
  } else {
    score += 0.15;
  }

  return Math.min(1, score);
}

/** Trọng số của một loại nguồn, tổng bằng 1 */
export interface SourceWeights {
  popularity: number;
  engagementDepth: number;
  discussion: number;
  authority: number;
  contentQuality: number;
}

/**
 * Giá trị mặc định cho từng loại nguồn — người dùng chỉnh lại được trong
 * mục Cài đặt.
 *
 * Ý đồ đằng sau các con số:
 *  - YouTube nghiêng về tương tác và bình luận thay vì lượt xem thuần
 *  - Diễn đàn: bản chất nằm ở chất lượng thảo luận
 *  - Blog và podcast không có chỉ số công khai nào, nên dựa vào uy tín nguồn
 *    và đánh giá nội dung; phần "phổ biến" lấy gián tiếp từ điểm thảo luận
 *    trên Hacker News / Reddit khi bài được chia sẻ ở đó
 */
export const DEFAULT_WEIGHTS: Record<string, SourceWeights> = {
  youtube_channel: {
    popularity: 0.2,
    engagementDepth: 0.3,
    discussion: 0.3,
    authority: 0.2,
    contentQuality: 0,
  },
  soundcloud_channel: {
    popularity: 0.3,
    engagementDepth: 0.3,
    discussion: 0.2,
    authority: 0.2,
    contentQuality: 0,
  },
  forum_community: {
    popularity: 0.25,
    engagementDepth: 0.15,
    discussion: 0.45,
    authority: 0.15,
    contentQuality: 0,
  },
  blog_feed: {
    popularity: 0.25,
    engagementDepth: 0,
    discussion: 0.25,
    authority: 0.3,
    contentQuality: 0.2,
  },
  podcast_rss: {
    popularity: 0,
    engagementDepth: 0,
    discussion: 0,
    authority: 0.5,
    contentQuality: 0.5,
  },
};

/**
 * Gộp bốn trụ tín hiệu thành một điểm 0–10.
 *
 * Trụ nào không có dữ liệu thì bị loại khỏi phép tính và trọng số được chia
 * lại cho các trụ còn lại — như vậy một bài blog không có lượt xem sẽ không bị
 * phạt oan chỉ vì thiếu chỉ số mà bản chất nguồn đó vốn không có.
 */
export function compositeScore(
  signals: {
    popularity: number | null;
    engagementDepth: number | null;
    discussion: number | null;
    authority: number | null;
    contentQuality: number | null;
  },
  weights: SourceWeights,
): number {
  const pairs: Array<[number | null, number]> = [
    [signals.popularity, weights.popularity],
    [signals.engagementDepth, weights.engagementDepth],
    [signals.discussion, weights.discussion],
    [signals.authority, weights.authority],
    [signals.contentQuality, weights.contentQuality],
  ];

  let sum = 0;
  let usedWeight = 0;
  for (const [value, weight] of pairs) {
    if (value === null || weight <= 0) continue;
    sum += value * weight;
    usedWeight += weight;
  }

  if (usedWeight === 0) return 0;
  return Math.round((sum / usedWeight) * 100) / 10;
}
