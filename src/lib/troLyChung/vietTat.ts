/**
 * Bảng từ viết tắt cho giọng đọc tiếng Việt.
 *
 * Tách ra file riêng để bổ sung dần mà không phải đụng vào logic chuẩn hoá.
 *
 * QUAN TRỌNG — vì sao phân biệt chữ hoa chữ thường:
 *
 * "AI" viết hoa là công nghệ, đọc "ây ai". Nhưng "ai" viết thường là từ tiếng
 * Việt bình thường ("ai cũng biết"). Nếu thay không phân biệt hoa thường thì câu
 * "ai cũng biết" sẽ bị đọc thành "ây ai cũng biết" — sai hoàn toàn. Nên toàn bộ
 * bảng này khớp ĐÚNG CHỮ HOA, và hàm chuanHoaDeDoc không dùng cờ `i` khi thay.
 *
 * Cách viết phần phiên âm: viết như người Việt sẽ đọc lên, không viết tên tiếng
 * Anh. "LLM" phải là "eo eo em" chứ không phải "el el em".
 */

/** Viết tắt dùng chung cho cả ba trang */
export const VIET_TAT_CHUNG: Record<string, string> = {
  AI: "ây ai",
  API: "ây pi ai",
  CEO: "xi i âu",
  CPU: "xi pi iu",
  GPU: "gi pi iu",
  IT: "ai ti",
  PDF: "pi đi ép",
  URL: "iu a eo",
  USD: "đô la Mỹ",
  VND: "đồng",
  PC: "pi xi",
  OK: "ô kê",
};

/**
 * Viết tắt riêng của trang `am` — chủ yếu là thuật ngữ AI và âm nhạc.
 *
 * Nhẹ hơn `phaply` nhiều vì không có số hiệu văn bản luật, và nhẹ hơn `tiendo`
 * vì không có thuật ngữ xây dựng.
 */
export const VIET_TAT_AM: Record<string, string> = {
  LLM: "eo eo em",
  LLMs: "eo eo em",
  RAG: "rát",
  MCP: "em xi pi",
  SDK: "ét đi ca",
  TTS: "ti ti ét",
  ASR: "ây ét a",
  BPM: "nhịp mỗi phút",
  RSS: "a ét ét",
  HN: "Hacker News",
  YT: "YouTube",
  AGI: "ây gi ai",
  ML: "em eo",
  NLP: "en eo pi",
  UI: "giao diện",
  UX: "trải nghiệm người dùng",
};

/**
 * Bảng đang dùng của trang này.
 *
 * `tiendo` và `phaply` chép file này về thì đổi dòng dưới thành bảng của mình
 * (VIET_TAT_TIENDO / VIET_TAT_PHAPLY), phần VIET_TAT_CHUNG giữ nguyên.
 */
export const VIET_TAT: Record<string, string> = {
  ...VIET_TAT_CHUNG,
  ...VIET_TAT_AM,
};

/** Đơn vị đo, đọc thành lời thay vì đọc từng ký tự */
export const DON_VI: Record<string, string> = {
  ph: "phút",
  p: "phút",
  h: "giờ",
  g: "giờ",
  s: "giây",
  kb: "ki lô bai",
  mb: "mê ga bai",
  gb: "gi ga bai",
};
