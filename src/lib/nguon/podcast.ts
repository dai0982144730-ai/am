/**
 * Nhánh podcast: tìm kênh, đọc feed, lấy tập mới về kho.
 *
 * ## Vì sao podcast đáng giá nhất trong tất cả các nguồn
 *
 * Chủ dự án cần **nghe tiếng Việt**. Mọi nguồn khác đều phải đi vòng để tới
 * đích đó:
 *
 *   - Blog tiếng Anh → Claude dịch → TTS đọc lại → tốn ký tự hạn mức
 *   - Video tiếng Anh → lấy lời thoại → dịch → TTS → tốn ký tự
 *   - Podcast tiếng Việt → **phát thẳng**
 *
 * Một tập podcast tiếng Việt đã sẵn là giọng người thật nói tiếng Việt. Không
 * dịch, không đọc lại, không tốn một ký tự TTS nào, mà chất lượng giọng còn hơn
 * hẳn giọng máy. Nên nhánh này rẻ nhất và hợp nhất với cách dùng của chủ nhà.
 *
 * ## Vì sao tìm theo TÊN chứ không bắt dán đường dẫn feed
 *
 * Bản đầu tôi định làm ô "dán đường dẫn RSS vào đây". Sai. Chủ dự án không phải
 * lập trình viên, mà đường dẫn RSS là thứ hầu như không hiện ra ở đâu cho người
 * dùng thường thấy — muốn có nó phải mở mã nguồn trang hoặc biết mẹo.
 *
 * Apple có sẵn một API tra cứu podcast **miễn phí, không cần khoá**, trả về
 * thẳng đường dẫn feed. Đã thử thật (2026-08-15): gõ "Sunhuyn" ra đúng kênh với
 * 105 tập, gõ "Vietcetera" ra bốn kênh của họ. Vậy thì để máy đi tìm, còn chủ
 * nhà chỉ cần gõ cái tên mình biết.
 *
 * Ô dán đường dẫn vẫn giữ, cho trường hợp podcast không có trên Apple.
 *
 * ## Giới hạn thành thật
 *
 * Podcast **không có lời thoại**. Thứ duy nhất đọc được bằng chữ là phần mô tả
 * tập do chính tác giả viết, mà phần đó thường lẫn quảng cáo và link mạng xã
 * hội. Nên điểm chấm cho podcast dựa trên nền yếu hơn video hẳn — đúng như bản
 * thiết kế đã lường trước khi để sẵn `podcast_shownotes` trong danh sách nguồn
 * lời thoại.
 */

import Parser from "rss-parser";

import { boThe } from "./docFeed";

/** Chờ tối đa khi tra cứu hoặc tải feed. */
const HAN_TAI_MS = 25_000;

const TU_GIOI_THIEU =
  "am-personal-reader/1.0 (personal reading assistant; https://github.com/dai0982144730-ai/am)";

const trinhDoc = new Parser({
  timeout: HAN_TAI_MS,
  headers: { "User-Agent": TU_GIOI_THIEU },
});

// ==========================================================================
// Tìm podcast theo tên
// ==========================================================================

export interface KetQuaTim {
  ten: string;
  tacGia: string | null;
  duongDanFeed: string;
  anhBia: string | null;
  soTap: number | null;
  /** Thể loại Apple xếp — để chủ nhà nhận ra kênh mình định tìm */
  theLoai: string | null;
}

interface MucApple {
  collectionName?: string;
  artistName?: string;
  feedUrl?: string;
  artworkUrl600?: string;
  artworkUrl100?: string;
  trackCount?: number;
  primaryGenreName?: string;
}

/**
 * Tìm podcast theo tên qua API công khai của Apple.
 *
 * Đặt `country=VN` để kết quả nghiêng về podcast tiếng Việt — chủ nhà chỉ nghe
 * tiếng Việt nên xếp podcast Việt lên trước là đúng, không phải thiên vị vô cớ.
 *
 * Apple hay trả **trùng** cùng một kênh nhiều lần (đã thấy thật: "Sunhuyn" ra
 * hai dòng y hệt). Lọc trùng theo đường dẫn feed.
 */
