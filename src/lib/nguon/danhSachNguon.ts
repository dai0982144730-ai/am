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

import type {
  ContentGroup,
  SourceReputationTier,
} from "@/generated/prisma/enums";

export interface NguonKhoiDau {
  ten: string;
  duongDanFeed: string;
  trangChu: string;
  tangUyTin: SourceReputationTier;
  /**
   * Chuyên mục nguồn này thường đăng.
   *
   * Chỉ là **gợi ý**, không phải quyết định: Claude vẫn đọc từng bài rồi tự
   * xếp. Cần thiết vì một trang khoa học vẫn có bài không thuộc khoa học ứng
   * dụng, và ngược lại — dán nhãn cứng theo nguồn thì sai ngay từ đầu.
   */
  nhomGoiY: ContentGroup;
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
    nhomGoiY: "ai",
    layDuocToanVan: false,
    ghiChu: "Trang bài chặn truy cập tự động — chỉ dùng tóm tắt trong feed",
  },
  {
    ten: "Google DeepMind",
    duongDanFeed: "https://deepmind.google/blog/rss.xml",
    trangChu: "https://deepmind.google/blog",
    tangUyTin: "official_vendor",
    nhomGoiY: "ai",
    layDuocToanVan: true,
    ghiChu: "Feed chỉ có tóm tắt, nhưng trang bài lấy được toàn văn (8-10 nghìn chữ)",
  },
  {
    ten: "Hugging Face Blog",
    duongDanFeed: "https://huggingface.co/blog/feed.xml",
    trangChu: "https://huggingface.co/blog",
    tangUyTin: "official_vendor",
    nhomGoiY: "ai",
    layDuocToanVan: true,
    ghiChu: "Trang DANH SÁCH dựng bằng JavaScript, nhưng trang từng BÀI thì lấy được toàn văn (9-27 nghìn chữ)",
  },

  // ----- Chuyên gia cá nhân -----
  {
    ten: "Simon Willison",
    duongDanFeed: "https://simonwillison.net/atom/everything/",
    trangChu: "https://simonwillison.net",
    tangUyTin: "expert_individual",
    nhomGoiY: "ai",
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
    nhomGoiY: "ai",
    layDuocToanVan: true,
    ghiChu: "Feed kèm sẵn điểm số và số bình luận — thước đo chất lượng thay thế. Bài trỏ ra trang ngoài nên tỷ lệ lấy được chữ tuỳ trang đích",
  },
  {
    ten: "Lobste.rs — thẻ AI",
    duongDanFeed: "https://lobste.rs/t/ai.rss",
    trangChu: "https://lobste.rs/t/ai",
    tangUyTin: "community_forum",
    nhomGoiY: "ai",
    layDuocToanVan: false,
  },

  // ======================================================================
  // KHOA HỌC & CÔNG NGHỆ ỨNG DỤNG
  //
  // Chủ dự án nói rõ (2026-08-15): riêng khoa học thì **YouTube một mình
  // không đủ**. Đúng vậy — thứ đáng đọc về khoa học ứng dụng phần lớn nằm ở
  // báo chuyên ngành và diễn đàn kỹ thuật, còn YouTube tiếng Việt mảng này
  // chủ yếu là tin giật gân kiểu "NASA vừa phát hiện điều gây sốc".
  //
  // Toàn bộ đều tiếng Anh, nên chúng đi qua bước thuật lại sang tiếng Việt
  // rồi mới tới tai người nghe.
  //
  // Đã thử tải thật ngày 2026-08-15, cột ghi chú ghi số bài đếm được lúc đó.
  // phys.org bị loại vì trả về mã 451 (chặn truy cập theo vùng).
  // ======================================================================

  {
    ten: "IEEE Spectrum",
    duongDanFeed: "https://spectrum.ieee.org/feeds/feed.rss",
    trangChu: "https://spectrum.ieee.org",
    tangUyTin: "expert_individual",
    nhomGoiY: "khoa_hoc",
    layDuocToanVan: true,
    ghiChu:
      "30 bài. Nguồn hợp gu nhất trong nhóm này — hội kỹ sư, bài nào cũng gắn với ứng dụng thật chứ không dừng ở lý thuyết",
  },
  {
    ten: "Ars Technica — Khoa học",
    duongDanFeed: "https://arstechnica.com/science/feed/",
    trangChu: "https://arstechnica.com/science",
    tangUyTin: "expert_individual",
    nhomGoiY: "khoa_hoc",
    layDuocToanVan: true,
    ghiChu: "20 bài. Viết sâu, không giật gân, hay nói tới hệ quả thực tế",
  },
  {
    ten: "Quanta Magazine",
    duongDanFeed: "https://www.quantamagazine.org/feed/",
    trangChu: "https://www.quantamagazine.org",
    tangUyTin: "expert_individual",
    nhomGoiY: "khoa_hoc",
    layDuocToanVan: true,
    ghiChu:
      "Chỉ 5 bài mỗi lần đọc — ra bài thưa nhưng chất lượng cao. Thiên về lý thuyết nên Claude sẽ xếp nhiều bài vào nhóm 'khác', đó là đúng",
  },
  {
    ten: "ScienceDaily — Công nghệ",
    duongDanFeed: "https://www.sciencedaily.com/rss/top/technology.xml",
    trangChu: "https://www.sciencedaily.com",
    tangUyTin: "aggregator",
    nhomGoiY: "khoa_hoc",
    layDuocToanVan: false,
    ghiChu:
      "60 bài, nhiều nhất nhóm. Là trang tổng hợp thông cáo báo chí của các đại học nên hay thổi phồng — xếp tầng aggregator để bị trừ điểm uy tín",
  },
  {
    ten: "Nature",
    duongDanFeed: "https://www.nature.com/nature.rss",
    trangChu: "https://www.nature.com",
    tangUyTin: "official_vendor",
    nhomGoiY: "khoa_hoc",
    layDuocToanVan: false,
    ghiChu:
      "76 bài. Tạp chí gốc, uy tín cao nhất, nhưng phần lớn là nghiên cứu thuần — chỉ số ít lọt vào 'khoa_hoc' theo tiêu chí ứng dụng được",
  },
  {
    ten: "Hacker News — bài khoa học nổi bật",
    // Ngưỡng 150 điểm, cao hơn feed AI (100), vì tin khoa học trên HN nhiều
    // hơn hẳn và phần lớn là thứ đọc cho vui
    duongDanFeed: "https://hnrss.org/newest?q=science&points=150",
    trangChu: "https://news.ycombinator.com",
    tangUyTin: "community_forum",
    nhomGoiY: "khoa_hoc",
    layDuocToanVan: true,
    ghiChu:
      "20 bài. Đám đông đã lọc giúp một lượt — bài lên được 150 điểm thường có lý do",
  },
  {
    ten: "Lobste.rs — thẻ khoa học",
    duongDanFeed: "https://lobste.rs/t/science.rss",
    trangChu: "https://lobste.rs/t/science",
    tangUyTin: "community_forum",
    nhomGoiY: "khoa_hoc",
    layDuocToanVan: false,
    ghiChu: "25 bài. Cộng đồng nhỏ, thiên kỹ thuật, ít rác",
  },

  // ----- Nguồn tiếng Việt -----
  //
  // Thêm 2026-08-16 theo yêu cầu của chủ dự án. Phần này quan trọng hơn vẻ
  // ngoài của nó: nội dung tiếng Việt **không phải đi qua bước thuật lại**, mà
  // bước đó đang là chỗ nghẽn lớn nhất — mỗi bài tốn hơn chục giây của Claude
  // và mỗi đêm chỉ làm được 5 bài. Một bài tiếng Việt vào kho là đọc được ngay.
  //
  // Việc bỏ qua bước dịch diễn ra tự động, không cần đánh dấu gì: Claude đọc
  // nội dung rồi ghi `originalLanguage = "vi"`, còn điều kiện `CHO_LONG_TIENG`
  // chỉ nhặt những bài KHÔNG phải tiếng Việt.
  //
  // Bốn feed dưới đây đều đã thử tải thật ngày 2026-08-16 và đếm được số bài.
  // Chúng trả về 302 rồi mới tới nội dung, nên thử bằng `curl` phải kèm `-L`;
  // `fetch` của Node tự đi theo chuyển hướng nên code không phải sửa gì.
  {
    ten: "VnExpress — Khoa học",
    duongDanFeed: "https://vnexpress.net/rss/khoa-hoc.rss",
    trangChu: "https://vnexpress.net/khoa-hoc",
    tangUyTin: "aggregator",
    nhomGoiY: "khoa_hoc",
    layDuocToanVan: true,
    ghiChu: "60 bài. Tiếng Việt — không cần thuật lại",
  },
  {
    ten: "Tuổi Trẻ — Khoa học",
    duongDanFeed: "https://tuoitre.vn/rss/khoa-hoc.rss",
    trangChu: "https://tuoitre.vn/khoa-hoc.htm",
    tangUyTin: "aggregator",
    nhomGoiY: "khoa_hoc",
    layDuocToanVan: true,
    ghiChu: "50 bài. Tiếng Việt — không cần thuật lại",
  },
  {
    ten: "VnExpress — Số hoá",
    duongDanFeed: "https://vnexpress.net/rss/so-hoa.rss",
    trangChu: "https://vnexpress.net/so-hoa",
    tangUyTin: "aggregator",
    nhomGoiY: "ai",
    layDuocToanVan: true,
    ghiChu:
      "60 bài. Tiếng Việt. Lẫn nhiều tin điện thoại mới và review — phần đó sẽ bị bước phân loại gạt ra, chỉ giữ tin AI",
  },
  {
    ten: "Giác Ngộ",
    duongDanFeed: "https://giacngo.vn/rss/home.rss",
    trangChu: "https://giacngo.vn",
    tangUyTin: "aggregator",
    nhomGoiY: "triet_hoc",
    layDuocToanVan: true,
    ghiChu:
      "50 bài. Báo Phật giáo tiếng Việt — nguồn CHỮ đầu tiên cho mục Triết học, vốn tới giờ sống hoàn toàn bằng video YouTube",
  },
];
