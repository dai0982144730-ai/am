/**
 * Xuất toàn bộ dữ liệu cá nhân ra một file JSON tải về được.
 *
 * ## Vì sao cần
 *
 * Mọi thứ app biết về gu của chủ dự án — đã nghe gì, nghe bao lâu, chấm mấy
 * sao, ghi chú gì, theo dõi ai — đều nằm trong một database chạy trên máy nhà.
 * Ổ cứng hỏng là mất sạch, và không có cách nào dựng lại: lịch sử nghe của một
 * năm không mua lại được. File này là lối thoát: một lệnh, một file, cầm đi đâu
 * cũng đọc được bằng notepad.
 *
 * ## Cái gì KHÔNG có trong file
 *
 * Token đăng nhập Google (`GoogleAccount.accessToken`/`refreshToken`) bị bỏ ra
 * ngoài, chỉ giữ lại email và ngày cấp quyền. Token là chìa khoá vào thẳng tài
 * khoản YouTube thật; một file tải về nằm trong thư mục Downloads, gửi qua
 * Zalo, đồng bộ lên đám mây — mỗi chỗ đó là một chỗ chìa khoá rơi ra. Mất token
 * thì thu hồi được, nhưng chỉ khi biết là đã mất.
 *
 * Nội dung gốc (video, bài viết, transcript) cũng không có: chúng không phải
 * dữ liệu cá nhân, và quét lại được. File này chỉ chứa thứ **không tái tạo
 * được**.
 */

import { NextResponse } from "next/server";

import { prisma } from "@/lib/db/prisma";
import { doiHoiChuDuAn } from "@/lib/quyen";

/** Không cho Next lưu đệm — dữ liệu cá nhân đổi từng ngày. */
export const dynamic = "force-dynamic";

/**
 * Nội dung đính kèm mỗi bản ghi cá nhân.
 *
 * Chỉ đủ để **nhận ra** đó là bài nào sau này — tiêu đề, đường dẫn gốc, nguồn.
 * Không kéo cả bài viết vào, vì làm thế thì file phình lên hàng chục MB toàn
 * thứ tải lại được, và phần cá nhân thật sự chìm nghỉm trong đó.
 */
const KEM_NOI_DUNG = {
  id: true,
  title: true,
  url: true,
  durationSeconds: true,
  publishedAt: true,
  source: { select: { title: true, type: true } },
} as const;

export async function GET() {
  await doiHoiChuDuAn("xuất dữ liệu cá nhân");

  const [
    lichSuXem,
    cacPhienNghe,
    cacMocDangDo,
    cacGhiChu,
    cacBoSuuTap,
    cacViecCanLam,
    thuVien,
    cacHoSoGu,
    caiDat,
    cacBoLocLuu,
    tyLeNguonMoi,
    cacTacGiaTheoDoi,
    cacPhienTroChuyen,
    cacBanTin,
    nhatKyPlaylist,
  ] = await Promise.all([
    prisma.watchHistory.findMany({
      include: { contentItem: { select: KEM_NOI_DUNG } },
      orderBy: { lastOpenedAt: "desc" },
    }),
    prisma.consumptionSession.findMany({
      include: {
        contentItem: { select: KEM_NOI_DUNG },
        events: {
          select: {
            eventType: true,
            positionSeconds: true,
            deviceType: true,
            timestamp: true,
          },
          orderBy: { timestamp: "asc" },
        },
      },
      orderBy: { startedAt: "desc" },
    }),
    prisma.resumePoint.findMany({
      include: { contentItem: { select: KEM_NOI_DUNG } },
    }),
    prisma.note.findMany({
      include: {
        contentItem: { select: KEM_NOI_DUNG },
        collection: { select: { title: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.knowledgeCollection.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.actionItem.findMany({
      include: { contentItem: { select: KEM_NOI_DUNG } },
    }),
    prisma.libraryItem.findMany({
      include: { contentItem: { select: KEM_NOI_DUNG } },
    }),
    prisma.userTasteProfile.findMany({ orderBy: { version: "asc" } }),
    prisma.userAssistantSettings.findUnique({ where: { id: "singleton" } }),
    prisma.filterPreset.findMany(),
    prisma.categoryDiscoverySetting.findMany(),
    prisma.author.findMany({
      where: { theoDoi: true },
      select: {
        canonicalName: true,
        aliases: true,
        domain: true,
        approvedByUser: true,
      },
    }),
    prisma.chatSession.findMany({
      include: { messages: { orderBy: { createdAt: "asc" } } },
      orderBy: { startedAt: "asc" },
    }),
    prisma.assistantBriefing.findMany({ orderBy: { deliveredAt: "asc" } }),
    prisma.playlistActionLog.findMany({ orderBy: { appliedAt: "asc" } }),
  ]);

  // Tài khoản Google: giữ email và phạm vi quyền, BỎ token. Xem lời giải thích
  // ở đầu file — đây là dòng quan trọng nhất của cả file này.
  const taiKhoan = await prisma.googleAccount.findFirst({
    select: {
      email: true,
      scope: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const goi = {
    xuatLuc: new Date().toISOString(),
    ghiChuVeFile:
      "Dữ liệu cá nhân của app am. KHÔNG chứa token đăng nhập Google và " +
      "không chứa nội dung gốc (video, bài viết, transcript) — những thứ đó " +
      "quét lại được.",
    taiKhoan,
    lichSuXem,
    cacPhienNghe,
    cacMocDangDo,
    cacGhiChu,
    cacBoSuuTap,
    cacViecCanLam,
    thuVien,
    cacHoSoGu,
    caiDat,
    cacBoLocLuu,
    tyLeNguonMoi,
    cacTacGiaTheoDoi,
    cacPhienTroChuyen,
    cacBanTin,
    nhatKyPlaylist,
  };

  const ngay = new Date().toISOString().slice(0, 10);

  return new NextResponse(JSON.stringify(goi, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="am-du-lieu-ca-nhan-${ngay}.json"`,
    },
  });
}