export async function timPodcast(tuKhoa: string): Promise<KetQuaTim[]> {
  const dd =
    "https://itunes.apple.com/search?media=podcast&country=VN&limit=12&term=" +
    encodeURIComponent(tuKhoa.trim());

  const phanHoi = await fetch(dd, {
    headers: { "User-Agent": TU_GIOI_THIEU },
    signal: AbortSignal.timeout(HAN_TAI_MS),
  });

  if (!phanHoi.ok) {
    throw new Error(`Apple trả về mã ${phanHoi.status}`);
  }

  const du = (await phanHoi.json()) as { results?: MucApple[] };
  const daThay = new Set<string>();
  const ra: KetQuaTim[] = [];

  for (const k of du.results ?? []) {
    // Không có feed thì không dùng được — Apple có vài mục chỉ là trang giới
    // thiệu, không kèm feed thật
    if (!k.feedUrl || daThay.has(k.feedUrl)) continue;
    daThay.add(k.feedUrl);

    ra.push({
      ten: k.collectionName?.trim() ?? "(không rõ tên)",
      tacGia: k.artistName?.trim() ?? null,
      duongDanFeed: k.feedUrl,
      anhBia: k.artworkUrl600 ?? k.artworkUrl100 ?? null,
      soTap: k.trackCount ?? null,
      theLoai: k.primaryGenreName ?? null,
    });
  }

  return ra;
}

// ==========================================================================
// Đọc feed podcast
// ==========================================================================

export interface TapPodcast {
  tieuDe: string;
  ma: string;
  duongDanTrang: string | null;
  /** Đường dẫn file âm thanh — không có thì đây không phải tập podcast */
  duongDanAmThanh: string;
  kieuFile: string | null;
  giay: number | null;
  dangLuc: Date | null;
  /** Nguyên văn tác giả viết — để hiện trong mục "Mô tả gốc" */
  moTa: string | null;
  /**
   * Phần mô tả CHỈ thuộc về tập này, đã bỏ lời rao lặp ở mọi tập.
   *
   * Đây mới là thứ đáng đưa cho Claude đọc. Xem `bocPhanRieng` để hiểu vì sao
   * phải tách hai thứ này ra.
   */
  moTaRieng: string | null;
  anh: string | null;
}

export interface KenhPodcast {
  ten: string;
  moTa: string | null;
  anhBia: string | null;
  /** Mã ngôn ngữ feed tự khai, ví dụ "vi" hay "en-US" */
  ngonNgu: string | null;
  trangChu: string | null;
  cacTap: TapPodcast[];
}

/**
 * Đổi `itunes:duration` thành số giây.
 *
 * Thẻ này không có chuẩn thống nhất — gặp cả ba dạng ngoài đời: "1:23:45",
 * "23:45", và số giây trần "3600".
 */
export function docThoiLuong(tho: string | undefined | null): number | null {
  if (!tho) return null;
  const chu = tho.trim();
  if (!chu) return null;

  if (!chu.includes(":")) {
    const n = Number(chu);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
  }

  const phan = chu.split(":").map((x) => Number(x));
  if (phan.some((x) => !Number.isFinite(x))) return null;

  // Đọc từ phải sang: giây, phút, giờ
  let giay = 0;
  let nhan = 1;
  for (let i = phan.length - 1; i >= 0; i -= 1) {
    giay += phan[i] * nhan;
    nhan *= 60;
  }
  return giay > 0 ? Math.round(giay) : null;
}

