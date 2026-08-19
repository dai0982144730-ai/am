"use server";

/**
 * Các thao tác ghi từ trang Cài đặt.
 *
 * Mọi hàm ở đây đều **chặn cửa bằng `doiHoiChuDuAn` ngay dòng đầu**. Đây là
 * chốt chặn thật, không phải chỉ giấu nút đi trên giao diện: nếu ai đó gọi
 * thẳng vào server action, họ vẫn bị chặn.
 */

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db/prisma";
import { timPodcast, type KetQuaTim } from "@/lib/nguon/podcast";
import {
  quetPodcast,
  themKenhPodcast,
  themKenhSoundCloud,
} from "@/lib/nguon/quetPodcast";
import { doiHoiChuDuAn } from "@/lib/quyen";
import { CAC_GIONG } from "@/lib/tts/giong";
import { TOC_DO_MAX, TOC_DO_MIN } from "@/components/TrinhPhatAmThanh";
import type { ContentGroup, SourceType } from "@/generated/prisma/enums";
import {
  CHUYEN_MUC_CO_CHU_DE,
  maTuTen,
} from "@/lib/nghiepVu/chuDeCon";

/** Chặn cửa dùng chung cho mấy việc chủ đề con. */
async function chanCua(
  viec: string,
): Promise<{ ok: false; thongDiep: string } | null> {
  try {
    await doiHoiChuDuAn(viec);
    return null;
  } catch (e) {
    return {
      ok: false,
      thongDiep: e instanceof Error ? e.message : "Không có quyền.",
    };
  }
}

/**
 * Lưu bộ trọng số chấm điểm cho một loại nguồn.
 *
 * Trọng số được chuẩn hoá về tổng bằng 1 trước khi lưu, nên người dùng cứ kéo
 * thanh trượt thoải mái mà không phải tự tính cho tròn 100%.
 */
export async function luuTrongSo(
  loaiNguon: SourceType,
  trongSo: {
    popularity: number;
    engagementDepth: number;
    discussion: number;
    authority: number;
    contentQuality: number;
  },
): Promise<{ ok: boolean; thongDiep: string }> {
  try {
    await doiHoiChuDuAn("chỉnh trọng số chấm điểm");
  } catch (e) {
    return {
      ok: false,
      thongDiep: e instanceof Error ? e.message : "Không có quyền.",
    };
  }

  const tong =
    trongSo.popularity +
    trongSo.engagementDepth +
    trongSo.discussion +
    trongSo.authority +
    trongSo.contentQuality;

  if (tong <= 0) {
    return { ok: false, thongDiep: "Tổng trọng số phải lớn hơn 0." };
  }

  await prisma.sourceQualityProfile.upsert({
    where: { sourceType: loaiNguon },
    create: {
      sourceType: loaiNguon,
      weightPopularity: trongSo.popularity / tong,
      weightEngagementDepth: trongSo.engagementDepth / tong,
      weightDiscussion: trongSo.discussion / tong,
      weightAuthority: trongSo.authority / tong,
      weightContentQuality: trongSo.contentQuality / tong,
    },
    update: {
      weightPopularity: trongSo.popularity / tong,
      weightEngagementDepth: trongSo.engagementDepth / tong,
      weightDiscussion: trongSo.discussion / tong,
      weightAuthority: trongSo.authority / tong,
      weightContentQuality: trongSo.contentQuality / tong,
    },
  });

  revalidatePath("/cai-dat");
  return {
    ok: true,
    thongDiep:
      "Đã lưu. Chạy lại `npx tsx scripts/cham-diem.ts` để tính lại điểm theo trọng số mới.",
  };
}

/**
 * Đặt bao nhiêu phần trăm nội dung của một chuyên mục đến từ nguồn mới.
 *
 * Con số này là **TRẦN, không phải chỉ tiêu**. Đặt AI 90% không có nghĩa mỗi
 * đêm phải lấp cho đủ 90% — nếu chỉ vài bài từ nguồn lạ vượt được chuẩn thì
 * đưa bấy nhiêu, phần còn lại trả về cho kênh đã theo dõi. Lấp cho đủ số là
 * cách chắc chắn nhất để nhận về rác.
 */
