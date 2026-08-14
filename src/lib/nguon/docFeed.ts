/**
 * Đọc nguồn tin dạng RSS/Atom — blog hãng AI, blog chuyên gia, diễn đàn.
 *
 * VÌ SAO CÓ NHÁNH NÀY: tin AI trên YouTube tiếng Việt chậm hơn nhiều so với
 * blog và diễn đàn phương Tây. Đọc thẳng nguồn chữ viết rồi thuật lại bằng
 * tiếng Việt là cách bù độ trễ đó — nên bản thiết kế xếp việc này lên sớm, ngay
 * sau nhánh YouTube.
 *
 * KHẢO SÁT THẬT các nguồn (2026-08-14) — quyết định cách làm dựa trên đây:
 *
 * | Nguồn | Đọc feed | Lấy toàn văn |
 * |---|---|---|
 * | Simon Willison | ✅ 30 mục, nội dung gần đủ ngay trong feed | ✅ được |
 * | Hacker News (hnrss.org) | ✅ kèm sẵn **điểm số và số bình luận** | — chỉ là link |
 * | Lobste.rs | ✅ 25 mục | — |
 * | DeepMind | ✅ 100 mục, chỉ có tóm tắt | chưa thử |
 * | OpenAI | ✅ nhưng **trang bài chặn truy cập tự động** | ❌ trả về trang chống bot |
 * | Hugging Face | ✅ nhưng trang dựng bằng JS | ❌ không có nội dung trong HTML |
 *
 * Kết luận rút ra: **không cố vượt rào chặn**. Trang nào chặn thì dùng phần tóm
 * tắt có sẵn trong feed — vẫn đủ để biết bài nói gì và có đáng đọc không. Đúng
 * tinh thần "xử lý duyên dáng khi bị chặn" trong mục rủi ro của bản thiết kế.
 */

import Parser from "rss-parser";

/** Chờ tối đa khi tải một feed hoặc một trang. */
const HAN_TAI_MS = 25_000;

/** Trang nặng hơn ngần này thì bỏ — bài viết tử tế không bao giờ lớn vậy. */
const TOI_DA_HTML = 3 * 1_048_576;

/**
 * Tự giới thiệu khi tải trang.
 *
 * Nói thật mình là ai và để lại đường dẫn dự án, thay vì giả làm trình duyệt
 * người dùng. Trang nào không muốn cho đọc thì chặn — đó là quyền của họ.
 *
 * **Phải viết không dấu**: tiêu đề HTTP chỉ nhận ký tự ASCII. Đã vấp thật —
 * bản đầu viết "trợ lý đọc tin cá nhân" làm cả sáu nguồn đều hỏng với lỗi
 * `Invalid character in header content`.
 */
const TU_GIOI_THIEU =
  "am-personal-reader/1.0 (personal reading assistant; https://github.com/dai0982144730-ai/am)";

const trinhDoc = new Parser({
  timeout: HAN_TAI_MS,
  headers: { "User-Agent": TU_GIOI_THIEU },
  customFields: {
    item: [
      ["content:encoded", "noiDungDayDu"],
      ["dc:creator", "nguoiViet"],
    ],
  },
});

export interface MucTrongFeed {
  tieuDe: string;
  duongDan: string;
  /** Mã định danh riêng của mục — dùng để biết đã lấy về chưa */
  ma: string;
  dangLuc: Date | null;
  /** Nội dung có sẵn ngay trong feed, có thể là toàn văn hoặc chỉ tóm tắt */
  noiDungTrongFeed: string | null;
  nguoiViet: string | null;
  /** Điểm số trên diễn đàn, nếu feed có kèm */
  diemDienDan: number | null;
  soBinhLuanDienDan: number | null;
}

/**
 * Bóc điểm số và số bình luận mà Hacker News nhét vào phần mô tả.
 *
 * Feed của họ ghi dạng "Points: 122" và "# Comments: 92". Đây là món hời: blog
 * và bài viết vốn không có chỉ số công khai nào, mà số điểm trên Hacker News
 * lại là thước đo thay thế rất thật — đúng cách bản thiết kế đề ra cho những
 * nguồn "không có gì để đo".
 */
function bocDiemDienDan(moTa: string | undefined): {
  diem: number | null;
  soBinhLuan: number | null;
} {
  if (!moTa) return { diem: null, soBinhLuan: null };

  const diem = /Points:\s*(\d+)/i.exec(moTa)?.[1];
  const binhLuan = /#\s*Comments:\s*(\d+)/i.exec(moTa)?.[1];

  return {
    diem: diem ? Number(diem) : null,
    soBinhLuan: binhLuan ? Number(binhLuan) : null,
  };
}