/**
 * Bỏ những dòng lặp lại ở mọi tập, chỉ giữ phần riêng của từng tập.
 *
 * ## Vì sao phải có hàm này
 *
 * Đo thật trên kênh podcast đầu tiên thêm vào (2026-08-15): phần mô tả của cả
 * năm tập **giống nhau từng chữ**, chỉ khác mỗi dòng tiêu đề. Nội dung là lời
 * chào, một link bán sổ tay, một link kênh YouTube và một hashtag.
 *
 * Đưa nguyên thứ đó cho Claude đọc thì hậu quả đã thấy ngay: Claude chấm chất
 * lượng nội dung 0,2–0,3 trên thang 1. Chấm **đúng** — vì đó đúng là quảng cáo
 * chứ không phải nội dung. Nhưng nó nói về lời rao chứ không nói gì về tập
 * podcast, mà điểm đó lại chiếm một nửa điểm tổng của podcast. Kết quả: podcast
 * hay đến mấy cũng nằm bẹp dưới đáy, không bao giờ hiện lên trang chính.
 *
 * Nên phải tách: cái gì lặp ở mọi tập thì là lời rao của kênh, không phải nội
 * dung tập. Còn lại gì thì mới đưa đi chấm. Không còn gì thì nói thẳng là không
 * có gì để đọc, chứ không để Claude chấm điểm thấp cho một mẩu quảng cáo.
 *
 * ## Hai luật, đều rút ra từ đo thật
 *
 * **Luật 1 — bỏ dòng chứa đường link hoặc chỉ có hashtag.** Dòng có link hầu
 * như luôn là "theo dõi mình ở", "mua hàng tại", "xem thêm trên". Nội dung thật
 * của một tập podcast không nằm trong đường link.
 *
 * **Luật 2 — bỏ dòng lặp ở nhiều tập.** Ngưỡng 40% số tập, cần ít nhất 3 tập
 * mới đủ căn cứ.
 *
 * ## Điều luật này KHÔNG làm được
 *
 * Lời rao đổi chữ dần theo năm tháng, nên so từng dòng không bắt hết. Đo trên
 * 105 tập của kênh đầu tiên: câu chào có tới ba bốn biến thể, mỗi biến thể chỉ
 * chiếm 8–9% số tập nên không cái nào đạt ngưỡng.
 *
 * Đã thử một luật thứ ba — đo tỷ lệ từ dùng chung cả kênh — và **bỏ đi**: đo
 * trên bốn kênh thật thì nó không đổi được một kết quả nào, vì từ nối tiếng
 * Việt lấn át. Kênh toàn quảng cáo có tỷ lệ 62% còn kênh có nội dung thật lại
 * 67%, tức là chỉ số này chỉ đo văn phong chứ không đo thông tin.
 *
 * Thứ tách sạch hai loại là **độ dài còn lại** — xem `TOI_THIEU_MO_TA` bên
 * quetPodcast.ts.
 */