export async function luuTyLeNguonMoi(
  chuyenMuc: ContentGroup,
  tyLe: number,
): Promise<{ ok: boolean; thongDiep: string }> {
  try {
    await doiHoiChuDuAn("chỉnh tỉ lệ nguồn mới");
  } catch (e) {
    return {
      ok: false,
      thongDiep: e instanceof Error ? e.message : "Không có quyền.",
    };
  }

  const sach = Math.round(tyLe);
  if (sach < 0 || sach > 100) {
    return { ok: false, thongDiep: "Tỉ lệ phải từ 0 đến 100." };
  }

  await prisma.categoryDiscoverySetting.upsert({
    where: { contentGroup: chuyenMuc },
    create: { contentGroup: chuyenMuc, newSourceRatio: sach },
    update: { newSourceRatio: sach },
  });

  revalidatePath("/cai-dat");
  revalidatePath("/");

  return {
    ok: true,
    thongDiep:
      sach === 0
        ? "Chỉ lấy từ nguồn đã theo dõi."
        : `Dành tối đa ${sach}% chỗ cho nguồn mới.`,
  };
}

/**
 * Chọn giọng đọc.
 *
 * Chỉ đổi giọng cho những lần đọc SAU ĐÓ. Bản âm thanh đã tạo giữ nguyên giọng
 * cũ — đọc lại toàn bộ bằng giọng mới thì lần đó mới tốn thêm hạn mức, nên
 * không tự ý làm.
 *
 * Trần miễn phí tự đổi theo giọng, không cần chỉnh gì thêm: Standard được 4
 * triệu ký tự mỗi tháng, Wavenet chỉ 1 triệu.
 */
export async function chonGiongDoc(
  maGiong: string,
): Promise<{ ok: boolean; thongDiep: string }> {
  try {
    await doiHoiChuDuAn("chọn giọng đọc");
  } catch (e) {
    return {
      ok: false,
      thongDiep: e instanceof Error ? e.message : "Không có quyền.",
    };
  }

  const giong = CAC_GIONG.find((g) => g.ma === maGiong);
  if (!giong) {
    return { ok: false, thongDiep: "Giọng không có trong danh sách." };
  }

  await prisma.userAssistantSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", ttsVoice: giong.ma },
    update: { ttsVoice: giong.ma },
  });

  revalidatePath("/cai-dat");

  return {
    ok: true,
    thongDiep:
      `Đã chọn ${giong.ten}. Mức miễn phí giờ là ` +
      `${giong.tranMienPhi.toLocaleString("vi-VN")} ký tự mỗi tháng. ` +
      `Bản âm thanh đã tạo trước đó vẫn giữ giọng cũ.`,
  };
}

/**
 * Đặt tốc độ đọc mặc định.
 *
 * Chỉ là mặc định — trên từng trình phát vẫn đổi được, và đổi ở đó không ghi
 * đè lựa chọn ở đây. Nghe một bài dài mà muốn nhanh hơn thì bấm ngay tại chỗ,
 * không phải vào Cài đặt.
 */
export async function luuTocDoDoc(
  tocDo: number,
): Promise<{ ok: boolean; thongDiep: string }> {
  try {
    await doiHoiChuDuAn("đổi tốc độ đọc");
  } catch (e) {
    return {
      ok: false,
      thongDiep: e instanceof Error ? e.message : "Không có quyền.",
    };
  }

  const lamTron = Number(tocDo.toFixed(1));
  if (lamTron < TOC_DO_MIN || lamTron > TOC_DO_MAX) {
    return {
      ok: false,
      thongDiep: `Tốc độ phải từ ${Math.round(TOC_DO_MIN * 100)}% đến ${Math.round(TOC_DO_MAX * 100)}%.`,
    };
  }

  await prisma.userAssistantSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", ttsSpeed: lamTron },
    update: { ttsSpeed: lamTron },
  });

  revalidatePath("/cai-dat");
  revalidatePath("/ban-tin");

  return { ok: true, thongDiep: `Tốc độ mặc định: ${Math.round(lamTron * 100)}%.` };
}

// ==========================================================================
// Podcast
// ==========================================================================

