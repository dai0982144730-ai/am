/**
 * Danh sách nguồn tin AI khởi đầu, chia theo bốn tầng uy tín của bản thiết kế.
 *
 * Tầng uy tín ảnh hưởng tới điểm chất lượng: bài từ hãng chính thức và chuyên
 * gia có tên tuổi được cộng điểm, còn trang tổng hợp thì không.
 *
 * Mọi nguồn dưới đây đều đã **thử tải thật** ngày 2026-08-14. Cột ghi chú nói
 * rõ nguồn nào lấy được toàn văn, nguồn nào chỉ có tóm tắt — biết trước để
 * không phải mò lại.
 */

import type { SourceReputationTier } from "@/generated/prisma/enums";

export interface NguonKhoiDau {
  ten: string;
  duongDanFeed: string;
  trangChu: string;
  tangUyTin: SourceReputationTier;
  /** Lấy được toàn văn từ trang gốc không — đã thử thật */
  layDuocToanVan: boolean;
  ghiChu?: string;
}

export const NGUON_KHOI_DAU: NguonKhoiDau[] = [
  // ----- Hãng AI chính thức -----
  {
    ten: "OpenAI News",
    duongDanFeed: "https://openai.com/news/rss.xml",
    trangChu: "https://openai.com/news",
    tangUyTin: "official_vendor",
    layDuocToanVan: false,
    ghiChu: "Trang bài chặn truy cập tự động — chỉ dùng tóm tắt trong feed",
  },
  {
    ten: "Google DeepMind",
    duongDanFeed: "https://deepmind.google/blog/rss.xml",
    trangChu: "https://deepmind.google/blog",
    tangUyTin: "official_vendor",
    layDuocToanVan: true,
    ghiChu: "Feed chỉ có tóm tắt, nhưng trang bài lấy được toàn văn (8-10 nghìn chữ)",
  },
  {
    ten: "Hugging Face Blog",
    duongDanFeed: "https://huggingface.co/blog/feed.xml",
    trangChu: "https://huggingface.co/blog",
    tangUyTin: "official_vendor",
    layDuocToanVan: true,
    ghiChu: "Trang DANH SÁCH dựng bằng JavaScript, nhưng trang từng BÀI thì lấy được toàn văn (9-27 nghìn chữ)",
  },

  // ----- Chuyên gia cá nhân -----
  {
    ten: "Simon Willison",
    duongDanFeed: "https://simonwillison.net/atom/everything/",
    trangChu: "https://simonwillison.net",
    tangUyTin: "expert_individual",
    layDuocToanVan: true,
    ghiChu: "Nguồn tốt nhất trong danh sách — feed đã gần như đủ toàn văn",
  },

  // ----- Diễn đàn cộng đồng -----
  {
    ten: "Hacker News — bài AI nổi bật",
    // Lọc sẵn: chỉ bài nhắc tới AI và đã có từ 100 điểm trở lên
    duongDanFeed: "https://hnrss.org/newest?q=AI&points=100",
    trangChu: "https://news.ycombinator.com",
    tangUyTin: "community_forum",
    layDuocToanVan: true,
    ghiChu: "Feed kèm sẵn điểm số và số bình luận — thước đo chất lượng thay thế. Bài trỏ ra trang ngoài nên tỷ lệ lấy được chữ tuỳ trang đích",
  },
  {
    ten: "Lobste.rs — thẻ AI",
    duongDanFeed: "https://lobste.rs/t/ai.rss",
    trangChu: "https://lobste.rs/t/ai",
    tangUyTin: "community_forum",
    layDuocToanVan: false,
  },
];
