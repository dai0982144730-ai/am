/**
 * Luồng theo dõi bộ nhiều tập — tách hẳn khỏi đường ống suất phân loại thường.
 *
 * Chốt 2026-08-17: gặp một tập có vẻ hay thì KHÔNG lấy ngay — đi tìm tập 1
 * trước, chỉ theo tiếp nếu tập 1 đủ hay, và nhả tập mới dần theo tốc độ chủ
 * nhà xem kịp, bỏ hẳn nếu ba ngày không xem.
 *
 * ## Hai việc tách rời, chạy ở hai chỗ khác nhau trong đêm quét
 *
 *   1. `xuLyTapMoiPhanLoai` — chạy NGAY SAU khi chấm điểm vòng 1, xem những
 *      tập vừa phân loại đêm nay có phải một phần của bộ nào không, quyết
 *      định dò tập 1 hay theo tiếp.
 *   2. `capNhatTienDoTheoDoi` — chạy MỖI ĐÊM bất kể có tập mới hay không, xem
 *      các bộ đang theo có nên thả thêm, chờ tiếp, hay bị loại vì ba ngày
 *      không xem.
 *
 * ## Giới hạn đã biết, chấp nhận cho bản đầu
 *
 * "Chỉ tối đa 2 tập/ngày" chỉ chắc chắn đúng với phần Am CHỦ ĐỘNG ưu tiên
 * phân loại. Một tập của bộ đang theo vẫn có thể được phân loại qua đúng suất
 * chuyên mục bình thường (`chiaSuatPhanLoai`) mà không đi qua chỗ này — trần
 * 2 tập/ngày khi đó không chặn được. Chấp nhận vì không có bước gác nào rẻ mà
 * không phải sửa cả đường ống phân loại chính.
 */

import { prisma } from "@/lib/db/prisma";
import { phanLoaiHangLoat } from "@/lib/llm/luuPhanLoai";
import { chamDiemHangLoat } from "@/lib/scoring/chamDiem";

import {
  NGUONG_TAP_MOT,
  nhanDangTap,
  SO_NGAY_CHO_XEM,
  TRAN_TAP_MOI_NGAY,
} from "./nhanDangTap";

/** Loại nguồn có cấu trúc tập — chốt 2026-08-17: không riêng YouTube. */
const LOAI_NGUON_AP_DUNG = ["youtube_channel", "podcast_rss"] as const;

const NGAY_MS = 86_400_000;

function cungNgay(a: Date, b: Date): boolean {
  return a.toDateString() === b.toDateString();
}

/**
 * Gắn một `TheoDoiBoTap` cho một tập MỚI TÌM THẤY (soTap = 1), quyết định
 * ngay tập 1 có đạt hay không.
 *
 * Trả về bộ vừa tạo — `dang_theo` nếu đạt (đã thả tập 1, và tập 2 nếu có
 * sẵn), `da_loai` nếu không đạt.
 */
async function taoBoTuTapMot(
  sourceId: string,
  khoaChuoi: string,
  tapMot: { id: string; title: string },
): Promise<void> {
  const diem = await prisma.contentScore.findUnique({
    where: { contentItemId: tapMot.id },
    select: { compositeScore: true },
  });

  const dat = (diem?.compositeScore ?? 0) >= NGUONG_TAP_MOT;

  const bo = await prisma.theoDoiBoTap.create({
    data: {
      sourceId,
      khoaChuoi,
      tenHienThi: tapMot.title,
      trangThai: dat ? "dang_theo" : "da_loai",
      tapCaoNhatDaTha: dat ? 1 : 0,
      thaLanCuoiLuc: dat ? new Date() : null,
      soTapThaHomNay: dat ? 1 : 0,
      lyDoLoai: dat
        ? null
        : `Tập 1 chỉ được ${(diem?.compositeScore ?? 0).toFixed(1)}/10, dưới ngưỡng ${NGUONG_TAP_MOT} — không theo tiếp.`,
    },
  });

  await prisma.tapCuaBo.create({
    data: { boId: bo.id, contentItemId: tapMot.id, soTap: 1 },
  });

  if (!dat) return;

  // Tập 1 đạt — tìm tập 2 sẵn có trong kho để thả cùng luôn, đúng chốt "lấy
  // tập 1 và 2". Nếu tập 2 chưa quét được thì thôi, bước `capNhatTienDoTheoDoi`
  // đêm sau sẽ thả khi nó xuất hiện và tập 1 đã xem xong.
  await thaTapKeTiep(bo.id, sourceId, khoaChuoi);
}