/** Bỏ thẻ HTML, giữ lại chữ. */
export function boThe(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/(p|div|h[1-6]|li|br)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export class LoiDocFeed extends Error {
  constructor(
    readonly duongDanFeed: string,
    thongDiep: string,
  ) {
    super(thongDiep);
    this.name = "LoiDocFeed";
  }
}

/** Đọc một feed, trả về các mục trong đó. */
export async function docFeed(duongDanFeed: string): Promise<MucTrongFeed[]> {
  let feed;
  try {
    feed = await trinhDoc.parseURL(duongDanFeed);
  } catch (e) {
    throw new LoiDocFeed(
      duongDanFeed,
      `Không đọc được feed: ${e instanceof Error ? e.message : e}`,
    );
  }

  return (feed.items ?? [])
    .map((muc) => {
      const duongDan = muc.link?.trim();
      if (!duongDan) return null;

      const { diem, soBinhLuan } = bocDiemDienDan(
        muc.contentSnippet ?? muc.content ?? "",
      );

      // Ưu tiên nội dung đầy đủ nếu feed có; không thì lấy phần tóm tắt
      const noiDungTho =
        (muc as { noiDungDayDu?: string }).noiDungDayDu ??
        muc.content ??
        muc.contentSnippet ??
        null;

      return {
        tieuDe: muc.title?.trim() ?? "(không có tiêu đề)",
        duongDan,
        // Nhiều feed có `guid` riêng; không có thì lấy chính đường dẫn
        ma: muc.guid?.trim() || duongDan,
        dangLuc: muc.isoDate ? new Date(muc.isoDate) : null,
        noiDungTrongFeed: noiDungTho ? boThe(noiDungTho) : null,
        nguoiViet:
          (muc as { nguoiViet?: string }).nguoiViet?.trim() ??
          muc.creator?.trim() ??
          null,
        diemDienDan: diem,
        soBinhLuanDienDan: soBinhLuan,
      };
    })
    .filter((m): m is MucTrongFeed => m !== null);
}

export interface KetQuaLayToanVan {
  vanBan: string | null;
  /** Vì sao không lấy được — để ghi log chứ không giấu đi */
  lyDoThatBai: string | null;
}

/**
 * Lấy toàn văn một bài viết từ trang gốc.
 *
 * Nhiều trang lớn chặn truy cập tự động hoặc dựng nội dung bằng JavaScript. Gặp
 * vậy thì trả về `null` kèm lý do, để chỗ gọi quay sang dùng phần tóm tắt trong
 * feed — chứ không cố vượt rào.
 */
export async function layToanVan(
  duongDan: string,
): Promise<KetQuaLayToanVan> {
  let html: string;

  try {
    const phanHoi = await fetch(duongDan, {
      headers: { "User-Agent": TU_GIOI_THIEU },
      signal: AbortSignal.timeout(HAN_TAI_MS),
    });

    if (!phanHoi.ok) {
      return {
        vanBan: null,
        lyDoThatBai: `trang trả về mã ${phanHoi.status}`,
      };
    }
    html = await phanHoi.text();
  } catch (e) {
    return {
      vanBan: null,
      lyDoThatBai: `không tải được: ${e instanceof Error ? e.message : e}`,
    };
  }

  // Trang quá lớn thì bỏ. Đã vấp thật: một trang khổng lồ làm cheerio tràn bộ
  // nhớ với lỗi "Maximum call stack size exceeded", và vì lỗi đó xảy ra ở tầng
  // rất sâu nên nó làm chết luôn cả mẻ quét. Bài viết tử tế không bao giờ nặng
  // tới mức này.
  if (html.length > TOI_DA_HTML) {
    return {
      vanBan: null,
      lyDoThatBai: `trang nặng ${Math.round(html.length / 1_048_576)}MB — bỏ qua`,
    };
  }

  let sach: string;

  try {
    // Nạp cheerio kiểu này để nó chỉ được tải khi thật sự cần
    const { load } = await import("cheerio");
    const trang = load(html);

    trang("script, style, nav, header, footer, aside, form, noscript").remove();

    // Thử lần lượt các chỗ hay chứa nội dung chính, lấy khối dài nhất
    const cacCho = [
      "article",
      "main",
      '[role="main"]',
      ".post",
      ".entry-content",
    ];
    let dai = "";

    for (const cho of cacCho) {
      trang(cho).each((_, phanTu) => {
        const chu = trang(phanTu).text().trim();
        if (chu.length > dai.length) dai = chu;
      });
    }

    // Không thấy khối nào rõ ràng thì gom hết đoạn văn lại
    if (dai.length < 400) {
      const cacDoan = trang("p")
        .map((_, p) => trang(p).text().trim())
        .get()
        .filter((d) => d.length > 40);
      const gom = cacDoan.join("\n\n");
      if (gom.length > dai.length) dai = gom;
    }

    sach = dai.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  } catch (e) {
    // HTML hỏng hoặc quá phức tạp — một trang không đọc được thì bỏ qua trang
    // đó, tuyệt đối không để chết cả mẻ
    return {
      vanBan: null,
      lyDoThatBai: `không bóc được nội dung: ${e instanceof Error ? e.message : e}`,
    };
  }

  // Dưới ngần này chữ thì gần như chắc chắn là trang chặn hoặc trang dựng bằng
  // JavaScript, không phải bài viết thật
  if (sach.length < 400) {
    return {
      vanBan: null,
      lyDoThatBai: `chỉ bóc được ${sach.length} ký tự — nhiều khả năng trang chặn hoặc dựng bằng JavaScript`,
    };
  }

  return { vanBan: sach, lyDoThatBai: null };
}
