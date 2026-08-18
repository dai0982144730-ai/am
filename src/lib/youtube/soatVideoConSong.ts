/**
 * Soát xem video trong kho có còn xem được trên YouTube không.
 *
 * ## Vì sao cần
 *
 * Chủ kênh xoá video, hoặc chuyển nó sang riêng tư, bất cứ lúc nào — Am đã
 * quét về từ trước thì vẫn giữ nguyên tiêu đề, ảnh, điểm chất lượng, và vẫn
 * bày lên Trang chủ như thường. Bấm vào mới hiện "Video không có sẵn".
 *
 * Chủ dự án bắt gặp đúng chuyện đó ngày 2026-08-18: *"nếu là video riêng tư
 * người ngoài không thể xem thì sao lại đưa cho tôi xem làm gì?"*
 *
 * ## Cách nhận ra
 *
 * `videos.list` **không trả về gì cả** cho video đã xoá hoặc để riêng tư —
 * không báo lỗi, chỉ đơn giản là thiếu trong danh sách trả về. Nên cứ hỏi cả
 * lô 50 mã rồi đối chiếu xem thiếu mã nào.
 *
 * Giá: 1 đơn vị cho mỗi 50 video. Soi cả 182 video trong luồng tuyển chọn hết
 * 4 đơn vị trên 10.000 mỗi ngày.
 *
 * ## Sống lại thì bỏ đánh dấu
 *
 * Video riêng tư có thể được mở công khai trở lại. Nên hàm này đánh dấu cả hai
 * chiều, không chỉ một chiều — thấy còn sống thì gỡ cờ ra.
 */

import { prisma } from "@/lib/db/prisma";
import { goiYouTube } from "@/lib/youtube/goiApi";

/** `videos.list` nhận tối đa 50 mã mỗi lượt. */
const TOI_DA_MOI_LO = 50;

export interface KetQuaSoat {
  daSoat: number;
  moiChet: number;
  songLai: number;
  donViHanMuc: number;
}

function chiaLo<T>(mang: T[], coLo: number): T[][] {
  const ra: T[][] = [];
  for (let i = 0; i < mang.length; i += coLo) ra.push(mang.slice(i, i + coLo));
  return ra;
}

/**
 * Soát toàn bộ video YouTube trong kho.
 *
 * Bỏ qua video `chiTrongPlaylist` — chúng vốn chỉ để sắp xếp playlist, mà
 * playlist thì vẫn hiện cả video chết để chủ nhà thấy mà bỏ đi.
 */
export async function soatVideoConSong(): Promise<KetQuaSoat> {
  const cac = await prisma.contentItem.findMany({
    where: {
      chiTrongPlaylist: false,
      source: { type: "youtube_channel" },
      externalId: { not: "" },
    },
    select: { id: true, externalId: true, khongXemDuoc: true },
  });

  const ketQua: KetQuaSoat = { daSoat: cac.length, moiChet: 0, songLai: 0, donViHanMuc: 0 };
  if (cac.length === 0) return ketQua;

  const conSong = new Set<string>();
  for (const lo of chiaLo(cac, TOI_DA_MOI_LO)) {
    const tra = await goiYouTube<{ items?: { id?: string }[] }>(
      "videos.list",
      "videos",
      { part: "id", id: lo.map((c) => c.externalId).join(",") },
      { canDangNhap: true },
    );
    ketQua.donViHanMuc += 1;
    for (const i of tra.items ?? []) if (i.id) conSong.add(i.id);
  }

  const chetMoi = cac.filter((c) => !conSong.has(c.externalId) && !c.khongXemDuoc);
  const songLai = cac.filter((c) => conSong.has(c.externalId) && c.khongXemDuoc);

  if (chetMoi.length > 0) {
    await prisma.contentItem.updateMany({
      where: { id: { in: chetMoi.map((c) => c.id) } },
      data: { khongXemDuoc: true },
    });
    ketQua.moiChet = chetMoi.length;
  }
  if (songLai.length > 0) {
    await prisma.contentItem.updateMany({
      where: { id: { in: songLai.map((c) => c.id) } },
      data: { khongXemDuoc: false },
    });
    ketQua.songLai = songLai.length;
  }

  return ketQua;
}