/**
 * Tìm và thả thêm tập kế tiếp đã có sẵn trong kho cho một bộ, không vượt quá
 * trần 2 tập/ngày — CỘNG DỒN đúng trong ngày, không ghi đè.
 *
 * Đã vấp thật lúc viết: tập 1 và tập 2 cùng thả trong một lượt gọi (từ
 * `taoBoTuTapMot`) — nếu mỗi lần gọi hàm này tự ý GHI ĐÈ `soTapThaHomNay`
 * bằng đúng số tập thả trong lượt đó, thì thả tập 1 (ghi 1) rồi gọi tiếp để
 * thả tập 2 (ghi lại đúng 1, XOÁ MẤT lượt tập 1 vừa ghi) — trần 2/ngày thành
 * ra không chặn được gì. Nên hàm này LUÔN đọc lại trạng thái mới nhất từ
 * database rồi cộng dồn, chứ không tin số tham số truyền vào.
 */
async function thaTapKeTiep(
  boId: string,
  sourceId: string,
  khoaChuoi: string,
): Promise<number> {
  const bo = await prisma.theoDoiBoTap.findUniqueOrThrow({
    where: { id: boId },
    select: { tapCaoNhatDaTha: true, thaLanCuoiLuc: true, soTapThaHomNay: true },
  });

  const daThaHomNay =
    bo.thaLanCuoiLuc && cungNgay(bo.thaLanCuoiLuc, new Date()) ? bo.soTapThaHomNay : 0;
  const conHan = Math.max(0, TRAN_TAP_MOI_NGAY - daThaHomNay);
  if (conHan === 0) return 0;

  const khopSauTap: { id: string; soTap: number; daPhanLoai: boolean }[] = [];

  // Nguồn 1: tập ĐÃ GẮN vào bộ này (qua xuLyTapMoiPhanLoai khi vừa phân loại
  // xong) nhưng chưa tới lượt thả — đã chắc chắn phân loại rồi.
  const daGan = await prisma.tapCuaBo.findMany({
    where: { boId, soTap: { gt: bo.tapCaoNhatDaTha } },
    select: { contentItemId: true, soTap: true },
  });
  for (const t of daGan) {
    khopSauTap.push({ id: t.contentItemId, soTap: t.soTap, daPhanLoai: true });
  }

  // Nguồn 2: tập CHƯA TỪNG GẮN vào bộ nào — dò bằng regex trên tiêu đề, vì
  // database không tách sẵn số tập. Cần cho trường hợp tập 2 thả cùng tập 1
  // lúc mới lập bộ: tập 2 có thể đã nằm sẵn trong kho từ trước, chưa từng qua
  // bước gắn nào cả.
  const chuaGan = await prisma.contentItem.findMany({
    where: { sourceId, tapCuaBo: null },
    select: { id: true, title: true, status: true },
    take: 500, // kênh nào cũng khó vượt quá chừng này video/tập
  });
  for (const c of chuaGan) {
    const nd = nhanDangTap(c.title);
    if (nd && nd.khoaChuoi === khoaChuoi && nd.soTap > bo.tapCaoNhatDaTha) {
      khopSauTap.push({ id: c.id, soTap: nd.soTap, daPhanLoai: c.status === "classified" });
    }
  }

  khopSauTap.sort((a, b) => a.soTap - b.soTap);
  const chonRa = khopSauTap.slice(0, conHan);
  if (chonRa.length === 0) {
    await prisma.theoDoiBoTap.update({
      where: { id: boId },
      data: { trangThai: "het_tap_moi" },
    });
    return 0;
  }

  const chuaPhanLoai = chonRa.filter((t) => !t.daPhanLoai).map((t) => t.id);
  if (chuaPhanLoai.length > 0) {
    await phanLoaiHangLoat(chuaPhanLoai.length, undefined, false, false, undefined, chuaPhanLoai);
    await chamDiemHangLoat();
  }

  await prisma.tapCuaBo.createMany({
    data: chonRa.map((t) => ({ boId, contentItemId: t.id, soTap: t.soTap })),
    skipDuplicates: true,
  });

  const capCao = Math.max(bo.tapCaoNhatDaTha, ...chonRa.map((t) => t.soTap));
  await prisma.theoDoiBoTap.update({
    where: { id: boId },
    data: {
      trangThai: "dang_theo",
      tapCaoNhatDaTha: capCao,
      thaLanCuoiLuc: new Date(),
      soTapThaHomNay: daThaHomNay + chonRa.length,
    },
  });

  return chonRa.length;
}