export function bocPhanRieng(cacMoTa: (string | null)[]): (string | null)[] {
  const TOI_THIEU_TAP = 3;
  const NGUONG_LAP = 0.4;

  /** Dòng chỉ để dẫn đi chỗ khác, không phải nội dung. */
  const laDongRao = (dong: string) =>
    /https?:\/\//.test(dong) ||
    /^[#@][^\s]/.test(dong) ||
    /^#\S+(\s+#\S+)*$/.test(dong);

  const coMoTa = cacMoTa.filter((m): m is string => Boolean(m?.trim()));
  if (coMoTa.length < TOI_THIEU_TAP) return cacMoTa;

  const tachDong = (chu: string) =>
    chu
      .split("\n")
      .map((d) => d.trim())
      .filter((d) => d && !laDongRao(d));

  // Đếm số TẬP chứa mỗi dòng, không phải số lần xuất hiện — một dòng lặp ba
  // lần trong cùng một tập vẫn chỉ tính là một
  const dem = new Map<string, number>();
  for (const moTa of coMoTa) {
    for (const dong of new Set(tachDong(moTa))) {
      dem.set(dong, (dem.get(dong) ?? 0) + 1);
    }
  }

  const nguong = Math.max(2, Math.ceil(coMoTa.length * NGUONG_LAP));

  return cacMoTa.map((moTa) => {
    if (!moTa?.trim()) return moTa;
    const conLai = tachDong(moTa).filter(
      (dong) => (dem.get(dong) ?? 0) < nguong,
    );
    const chu = conLai.join("\n").trim();
    return chu || null;
  });
}

export class LoiDocPodcast extends Error {
  constructor(thongDiep: string) {
    super(thongDiep);
    this.name = "LoiDocPodcast";
  }
}

/**
 * Đọc một feed podcast.
 *
 * **Chỉ giữ mục có file âm thanh.** Đây chính là chỗ phân biệt podcast với
 * blog: cùng là RSS cả, nhưng feed blog không có thẻ `<enclosure>` trỏ tới file
 * tiếng. Nhờ vậy khi chủ nhà dán nhầm một feed blog vào ô podcast thì máy nhận
 * ra ngay và nói thẳng, chứ không lặng lẽ thêm vào rồi để trống.
 */
export async function docFeedPodcast(
  duongDanFeed: string,
): Promise<KenhPodcast> {
  let feed;
  try {
    feed = await trinhDoc.parseURL(duongDanFeed);
  } catch (e) {
    throw new LoiDocPodcast(
      `Không đọc được feed: ${e instanceof Error ? e.message : e}`,
    );
  }

  const itunesKenh = (feed as { itunes?: { image?: string; summary?: string } })
    .itunes;

  const cacTap: TapPodcast[] = [];

  for (const muc of feed.items ?? []) {
    const am = muc.enclosure;
    // Không có file tiếng thì không phải tập podcast — bỏ qua, không đoán
    if (!am?.url) continue;
    if (am.type && !am.type.startsWith("audio")) continue;

    const itunesTap = (
      muc as { itunes?: { duration?: string; summary?: string; image?: string } }
    ).itunes;

    const moTaTho = itunesTap?.summary ?? muc.content ?? muc.contentSnippet;

    cacTap.push({
      tieuDe: muc.title?.trim() ?? "(không có tiêu đề)",
      ma: muc.guid?.trim() || am.url,
      duongDanTrang: muc.link?.trim() ?? null,
      duongDanAmThanh: am.url,
      kieuFile: am.type ?? null,
      giay: docThoiLuong(itunesTap?.duration),
      dangLuc: muc.isoDate ? new Date(muc.isoDate) : null,
      moTa: moTaTho ? boThe(moTaTho) : null,
      // Điền ngay sau vòng lặp — cần biết mô tả của TẤT CẢ các tập mới nhận ra
      // được dòng nào là lời rao lặp
      moTaRieng: null,
      anh: itunesTap?.image ?? null,
    });
  }

  const phanRieng = bocPhanRieng(cacTap.map((t) => t.moTa));
  for (const [i, tap] of cacTap.entries()) {
    // Dòng tiêu đề hay được nhét sẵn vào đầu mô tả ("Tên tập | Tên kênh"). Nó
    // khác nhau ở mỗi tập nên không bị bắt là lời rao, nhưng nó cũng không phải
    // nội dung — Claude đã có tiêu đề rồi.
    const bo = phanRieng[i]
      ?.split("\n")
      .filter((d) => !d.includes(tap.tieuDe))
      .join("\n")
      .trim();
    tap.moTaRieng = bo || null;
  }

  if (cacTap.length === 0) {
    throw new LoiDocPodcast(
      "Feed này không có tập nào kèm file âm thanh. Nhiều khả năng đây là feed " +
        "blog chứ không phải podcast — nếu vậy thì thêm nó ở mục nguồn bài viết.",
    );
  }

  return {
    ten: feed.title?.trim() ?? "(không rõ tên)",
    moTa: (itunesKenh?.summary ?? feed.description)
      ? boThe(itunesKenh?.summary ?? feed.description ?? "").slice(0, 2_000)
      : null,
    anhBia: feed.image?.url ?? itunesKenh?.image ?? null,
    ngonNgu:
      (feed as { language?: string }).language?.trim().toLowerCase() ?? null,
    trangChu: feed.link?.trim() ?? null,
    cacTap,
  };
}

/** Feed có tự khai là tiếng Việt không. */
export function laTiengViet(ngonNgu: string | null): boolean {
  return (ngonNgu ?? "").toLowerCase().startsWith("vi");
}
