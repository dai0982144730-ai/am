/**
 * Chia suất phân loại mỗi đêm — theo chuyên mục và theo loại nguồn.
 *
 * ## Vấn đề nó giải
 *
 * Trước đây mỗi đêm Claude lấy 80 bài **cũ nhất, không phân biệt nguồn**. Đo
 * ngày 2026-08-16 thì kết quả đúng như dự đoán: YouTube có 269 kênh nên ném vào
 * hàng chờ tới 2.150 bài mỗi đêm, còn podcast có 4 kênh nên ném vào 20. YouTube
 * nuốt gần hết suất, và kho thành **81% YouTube, 2% podcast**.
 *
 * Giờ chủ nhà tự đặt: mỗi chuyên mục bao nhiêu bài, và bao nhiêu phần trăm lấy
 * ở loại nguồn nào.
 *
 * ## Chỗ tưởng như không làm được
 *
 * Muốn chia theo chuyên mục thì phải biết bài thuộc mục nào — mà chuyên mục lại
 * do chính Claude quyết định trong lúc phân loại. Vòng luẩn quẩn.
 *
 * Lối ra là `Source.contentGroupHint`: mỗi kênh đã được xếp sẵn vào một mảng từ
 * lượt quét kênh hằng tuần. **Đã đo độ chính xác trên 406 bài đã phân loại:
 * 384 bài khớp, tức 95%.** Đủ tốt. Phần 5% lệch thì chấp nhận — chống lại nó
 * nghĩa là phải phân loại trước rồi mới chia suất, tức là quay về đúng vòng
 * luẩn quẩn ban đầu.
 *
 * ## Thiếu thì lấy bù, và nói ra
 *
 * Chủ nhà đặt 45% podcast, nhưng cả kho mới có 4 kênh podcast nên trần tuyệt
 * đối là 20 tập/đêm, thực tế thường vài tập. Truyện và Music thì **không có một
 * tập podcast hay bài blog nào**.
 *
 * Nên thiếu ở đâu thì lấy bù ở nguồn khác cho đủ số, và **ghi rõ đã bù bao
 * nhiêu**. Chủ dự án chốt 2026-08-16: chính con số hụt đó là thứ nhắc đi thêm
 * nguồn. Im lặng lấy bù thì mọi thứ trông như đang chạy đúng.
 */

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

import {
  CAC_CHUYEN_MUC,
  CAC_NHOM_NGUON,
  chuanHoaTyLe,
  doSo,
  DON_VI_NGUON,
  nhomCuaLoaiNguon,
  SO_LAN_TOI_DA,
  SUAT_MAC_DINH,
  TEN_CHUYEN_MUC,
  type CaiDatSuat,
  type MaChuyenMuc,
  type MaNhomNguon,
} from "./mucSuat";

export * from "./mucSuat";

/** Đọc cài đặt suất, thiếu chỗ nào thì lấy mặc định chỗ đó. */
export async function docCaiDatSuat(): Promise<CaiDatSuat> {
  const caiDat = await prisma.userAssistantSettings.findUnique({
    where: { id: "singleton" },
    select: { suatChuyenMuc: true, tyLeNguon: true },
  });

  const tho = (caiDat?.suatChuyenMuc ?? {}) as Record<string, unknown>;
  const chuyenMuc = {} as Record<MaChuyenMuc, number>;
  for (const m of CAC_CHUYEN_MUC) {
    chuyenMuc[m] = doSo(
      tho[m],
      SUAT_MAC_DINH[m],
      SUAT_MAC_DINH[m] * SO_LAN_TOI_DA,
    );
  }

  return {
    chuyenMuc,
    tyLeNguon: chuanHoaTyLe(
      (caiDat?.tyLeNguon ?? {}) as Partial<Record<MaNhomNguon, number>>,
    ),
  };
}

export interface PhanBoMotMuc {
  chuyenMuc: MaChuyenMuc;
  /** Số bài đặt ra cho mục này */
  datRa: number;
  /** Số bài thật sự chọn được */
  chonDuoc: number;
  /** Từng nhóm nguồn góp bao nhiêu */
  theoNguon: Record<MaNhomNguon, number>;
  /** Nhóm nguồn nào không đủ hàng, và thiếu bao nhiêu */
  hut: { nhom: MaNhomNguon; can: number; co: number }[];
}

export interface KetQuaChiaSuat {
  /** Id các bài được chọn, đã trộn đủ mọi chuyên mục */
  cacId: string[];
  tongDatRa: number;
  tongChonDuoc: number;
  theoMuc: PhanBoMotMuc[];
  /** Tổng thật sự lấy được từ mỗi nhóm nguồn */
  thucTeTheoNguon: Record<MaNhomNguon, number>;
}

/** Bài đang chờ, kèm hai thứ cần để xếp: mảng của kênh và loại nguồn. */
const CHON_CHO = {
  id: true,
  publishedAt: true,
  source: { select: { contentGroupHint: true, type: true } },
} satisfies Prisma.ContentItemSelect;

/**
 * Chọn ra danh sách bài cho lượt phân loại đêm nay.
 *
 * @param heSoCuongDo Nhân thêm từ thanh cường độ chung. 1 = như đã đặt.
 */
