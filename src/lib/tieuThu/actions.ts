"use server";

/**
 * Ghi lại chuyện người dùng đã xem gì, xem tới đâu, thấy thế nào.
 *
 * VÌ SAO CẦN: đây là **nguyên liệu duy nhất** để sau này máy hiểu gu người
 * dùng. Không có nó thì phần cá nhân hoá chỉ là đoán mò. Bản thiết kế xếp
 * `ConsumptionEvent` → `ConsumptionSession` làm tín hiệu ngầm, còn số sao và
 * tag cảm xúc là **tín hiệu tường minh, trọng số cao hơn**.
 *
 * CHỈ GHI CHO CHỦ DỰ ÁN. Khách vẫn xem thoải mái nhưng không để lại dấu vết —
 * nếu ghi cả lượt xem của người lạ thì hồ sơ gu bị pha loãng bởi người khác,
 * mà web này làm riêng cho một người. Chặn ngay ở đây chứ không chỉ giấu nút
 * trên giao diện.
 *
 * KHÔNG NÉM LỖI RA NGOÀI. Mấy hàm này được gọi ngầm trong lúc người dùng đang
 * xem; hỏng thì im lặng bỏ qua, tuyệt đối không được làm gián đoạn việc xem chỉ
 * vì ghi nhật ký thất bại.
 */

import type {
  ConsumptionEventType,
  DeviceType,
} from "@/generated/prisma/enums";
import { prisma } from "@/lib/db/prisma";
import { laChuDuAn } from "@/lib/quyen";

/** Coi như đã xem xong khi đi qua ngần này phần trăm. */
const NGUONG_XEM_XONG = 0.9;

/**
 * Dưới ngưỡng này thì không lưu chỗ đang dở.
 *
 * Mở lên rồi tắt ngay ở giây thứ 5 không phải là "đang xem dở" — lưu lại chỉ
 * làm rác danh sách tiếp tục xem.
 */
const TOI_THIEU_DE_LUU_CHO_DO = 30;

/**
 * Mở một phiên xem mới. **Chỉ gọi khi người dùng thật sự bấm phát.**
 *
 * Mở trang rồi đóng ngay không phải là một lần xem. Nếu tạo phiên ngay lúc tải
 * trang thì mỗi lần bấm nhầm cũng thành một bản ghi, và về sau phần cá nhân hoá
 * đọc phải toàn phiên rỗng, tưởng người dùng mở nhiều mà chẳng xem gì.
 *
 * Đếm luôn số lần đã xem xong trước đó vào `replayCount`. Con số này **phải
 * được diễn giải khác nhau tuỳ chuyên mục**: với video và bài viết, xem lại là
 * hiếm; với nhạc, nghe lại nhiều lần lại là tín hiệu thích mạnh nhất. Ở đây chỉ
 * đếm trung thực, việc diễn giải để phần cá nhân hoá lo.
 */
export async function moPhien(
  idNoiDung: string,
  thietBi: DeviceType,
): Promise<string | null> {
  if (!(await laChuDuAn())) return null;

  try {
    const soLanTruoc = await prisma.consumptionSession.count({
      where: { contentItemId: idNoiDung, completed: true },
    });

    const phien = await prisma.consumptionSession.create({
      data: {
        contentItemId: idNoiDung,
        deviceType: thietBi,
        replayCount: soLanTruoc,
      },
    });

    return phien.id;
  } catch {
    return null;
  }
}

/** Ghi một sự kiện lẻ: bấm phát, tạm dừng, tua, xem xong, bỏ dở. */
export async function ghiSuKien(
  idPhien: string,
  idNoiDung: string,
  loai: ConsumptionEventType,
  viTriGiay: number,
  thietBi: DeviceType,
): Promise<void> {
  if (!(await laChuDuAn())) return;

  try {
    await prisma.consumptionEvent.create({
      data: {
        sessionId: idPhien,
        contentItemId: idNoiDung,
        eventType: loai,
        positionSeconds: Math.max(0, Math.round(viTriGiay)),
        deviceType: thietBi,
      },
    });
  } catch {
    // Mất một sự kiện không đáng để làm hỏng buổi xem
  }
}

export interface TienDo {
  idPhien: string;
  idNoiDung: string;
  /** Đang ở giây thứ mấy */
  viTriGiay: number;
  /** Đã thật sự xem bao nhiêu giây (không tính lúc tua vượt) */
  giayDaXem: number;
  thoiLuongGiay: number;
  thietBi: DeviceType;
}

