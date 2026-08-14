/**
 * Ghi lại chỗ đang dở đúng lúc người dùng đóng tab.
 *
 * VÌ SAO PHẢI CÓ TUYẾN RIÊNG: lúc trang sắp đóng, trình duyệt huỷ mọi lời gọi
 * mạng đang dở — kể cả server action. Chỉ `navigator.sendBeacon` là được cam
 * kết gửi đi, mà beacon thì cần một địa chỉ HTTP thật để bắn tới.
 *
 * Không có nó thì chỗ đang dở luôn trễ mất khoảng thời gian giữa hai nhịp ghi.
 * Xem tới phút 47 rồi đóng máy, hôm sau mở điện thoại lại thấy phút 45 — sai
 * lệch nhỏ nhưng đúng vào thứ tính năng này sinh ra để làm.
 */

import { NextResponse } from "next/server";

import type { DeviceType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db/prisma";
import { laChuDuAn } from "@/lib/quyen";

/** Dưới ngưỡng này thì coi như chưa xem gì, không lưu. */
const TOI_THIEU_DE_LUU_CHO_DO = 30;

interface ThanBeacon {
  idPhien?: string;
  idNoiDung?: string;
  viTriGiay?: number;
  giayDaXem?: number;
  thietBi?: DeviceType;
}

export async function POST(yeuCau: Request) {
  // Beacon mang theo cookie phiên nên chỗ này vẫn biết ai đang gọi
  if (!(await laChuDuAn())) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let than: ThanBeacon;
  try {
    than = (await yeuCau.json()) as ThanBeacon;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const { idPhien, idNoiDung, thietBi = "desktop" } = than;
  const viTri = Math.max(0, Math.round(than.viTriGiay ?? 0));

  if (!idNoiDung) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  try {
    if (idPhien) {
      await prisma.consumptionEvent.create({
        data: {
          sessionId: idPhien,
          contentItemId: idNoiDung,
          eventType: "abandon",
          positionSeconds: viTri,
          deviceType: thietBi,
        },
      });

      await prisma.consumptionSession.update({
        where: { id: idPhien },
        data: {
          endedAt: new Date(),
          watchedSeconds: Math.round(than.giayDaXem ?? 0),
        },
      });
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

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
