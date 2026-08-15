/**
 * Thêm kênh podcast vào kho và lấy tập mới về.
 *
 * Dùng chung `Source`/`ContentItem` với YouTube và blog — nguyên tắc số một của
 * bản thiết kế: thêm nguồn mới chỉ là thêm một adapter, không sửa cấu trúc dữ
 * liệu. Chỗ riêng của podcast gọn lại còn đúng ba điểm:
 *
 *   1. `audioUrl` giữ file tiếng gốc → phát thẳng, không qua TTS
 *   2. `narrationType = human_voice` → giọng người thật, không phải giọng máy
 *   3. Lời thoại thay bằng phần mô tả tập (`podcast_shownotes`)
 *
 * Podcast không có lời thoại nên bước phân loại chỉ có tiêu đề, mô tả và tên
 * kênh để làm việc. Bước đó vốn đã nhận `loiThoai: null` được, nên không phải
 * sửa gì thêm.
 */

import type { ContentGroup } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db/prisma";

import { docFeedPodcast, laTiengViet, type TapPodcast } from "./podcast";

/** Thời gian tối đa cho một lượt ghi, và thời gian chờ để bắt đầu ghi. */
const HAN_GHI_MS = 60_000;
const HAN_CHO_MS = 30_000;

/**
 * Phần mô tả riêng ngắn hơn ngần này thì coi như không có gì để đọc.
 *
 * Con số 400 rút ra từ đo thật trên 450 tập của bốn kênh podcast Việt
 * (2026-08-15). Sau khi lọc lời rao, độ dài còn lại tách hai loại rất sạch:
 *
 * | Kênh | Còn lại trung bình | Thực chất |
 * |---|---|---|
 * | Sunhuyn | 250 ký tự | lời chào, không có nội dung |
 * | Have A Sip | 1.085 ký tự | tóm tắt thật từng tập |
 * | The Money Date | 1.184 ký tự | tóm tắt thật từng tập |
 *
 * Mức cũ 120 ký tự nhận nhầm 80/105 tập của Sunhuyn. Mức 400, cộng với luật bỏ
 * dòng chứa link trong `bocPhanRieng`, kéo xuống còn 9 — và 9 tập đó kiểm lại
 * thì **đúng là có mô tả thật** (livestream ghi kèm mốc thời gian từng phần),
 * chứ không phải nhận nhầm.
 *
 * Phía kênh có nội dung thật vẫn giữ được phần lớn: Money Date 30/36, Have A
 * Sip 212/255, bob-up radio 31/54. Số bị loại là những tập mô tả sơ sài thật.
 *
 * Chấp nhận sai sót hai đầu: thà lọt vài cái xấu còn hơn chặn nhầm cái tốt, và
 * cái lưới hứng phía sau là điểm chủ nhà tự chấm sau khi nghe.
 */
const TOI_THIEU_MO_TA = 400;

export interface KetQuaThemKenh {
  ok: boolean;
  thongDiep: string;
  idNguon?: string;
  ten?: string;
  soTapTrongFeed?: number;
  /** Feed tự khai không phải tiếng Việt — nói cho chủ nhà biết, không tự chặn */
  canhBaoNgonNgu?: string;
}

/**
 * Thêm một kênh podcast.
 *
 * VỀ NGÔN NGỮ: nếu feed tự khai không phải tiếng Việt thì **báo chứ không
 * chặn**. Thẻ ngôn ngữ trong feed cũng hay sai y như bên YouTube — đã gặp video
 * giảng pháp tiếng Việt bị gắn `en` và nhạc Việt gắn `nl-NL`. Chủ nhà biết rõ
 * kênh mình thêm hơn cái thẻ đó, nên quyền quyết định thuộc về chủ nhà.
 */
export async function themKenhPodcast(
  duongDanFeed: string,
  nhomGoiY?: ContentGroup,
): Promise<KetQuaThemKenh> {
  const dd = duongDanFeed.trim();
  if (!dd) return { ok: false, thongDiep: "Chưa có đường dẫn feed." };

  let kenh;
  try {
    kenh = await docFeedPodcast(dd);
  } catch (e) {
    return {
      ok: false,
      thongDiep: e instanceof Error ? e.message : "Không đọc được feed.",
    };
  }

  const daCo = await prisma.source.findUnique({
    where: { type_externalId: { type: "podcast_rss", externalId: dd } },
    select: { id: true, title: true },
  });

  if (daCo) {
    return {
      ok: false,
      thongDiep: `"${daCo.title}" đã có trong danh sách nguồn rồi.`,
      idNguon: daCo.id,
    };
  }

  const nguon = await prisma.source.create({
    data: {
      type: "podcast_rss",
      externalId: dd,
      url: kenh.trangChu,
      title: kenh.ten,
      contentGroupHint: nhomGoiY,
      // Chủ nhà tự tay tìm và tự tay thêm — đây là nguồn quen, khác hẳn nguồn
      // do máy đào ra. Nên được vào thẳng phần dành cho nguồn đã theo dõi.
      subscriptionStatus: "subscribed",
    },
    select: { id: true },
  });

  return {
    ok: true,
    thongDiep: `Đã thêm "${kenh.ten}" — ${kenh.cacTap.length} tập có sẵn.`,
    idNguon: nguon.id,
    ten: kenh.ten,
    soTapTrongFeed: kenh.cacTap.length,
    canhBaoNgonNgu: laTiengViet(kenh.ngonNgu)
      ? undefined
      : `Feed này tự khai ngôn ngữ là "${kenh.ngonNgu ?? "không ghi"}" chứ không ` +
        "phải tiếng Việt. Thẻ này hay sai nên vẫn thêm được — nhưng nếu kênh " +
        "đúng là tiếng Anh thì các tập sẽ bị ẩn khỏi trang chính.",
  };
}