export interface KetQuaXuLyTapMoi {
  daXet: number;
  boMoi: number;
  dangDo: number;
  daLoai: number;
}

/**
 * Xem xét các nội dung VỪA PHÂN LOẠI đêm nay, gắn vào bộ tập nếu có.
 *
 * Ba tình huống, đúng nguyên tắc đã chốt:
 *
 *   - Tập 1 của một bộ chưa từng thấy → chấm điểm, quyết định theo hay bỏ.
 *   - Tập > 1 của một bộ chưa từng thấy → KHÔNG lấy ngay, đi tìm tập 1 trong
 *     kho (đã quét nhưng chưa chắc đã phân loại). Có thì đánh giá tập 1 y hệt
 *     trường hợp trên — coi tên hiển thị của bộ là tên tập 1, không phải tên
 *     tập vừa tìm thấy. Không có thì loại hẳn, ghi rõ lý do.
 *   - Tập của một bộ ĐÃ theo dõi → chỉ gắn thêm vào, không quyết định gì —
 *     việc thả/dừng nằm ở `capNhatTienDoTheoDoi`.
 */
export async function xuLyTapMoiPhanLoai(
  idsVuaPhanLoai: string[],
): Promise<KetQuaXuLyTapMoi> {
  const kq: KetQuaXuLyTapMoi = { daXet: 0, boMoi: 0, dangDo: 0, daLoai: 0 };
  if (idsVuaPhanLoai.length === 0) return kq;

  const cacMuc = await prisma.contentItem.findMany({
    where: {
      id: { in: idsVuaPhanLoai },
      status: "classified",
      source: { type: { in: [...LOAI_NGUON_AP_DUNG] } },
      tapCuaBo: null,
    },
    select: { id: true, title: true, sourceId: true },
  });

  for (const muc of cacMuc) {
    const nd = nhanDangTap(muc.title);
    if (!nd) continue;
    kq.daXet += 1;

    const boSanCo = await prisma.theoDoiBoTap.findUnique({
      where: { sourceId_khoaChuoi: { sourceId: muc.sourceId, khoaChuoi: nd.khoaChuoi } },
      select: { id: true, trangThai: true },
    });

    if (boSanCo) {
      // Bộ đã có sẵn — chỉ gắn thêm, việc thả/dừng nằm ở capNhatTienDoTheoDoi.
      // Đang "hết tập mới" mà có tập tươi thì đánh thức lại để đêm sau xét tiếp.
      await prisma.tapCuaBo.upsert({
        where: { contentItemId: muc.id },
        create: { boId: boSanCo.id, contentItemId: muc.id, soTap: nd.soTap },
        update: {},
      });
      if (boSanCo.trangThai === "het_tap_moi") {
        await prisma.theoDoiBoTap.update({
          where: { id: boSanCo.id },
          data: { trangThai: "dang_theo" },
        });
      }
      continue;
    }

    if (nd.soTap === 1) {
      await taoBoTuTapMot(muc.sourceId, nd.khoaChuoi, muc);
    } else {
      // Tìm tập 1 trong số nội dung CÙNG NGUỒN đã quét được (mọi trạng thái,
      // kể cả chưa phân loại) — kênh vẫn quét theo danh sách video, nên tập 1
      // thường đã nằm sẵn trong kho, chỉ là chưa tới lượt phân loại.
      const ungVienTapMot = await prisma.contentItem.findMany({
        where: { sourceId: muc.sourceId, id: { not: muc.id } },
        select: { id: true, title: true, status: true },
        take: 500,
      });
      const tapMot = ungVienTapMot.find((c) => {
        const nd2 = nhanDangTap(c.title);
        return nd2 && nd2.khoaChuoi === nd.khoaChuoi && nd2.soTap === 1;
      });

      if (!tapMot) {
        await prisma.theoDoiBoTap.create({
          data: {
            sourceId: muc.sourceId,
            khoaChuoi: nd.khoaChuoi,
            tenHienThi: muc.title,
            trangThai: "da_loai",
            lyDoLoai: `Tìm thấy tập ${nd.soTap} nhưng không có tập 1 nào trong kho — không lấy tập giữa chừng.`,
          },
        });
        kq.daLoai += 1;
        continue;
      }

      if (tapMot.status !== "classified") {
        await phanLoaiHangLoat(1, undefined, false, false, undefined, [tapMot.id]);
        await chamDiemHangLoat();
      }
      await taoBoTuTapMot(muc.sourceId, nd.khoaChuoi, tapMot);
    }

    const boMoi = await prisma.theoDoiBoTap.findUnique({
      where: { sourceId_khoaChuoi: { sourceId: muc.sourceId, khoaChuoi: nd.khoaChuoi } },
      select: { trangThai: true },
    });
    kq.boMoi += 1;
    if (boMoi?.trangThai === "dang_theo") kq.dangDo += 1;
    else kq.daLoai += 1;
  }

  return kq;
}