/**
 * Tìm podcast theo tên.
 *
 * Không ghi gì vào database nên **không đòi quyền chủ dự án** — khách xem thử
 * được, chỉ không thêm được. Việc này cũng không gọi Claude nên không tốn gì.
 */
export async function timPodcastTheoTen(tuKhoa: string): Promise<{
  ok: boolean;
  thongDiep?: string;
  ketQua: KetQuaTim[];
}> {
  const tu = tuKhoa.trim();
  if (tu.length < 2) {
    return { ok: false, thongDiep: "Gõ ít nhất hai chữ.", ketQua: [] };
  }

  try {
    const ketQua = await timPodcast(tu);
    return {
      ok: true,
      ketQua,
      thongDiep: ketQua.length === 0 ? "Không tìm thấy kênh nào." : undefined,
    };
  } catch (e) {
    return {
      ok: false,
      ketQua: [],
      thongDiep: `Không tra cứu được: ${e instanceof Error ? e.message : e}`,
    };
  }
}

/** Thêm một kênh podcast rồi lấy luôn vài tập mới nhất về. */
export async function themPodcast(duongDanFeed: string): Promise<{
  ok: boolean;
  thongDiep: string;
  canhBao?: string;
}> {
  try {
    await doiHoiChuDuAn("thêm kênh podcast");
  } catch (e) {
    return {
      ok: false,
      thongDiep: e instanceof Error ? e.message : "Không có quyền.",
    };
  }

  const kq = await themKenhPodcast(duongDanFeed);
  if (!kq.ok) return { ok: false, thongDiep: kq.thongDiep };

  // Lấy luôn tập về: thêm một kênh rồi thấy trống trơn thì người dùng không
  // biết là hỏng hay là chưa chạy. Có nội dung ngay mới thấy nó hoạt động.
  const quet = await quetPodcast(5, 120);

  revalidatePath("/cai-dat");
  revalidatePath("/");

  return {
    ok: true,
    thongDiep: `${kq.thongDiep} Đã lấy về ${quet.soTapThemMoi} tập mới nhất — chúng sẽ được xếp chuyên mục trong lượt chạy đêm.`,
    canhBao: kq.canhBaoNgonNgu,
  };
}

/**
 * Thêm một kênh SoundCloud bằng đường dẫn trang rồi lấy luôn vài bài mới nhất.
 *
 * Ô nhập ở đây là **đường dẫn trang**, không phải RSS — đó là thứ duy nhất
 * người dùng thật sự nhìn thấy và sao chép được từ SoundCloud. Việc đổi nó
 * sang đường dẫn RSS là của máy.
 */
export async function themSoundCloud(duongDanTrang: string): Promise<{
  ok: boolean;
  thongDiep: string;
  canhBao?: string;
}> {
  try {
    await doiHoiChuDuAn("thêm kênh SoundCloud");
  } catch (e) {
    return {
      ok: false,
      thongDiep: e instanceof Error ? e.message : "Không có quyền.",
    };
  }

  const kq = await themKenhSoundCloud(duongDanTrang);
  if (!kq.ok) return { ok: false, thongDiep: kq.thongDiep };

  // Lấy luôn bài về, cùng lý do như bên podcast: thêm xong mà trống trơn thì
  // không biết là hỏng hay là chưa chạy
  const quet = await quetPodcast(5, 120);

  revalidatePath("/cai-dat");
  revalidatePath("/");

  return {
    ok: true,
    thongDiep: `${kq.thongDiep} Đã lấy về ${quet.soTapThemMoi} bài mới nhất — chúng sẽ được xếp chuyên mục trong lượt chạy đêm.`,
    canhBao: kq.canhBaoNgonNgu,
  };
}