/**
 * Cập nhật tiến độ — được gọi đều đặn trong lúc đang phát.
 *
 * Hai thứ được ghi cùng lúc, có chủ đích:
 *
 *   - **Phiên xem**: đã xem bao lâu, đi được bao nhiêu phần trăm, xong chưa
 *   - **Chỗ đang dở**: để mở trên máy khác là nghe tiếp đúng chỗ
 *
 * `percentComplete` lấy **chỗ xa nhất từng tới**, không phải chỗ hiện tại — tua
 * ngược lại nghe kỹ một đoạn thì vẫn tính là đã đi tới chỗ cũ, chứ không bị lùi
 * lại thành "chưa xem xong".
 */
export async function capNhatTienDo(tienDo: TienDo): Promise<void> {
  if (!(await laChuDuAn())) return;

  const { idPhien, idNoiDung, viTriGiay, giayDaXem, thoiLuongGiay, thietBi } =
    tienDo;

  const viTri = Math.max(0, Math.round(viTriGiay));
  const phanTram =
    thoiLuongGiay > 0 ? Math.min(1, viTri / thoiLuongGiay) : 0;
  const xemXong = phanTram >= NGUONG_XEM_XONG;

  try {
    const phien = await prisma.consumptionSession.findUnique({
      where: { id: idPhien },
      select: { percentComplete: true, watchedSeconds: true },
    });
    if (!phien) return;

    await prisma.consumptionSession.update({
      where: { id: idPhien },
      data: {
        watchedSeconds: Math.max(phien.watchedSeconds, Math.round(giayDaXem)),
        percentComplete: Math.max(phien.percentComplete, phanTram),
        completed: xemXong || phien.percentComplete >= NGUONG_XEM_XONG,
      },
    });

    // Xem xong rồi thì xoá chỗ đang dở — không ai muốn mở lại thấy "tiếp tục
    // từ phút 58" của một video đã xem hết
    if (xemXong) {
      await prisma.resumePoint.deleteMany({
        where: { contentItemId: idNoiDung },
      });
      return;
    }

    if (viTri >= TOI_THIEU_DE_LUU_CHO_DO) {
      await prisma.resumePoint.upsert({
        where: { contentItemId: idNoiDung },
        create: {
          contentItemId: idNoiDung,
          positionSeconds: viTri,
          lastDevice: thietBi,
        },
        update: { positionSeconds: viTri, lastDevice: thietBi },
      });
    }
  } catch {
    // Im lặng — xem tiếp quan trọng hơn ghi tiến độ
  }
}

/** Đóng phiên khi rời trang hoặc xem xong. */
export async function dongPhien(
  idPhien: string,
  xemXong: boolean,
): Promise<void> {
  if (!(await laChuDuAn())) return;

  try {
    await prisma.consumptionSession.update({
      where: { id: idPhien },
      data: { endedAt: new Date(), ...(xemXong ? { completed: true } : {}) },
    });
  } catch {
    // Không sao
  }
}

export interface KetQuaDanhGia {
  ok: boolean;
  thongDiep: string;
}

/**
 * Lưu số sao và tag cảm xúc.
 *
 * Gắn vào phiên xem gần nhất trong 24 giờ; chưa có thì tạo mới — để bài viết
 * (không có trình phát, nên không có phiên nào được mở) vẫn đánh giá được.
 */
export async function danhGia(
  idNoiDung: string,
  sao: number | null,
  tagCamXuc: string[],
  thietBi: DeviceType = "desktop",
): Promise<KetQuaDanhGia> {
  if (!(await laChuDuAn())) {
    return {
      ok: false,
      thongDiep: "Cần đăng nhập mới đánh giá được — đây là gu của chủ nhà.",
    };
  }

  if (sao !== null && (sao < 1 || sao > 5)) {
    return { ok: false, thongDiep: "Số sao phải từ 1 đến 5." };
  }

  try {
    const motNgayTruoc = new Date(Date.now() - 24 * 3_600_000);
    const phienGanNhat = await prisma.consumptionSession.findFirst({
      where: { contentItemId: idNoiDung, startedAt: { gte: motNgayTruoc } },
      orderBy: { startedAt: "desc" },
      select: { id: true },
    });

    if (phienGanNhat) {
      await prisma.consumptionSession.update({
        where: { id: phienGanNhat.id },
        data: { explicitRating: sao, emotionTags: tagCamXuc },
      });
    } else {
      await prisma.consumptionSession.create({
        data: {
          contentItemId: idNoiDung,
          deviceType: thietBi,
          explicitRating: sao,
          emotionTags: tagCamXuc,
          endedAt: new Date(),
        },
      });
    }

    return { ok: true, thongDiep: "Đã ghi nhận." };
  } catch (e) {
    return {
      ok: false,
      thongDiep: e instanceof Error ? e.message : "Lưu không được.",
    };
  }
}