/** Lưu một tập podcast. Trả về `true` nếu là tập mới. */
async function luuMotTap(
  idNguon: string,
  tap: TapPodcast,
  ngonNguKenh: string | null,
  anhBiaKenh: string | null,
): Promise<boolean> {
  const daCo = await prisma.contentItem.findUnique({
    where: { sourceId_externalId: { sourceId: idNguon, externalId: tap.ma } },
    select: { id: true },
  });
  if (daCo) return false;

  // Dùng phần RIÊNG của tập, không dùng nguyên văn. Nguyên văn thường là lời
  // rao lặp ở mọi tập; đưa nó đi chấm thì Claude chấm quảng cáo chứ không chấm
  // nội dung. Xem `bocPhanRieng` trong podcast.ts.
  const coMoTa = (tap.moTaRieng?.length ?? 0) >= TOI_THIEU_MO_TA;

  await prisma.$transaction(
    async (tx) => {
      const muc = await tx.contentItem.create({
        data: {
          sourceId: idNguon,
          externalId: tap.ma,
          url: tap.duongDanTrang ?? tap.duongDanAmThanh,
          audioUrl: tap.duongDanAmThanh,
          type: "podcast_episode",
          title: tap.tieuDe,
          description: tap.moTa?.slice(0, 2_000) ?? null,
          thumbnailUrl: tap.anh ?? anhBiaKenh,
          publishedAt: tap.dangLuc,
          durationSeconds: tap.giay,
          originalLanguage: ngonNguKenh,
          contentGroup: "other",
          ingestSource: "subscribed",
          // Giọng người thật do chính tác giả thu — không phải giọng máy, cũng
          // không phải bài viết chờ đọc
          narrationType: "human_voice",
          // Có mô tả hay không thì bước phân loại vẫn chạy được: nó nhận
          // `loiThoai: null` và xoay sang tiêu đề với tên kênh
          status: coMoTa ? "pending_classification" : "transcript_unavailable",
        },
      });

      if (coMoTa && tap.moTaRieng) {
        await tx.transcript.create({
          data: {
            contentItemId: muc.id,
            source: "podcast_shownotes",
            rawText: tap.moTaRieng,
            fetchStatus: "success",
          },
        });
      }
    },
    { timeout: HAN_GHI_MS, maxWait: HAN_CHO_MS },
  );

  return true;
}

export interface KetQuaQuetPodcast {
  soKenhQuet: number;
  soTapXet: number;
  soTapThemMoi: number;
  soCoMoTa: number;
  kenhLoi: { ten: string; lyDo: string }[];
}

/**
 * Quét tập mới từ mọi kênh podcast đã thêm.
 *
 * @param soTapMoiKenh Số tập xét ở mỗi kênh, tính từ mới nhất
 * @param soNgayGanDay Chỉ lấy tập đăng trong ngần này ngày
 */
export async function quetPodcast(
  soTapMoiKenh = 10,
  soNgayGanDay = 30,
  bao?: (dong: string) => void,
): Promise<KetQuaQuetPodcast> {
  const cacKenh = await prisma.source.findMany({
    where: { type: "podcast_rss" },
    select: { id: true, title: true, externalId: true },
  });

  const moc = new Date(Date.now() - soNgayGanDay * 86_400_000);
  const kenhLoi: { ten: string; lyDo: string }[] = [];

  let soTapXet = 0;
  let soTapThemMoi = 0;
  let soCoMoTa = 0;

  for (const kenh of cacKenh) {
    let du;
    try {
      du = await docFeedPodcast(kenh.externalId);
    } catch (e) {
      kenhLoi.push({
        ten: kenh.title,
        lyDo: e instanceof Error ? e.message : String(e),
      });
      continue;
    }

    const canXet = du.cacTap
      .filter((t) => !t.dangLuc || t.dangLuc >= moc)
      .slice(0, soTapMoiKenh);

    bao?.(
      `\n${kenh.title} — ${canXet.length}/${du.cacTap.length} tập trong ${soNgayGanDay} ngày`,
    );

    for (const tap of canXet) {
      soTapXet += 1;
      try {
        const themDuoc = await luuMotTap(kenh.id, tap, du.ngonNgu, du.anhBia);
        if (!themDuoc) continue;

        soTapThemMoi += 1;
        const coMoTa = (tap.moTaRieng?.length ?? 0) >= TOI_THIEU_MO_TA;
        if (coMoTa) soCoMoTa += 1;

        const phut = tap.giay ? `${Math.round(tap.giay / 60)} phút` : "chưa rõ";
        bao?.(
          `  ✓ ${tap.tieuDe.slice(0, 50)} — ${phut}${
            coMoTa ? "" : ", mô tả chỉ có lời rao"
          }`,
        );
      } catch (e) {
        // Một tập hỏng không được làm chết cả mẻ quét
        bao?.(
          `  ✗ ${tap.tieuDe.slice(0, 46)} — ${e instanceof Error ? e.message.slice(0, 60) : e}`,
        );
      }
    }

    await prisma.source.update({
      where: { id: kenh.id },
      data: { lastCrawledAt: new Date() },
    });
  }

  return {
    soKenhQuet: cacKenh.length,
    soTapXet,
    soTapThemMoi,
    soCoMoTa,
    kenhLoi,
  };
}