export async function chiaSuatPhanLoai(
  heSoCuongDo = 1,
): Promise<KetQuaChiaSuat> {
  const caiDat = await docCaiDatSuat();

  const cho = await prisma.contentItem.findMany({
    where: {
      status: { in: ["pending_classification", "transcript_unavailable"] },
      classification: null,
    },
    select: CHON_CHO,
    orderBy: { publishedAt: { sort: "desc", nulls: "last" } },
  });

  // Xếp sẵn vào ô [chuyên mục][nhóm nguồn]. Kênh chưa xếp mảng thì rơi vào
  // "ngẫu hứng" — đúng nghĩa: chưa biết nó thuộc đâu.
  const o = new Map<string, string[]>();
  for (const b of cho) {
    const goi = b.source.contentGroupHint;
    const muc: MaChuyenMuc =
      goi && (CAC_CHUYEN_MUC as readonly string[]).includes(goi)
        ? (goi as MaChuyenMuc)
        : "ngau_hung";
    const nhom = nhomCuaLoaiNguon(b.source.type);
    const khoa = `${muc}|${nhom}`;
    const ds = o.get(khoa) ?? [];
    ds.push(b.id);
    o.set(khoa, ds);
  }

  const suat = {} as Record<MaChuyenMuc, number>;
  let tongDatRa = 0;
  for (const m of CAC_CHUYEN_MUC) {
    suat[m] = Math.round(caiDat.chuyenMuc[m] * heSoCuongDo);
    tongDatRa += suat[m];
  }

  // Trần theo nhóm nguồn, tính trên TỔNG cả đêm chứ không tính riêng từng mục.
  // Chủ dự án chốt 2026-08-16: suất podcast được Triết học và Khoa học lấp hộ
  // khi Truyện với Music không có tập nghe nào — tính riêng từng mục thì hai
  // mục đó luôn hụt mà chẳng ai bù được.
  const tranNguon = {} as Record<MaNhomNguon, number>;
  for (const n of CAC_NHOM_NGUON) {
    tranNguon[n] = Math.round((tongDatRa * caiDat.tyLeNguon[n]) / 100);
  }

  const daLay = { youtube: 0, nghe: 0, viet: 0 } as Record<MaNhomNguon, number>;
  const cacId: string[] = [];
  const theoMuc: PhanBoMotMuc[] = [];

  for (const m of CAC_CHUYEN_MUC) {
    const canLay = suat[m];
    const gop: Record<MaNhomNguon, number> = { youtube: 0, nghe: 0, viet: 0 };
    const hut: PhanBoMotMuc["hut"] = [];
    let daLayMuc = 0;

    // Vòng một: tôn trọng trần từng nhóm nguồn
    for (const n of CAC_NHOM_NGUON) {
      const conCuaMuc = canLay - daLayMuc;
      if (conCuaMuc <= 0) break;

      const phanCuaNhom = Math.round((canLay * caiDat.tyLeNguon[n]) / 100);
      const conCuaNhom = Math.max(0, tranNguon[n] - daLay[n]);
      const muon = Math.min(phanCuaNhom, conCuaNhom, conCuaMuc);
      if (muon <= 0) {
        if (phanCuaNhom > 0) hut.push({ nhom: n, can: phanCuaNhom, co: 0 });
        continue;
      }

      const kho = o.get(`${m}|${n}`) ?? [];
      const lay = kho.splice(0, muon);
      if (lay.length < phanCuaNhom) {
        hut.push({ nhom: n, can: phanCuaNhom, co: lay.length });
      }
      cacId.push(...lay);
      gop[n] += lay.length;
      daLay[n] += lay.length;
      daLayMuc += lay.length;
    }

    // Vòng hai: còn thiếu thì lấy bù ở bất cứ nhóm nào còn hàng, kể cả vượt
    // trần của nhóm đó. Đủ số quan trọng hơn đúng tỷ lệ — và phần bù được ghi
    // lại để hiện lên màn hình.
    for (const n of CAC_NHOM_NGUON) {
      if (daLayMuc >= canLay) break;
      const kho = o.get(`${m}|${n}`) ?? [];
      const lay = kho.splice(0, canLay - daLayMuc);
      cacId.push(...lay);
      gop[n] += lay.length;
      daLay[n] += lay.length;
      daLayMuc += lay.length;
    }

    theoMuc.push({
      chuyenMuc: m,
      datRa: canLay,
      chonDuoc: daLayMuc,
      theoNguon: gop,
      hut,
    });
  }

  return {
    cacId,
    tongDatRa,
    tongChonDuoc: cacId.length,
    theoMuc,
    thucTeTheoNguon: daLay,
  };
}

/** Một dòng tóm tắt để ghi vào nhật ký quét đêm. */
export function tomTatChiaSuat(kq: KetQuaChiaSuat): string {
  const muc = kq.theoMuc
    .filter((m) => m.datRa > 0)
    .map((m) =>
      m.chonDuoc === m.datRa
        ? `${TEN_CHUYEN_MUC[m.chuyenMuc]} ${m.chonDuoc}`
        : `${TEN_CHUYEN_MUC[m.chuyenMuc]} ${m.chonDuoc}/${m.datRa}`,
    )
    .join(", ");
  const nguon = CAC_NHOM_NGUON.map(
    (n) => `${kq.thucTeTheoNguon[n]} ${DON_VI_NGUON[n]}`,
  ).join(" + ");
  return `${kq.tongChonDuoc}/${kq.tongDatRa} bài — ${muc} · ${nguon}`;
}