/** Bỏ một kênh podcast cùng toàn bộ tập của nó. */
export async function boPodcast(idNguon: string): Promise<{
  ok: boolean;
  thongDiep: string;
}> {
  try {
    await doiHoiChuDuAn("bỏ kênh podcast");
  } catch (e) {
    return {
      ok: false,
      thongDiep: e instanceof Error ? e.message : "Không có quyền.",
    };
  }

  // Nhận cả kênh SoundCloud: hai loại nguồn này cùng là feed RSS và cùng dùng
  // một nút "Bỏ". Vẫn kẹp danh sách loại chứ không bỏ hẳn điều kiện, để một id
  // kênh YouTube gửi nhầm vào đây không xoá mất cả kênh cùng toàn bộ video.
  const nguon = await prisma.source.findFirst({
    where: {
      id: idNguon,
      type: { in: ["podcast_rss", "soundcloud_channel"] },
    },
    select: { title: true, _count: { select: { contentItems: true } } },
  });

  if (!nguon) return { ok: false, thongDiep: "Không tìm thấy kênh này." };

  await prisma.source.delete({ where: { id: idNguon } });

  revalidatePath("/cai-dat");
  revalidatePath("/");

  return {
    ok: true,
    thongDiep: `Đã bỏ "${nguon.title}" cùng ${nguon._count.contentItems} tập.`,
  };
}

/**
 * Lưu đơn đặt hàng cho chuyên mục Ngẫu hứng.
 *
 * **Ghi đè đơn cũ chứ không thêm đơn mới.** Chủ dự án chốt 2026-08-16 rằng đây
 * là một chỗ đặt hàng cho phiên tới, không phải một danh sách tích luỹ — giữ cả
 * đống đơn cũ thì mỗi đêm máy đi tìm theo mười thứ đã hết quan tâm, và tiêu hạn
 * mức cho từng thứ một.
 *
 * KHÔNG tìm ngay ở đây: mỗi lượt tìm YouTube tốn 100 đơn vị, bấm lưu vài lần
 * trong một buổi tối là cạn hạn mức cả ngày. Việc tìm chờ lượt quét đêm.
 */