export interface KetQuaCapNhatTheoDoi {
  daXet: number;
  thaThem: number;
  loaiVi3Ngay: number;
  hetTapMoi: number;
}

/**
 * Chạy MỖI ĐÊM cho mọi bộ đang theo dõi — quyết định thả thêm, chờ tiếp, hay
 * loại vì ba ngày không xem.
 *
 * "Xem hết" dựa vào `ConsumptionSession.completed` — đã tính sẵn theo chỗ xa
 * nhất từng tới (`percentComplete >= 90%`), nên xem ngắt quãng nhiều lần hay
 * bỏ dở gần cuối vì quảng cáo vẫn tính đúng, không cần ngưỡng riêng ở đây.
 */
export async function capNhatTienDoTheoDoi(): Promise<KetQuaCapNhatTheoDoi> {
  const kq: KetQuaCapNhatTheoDoi = { daXet: 0, thaThem: 0, loaiVi3Ngay: 0, hetTapMoi: 0 };

  const cacBo = await prisma.theoDoiBoTap.findMany({
    where: { trangThai: { in: ["dang_theo", "het_tap_moi"] } },
    select: {
      id: true,
      sourceId: true,
      khoaChuoi: true,
      tapCaoNhatDaTha: true,
      thaLanCuoiLuc: true,
      soTapThaHomNay: true,
      tapPhim: {
        select: { contentItemId: true, soTap: true },
      },
    },
  });

  const bayGio = new Date();

  for (const bo of cacBo) {
    kq.daXet += 1;
    const idsDaTha = bo.tapPhim
      .filter((t) => t.soTap <= bo.tapCaoNhatDaTha)
      .map((t) => t.contentItemId);
    if (idsDaTha.length === 0) continue;

    const daXemXong = await prisma.consumptionSession.findMany({
      where: { contentItemId: { in: idsDaTha }, completed: true },
      select: { contentItemId: true },
      distinct: ["contentItemId"],
    });
    const xemHet = daXemXong.length >= idsDaTha.length;

    if (!xemHet) {
      const moc = bo.thaLanCuoiLuc ?? bayGio;
      if (bayGio.getTime() - moc.getTime() > SO_NGAY_CHO_XEM * NGAY_MS) {
        await prisma.theoDoiBoTap.update({
          where: { id: bo.id },
          data: {
            trangThai: "da_loai",
            lyDoLoai: `Thả tập ${bo.tapCaoNhatDaTha} được ${SO_NGAY_CHO_XEM} ngày mà chưa xem hết — loại khỏi theo dõi.`,
          },
        });
        kq.loaiVi3Ngay += 1;
      }
      continue;
    }

    // Xem hết rồi — thaTapKeTiep tự kiểm lại hạn mức hôm nay trước khi thả
    const soDaTha = await thaTapKeTiep(bo.id, bo.sourceId, bo.khoaChuoi);
    if (soDaTha > 0) kq.thaThem += 1;
    else kq.hetTapMoi += 1;
  }

  return kq;
}
