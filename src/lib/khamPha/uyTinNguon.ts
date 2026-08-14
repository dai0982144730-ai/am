/**
 * Nguồn lạ nào đã tự chứng minh, nguồn nào nên thôi lấy bài.
 *
 * ĐÂY LÀ THỨ KHIẾN HỆ THỐNG KHÁ DẦN LÊN. Không có nó thì tháng sau chủ nhà vẫn
 * nhận đúng loại rác như tháng trước — máy đi tìm mãi mà không bao giờ học được
 * lần trước tìm sai ở đâu.
 *
 * TÍNH NGAY LÚC HỎI, KHÔNG LƯU BẢNG RIÊNG. Mọi thứ cần thiết đã nằm sẵn trong
 * `ConsumptionSession`: chấm mấy sao, xem được bao nhiêu phần. Dựng thêm một
 * bảng điểm uy tín nữa thì phải lo giữ cho nó khớp với sự thật, mà tính lại
 * mỗi lần thì rẻ và không bao giờ lệch.
 *
 * HAI TÍN HIỆU, TRỌNG SỐ KHÁC HẲN NHAU:
 *
 *   - **Số sao** là lời nói thẳng, nặng ký nhất.
 *   - **Bỏ ngang rất sớm** là lời nói ngầm. Một mình nó chưa đủ kết tội — mở
 *     ra rồi có việc phải đi cũng là bỏ ngang. Chỉ tính khi lặp lại nhiều lần.
 */

import { prisma } from "@/lib/db/prisma";

/** Dưới ngần này sao thì coi là chủ nhà không thích. */
const SAO_COI_LA_TE = 2.5;

/** Phải có đủ ngần này lượt đánh giá mới dám kết luận về một nguồn. */
const TOI_THIEU_LUOT_DANH_GIA = 3;

/** Xem dưới ngần này phần trăm thì coi là bỏ ngang. */
const NGUONG_BO_NGANG = 0.15;

/** Bỏ ngang ngần này lần liên tiếp thì nguồn bị nghi. */
const TOI_THIEU_LUOT_BO_NGANG = 4;

export interface UyTinMotNguon {
  idNguon: string;
  tenNguon: string;
  soLuotDanhGia: number;
  saoTrungBinh: number | null;
  soLuotBoNgang: number;
  soLuotMo: number;
  /** Có nên thôi lấy bài từ nguồn này không */
  nenBo: boolean;
  lyDo: string | null;
}

/**
 * Chấm lại toàn bộ nguồn chưa theo dõi dựa trên phản ứng thật của chủ nhà.
 *
 * Chỉ xét nguồn lạ. Kênh chủ nhà tự tay đăng ký thì dù có chấm sao thấp mấy
 * cũng không được tự ý bỏ — đó là lựa chọn của họ, không phải việc của máy.
 */
export async function chamUyTinNguonLa(): Promise<UyTinMotNguon[]> {
  const cacNguon = await prisma.source.findMany({
    where: { subscriptionStatus: { not: "subscribed" } },
    select: {
      id: true,
      title: true,
      contentItems: {
        select: {
          consumptionSessions: {
            select: { explicitRating: true, percentComplete: true },
          },
        },
      },
    },
  });

  const ketQua: UyTinMotNguon[] = [];

  for (const nguon of cacNguon) {
    const cacPhien = nguon.contentItems.flatMap((m) => m.consumptionSessions);

    const cacSao = cacPhien
      .map((p) => p.explicitRating)
      .filter((s): s is number => typeof s === "number");

    const soLuotBoNgang = cacPhien.filter(
      (p) => p.percentComplete < NGUONG_BO_NGANG,
    ).length;

    const saoTrungBinh =
      cacSao.length > 0
        ? cacSao.reduce((a, b) => a + b, 0) / cacSao.length
        : null;

    let nenBo = false;
    let lyDo: string | null = null;

    // Số sao nói thẳng — xét trước và đủ để kết luận một mình
    if (
      saoTrungBinh !== null &&
      cacSao.length >= TOI_THIEU_LUOT_DANH_GIA &&
      saoTrungBinh < SAO_COI_LA_TE
    ) {
      nenBo = true;
      lyDo = `${cacSao.length} lượt chấm, trung bình ${saoTrungBinh.toFixed(1)} sao`;
    }

    // Bỏ ngang là tín hiệu ngầm — chỉ tính khi CHƯA từng được chấm sao tử tế,
    // kẻo một nguồn hay nhưng bài dài bị oan vì hay nghe dở dang
    if (
      !nenBo &&
      saoTrungBinh === null &&
      soLuotBoNgang >= TOI_THIEU_LUOT_BO_NGANG
    ) {
      nenBo = true;
      lyDo = `mở ${soLuotBoNgang} lần đều bỏ ngang trong vài giây đầu`;
    }

    ketQua.push({
      idNguon: nguon.id,
      tenNguon: nguon.title,
      soLuotDanhGia: cacSao.length,
      saoTrungBinh,
      soLuotBoNgang,
      soLuotMo: cacPhien.length,
      nenBo,
      lyDo,
    });
  }

  return ketQua;
}

/** Id các nguồn lạ nên thôi lấy bài. */
export async function idNguonNenBo(): Promise<string[]> {
  const uyTin = await chamUyTinNguonLa();
  return uyTin.filter((u) => u.nenBo).map((u) => u.idNguon);
}