export async function datHangNgauHung(
  yeuCau: string,
  chuDeCon: string[],
): Promise<{ ok: boolean; thongDiep: string }> {
  try {
    await doiHoiChuDuAn("đặt hàng Ngẫu hứng");
  } catch (e) {
    return {
      ok: false,
      thongDiep: e instanceof Error ? e.message : "Không có quyền.",
    };
  }

  const cau = yeuCau.trim().slice(0, 2_000);
  const huong = chuDeCon
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 3);

  if (!cau && huong.length === 0) {
    return { ok: false, thongDiep: "Chưa điền gì cả." };
  }

  // `keyword` vẫn phải có vì cột đó là khoá duy nhất từ bản đầu. Dùng ba hướng
  // ghép lại làm nhãn ngắn — cũng chính là chuỗi hiện ngoài màn hình chính.
  const nhan = huong.length > 0 ? huong.join(", ") : cau.slice(0, 80);

  const cu = await prisma.adHocInterest.findFirst({
    where: { active: true },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  if (cu) {
    await prisma.adHocInterest.update({
      where: { id: cu.id },
      data: { keyword: nhan, yeuCau: cau, chuDeCon: huong, autoScan: true },
    });
  } else {
    await prisma.adHocInterest.create({
      data: { keyword: nhan, yeuCau: cau, chuDeCon: huong, autoScan: true },
    });
  }

  revalidatePath("/cai-dat");
  revalidatePath("/");
  revalidatePath("/kham-pha");

  return {
    ok: true,
    thongDiep:
      `Đã lưu. Lượt quét đêm nay sẽ đi tìm theo ${huong.length} hướng` +
      `${huong.length ? ` (${huong.join(", ")})` : ""}, kết quả có vào sáng mai.`,
  };
}

// ==========================================================================
// CHỦ ĐỀ CON — chủ nhà tự đặt cho từng chuyên mục
// ==========================================================================

/**
 * Thêm một chủ đề con.
 *
 * NHỚ RẰNG ĐÂY KHÔNG CHỈ LÀ THÊM MỘT CÁI NÚT. Danh sách này đi thẳng vào lời
 * dặn lúc Claude phân loại, nên thêm xong là lượt quét đêm sau Claude đã biết
 * xếp nội dung vào đó. Nội dung cũ thì không tự xếp lại — muốn vậy phải cho
 * đọc lại, và việc đó tốn tiền nên không tự làm.
 */
export async function themChuDeCon(
  chuyenMuc: string,
  ten: string,
  moTa: string,
): Promise<{ ok: boolean; thongDiep: string }> {
  const chan = await chanCua("thêm chủ đề con");
  if (chan) return chan;

  const sach = ten.trim();
  if (!sach) return { ok: false, thongDiep: "Chưa đặt tên." };
  if (!(CHUYEN_MUC_CO_CHU_DE as readonly string[]).includes(chuyenMuc)) {
    return { ok: false, thongDiep: "Chuyên mục không hợp lệ." };
  }

  const ma = maTuTen(sach);
  if (!ma) {
    return { ok: false, thongDiep: "Tên phải có ít nhất một chữ cái hoặc số." };
  }

  const daCo = await prisma.chuDeCon.findUnique({
    where: { chuyenMuc_ma: { chuyenMuc: chuyenMuc as ContentGroup, ma } },
    select: { id: true, ten: true, bat: true },
  });
  if (daCo) {
    // Trùng với một chủ đề đang TẮT thì bật lại, đừng báo lỗi — người dùng gõ
    // lại đúng cái tên cũ nghĩa là họ muốn nó quay về.
    if (!daCo.bat) {
      await prisma.chuDeCon.update({ where: { id: daCo.id }, data: { bat: true } });
      revalidatePath("/cai-dat");
      revalidatePath("/kham-pha");
      return { ok: true, thongDiep: `Đã bật lại "${daCo.ten}".` };
    }
    return { ok: false, thongDiep: `"${daCo.ten}" đã có rồi.` };
  }

  const cuoi = await prisma.chuDeCon.aggregate({
    where: { chuyenMuc: chuyenMuc as ContentGroup },
    _max: { viTri: true },
  });

  await prisma.chuDeCon.create({
    data: {
      chuyenMuc: chuyenMuc as ContentGroup,
      ma,
      ten: sach,
      moTa: moTa.trim() || null,
      viTri: (cuoi._max.viTri ?? -1) + 1,
    },
  });

  revalidatePath("/cai-dat");
  revalidatePath("/kham-pha");
  return { ok: true, thongDiep: `Đã thêm "${sach}". Lượt quét tới Claude sẽ dùng.` };
}

/** Sửa tên hoặc mô tả một chủ đề con. Mã giữ nguyên để nội dung cũ không lạc. */
export async function suaChuDeCon(
  id: string,
  ten: string,
  moTa: string,
): Promise<{ ok: boolean; thongDiep: string }> {
  const chan = await chanCua("sửa chủ đề con");
  if (chan) return chan;

  const sach = ten.trim();
  if (!sach) return { ok: false, thongDiep: "Tên không được để trống." };

  // KHÔNG đổi `ma` theo tên mới: mã đã nằm trong hàng trăm bản ghi nội dung đã
  // phân loại. Đổi mã là toàn bộ số đó mất liên kết với nút lọc.
  await prisma.chuDeCon.update({
    where: { id },
    data: { ten: sach, moTa: moTa.trim() || null },
  });

  revalidatePath("/cai-dat");
  revalidatePath("/kham-pha");
  return { ok: true, thongDiep: "Đã lưu." };
}

/**
 * Bật/tắt một chủ đề con.
 *
 * TẮT CHỨ KHÔNG XOÁ, và đó là chủ ý: nội dung đã gắn mã này vẫn giữ nguyên
 * chữ đó trong database. Xoá hẳn dòng cấu hình thì mã kia thành mồ côi — nội
 * dung vẫn mang nó nhưng không còn tên nào để hiện ra.
 */
export async function batTatChuDeCon(
  id: string,
  bat: boolean,
): Promise<{ ok: boolean; thongDiep: string }> {
  const chan = await chanCua("bật tắt chủ đề con");
  if (chan) return chan;

  await prisma.chuDeCon.update({ where: { id }, data: { bat } });
  revalidatePath("/cai-dat");
  revalidatePath("/kham-pha");
  return {
    ok: true,
    thongDiep: bat
      ? "Đã bật — Claude sẽ dùng lại từ lượt quét sau."
      : "Đã tắt — nội dung cũ vẫn giữ nguyên, chỉ không còn nút lọc.",
  };
}
