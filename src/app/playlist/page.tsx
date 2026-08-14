import Link from "next/link";

import { auth } from "@/auth";
import { BangPlaylist } from "@/components/BangPlaylist";
import { KhungTrang } from "@/components/KhungTrang";
import { prisma } from "@/lib/db/prisma";
import { QUYEN_SUA_PLAYLIST } from "@/lib/youtube/tokenGoogle";
import { ID_TAI_KHOAN } from "@/auth";

export const dynamic = "force-dynamic";

export default async function TrangPlaylist() {
  const phien = await auth();
  const laChu = Boolean(phien?.user?.email);

  if (!laChu) {
    return (
      <KhungTrang emailNguoiDung={null}>
        <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
          <h1 className="text-xl font-semibold tracking-tight">Playlist</h1>
          <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
            Đây là playlist trên tài khoản YouTube của chủ nhà. Cần đăng nhập
            mới mở được.
          </p>
          <Link
            href="/dang-nhap"
            className="mt-6 inline-block rounded-lg bg-cam-600 px-4 py-2 text-sm font-medium text-white dark:bg-cam-500 dark:text-white"
          >
            Đăng nhập
          </Link>
        </div>
      </KhungTrang>
    );
  }

  const [cacPlaylist, cacDeXuat, taiKhoan] = await Promise.all([
    prisma.youTubePlaylist.findMany({
      orderBy: [{ managedByAI: "desc" }, { title: "asc" }],
      select: {
        id: true,
        title: true,
        itemCount: true,
        managedByAI: true,
      },
    }),
    prisma.playlistOrganizationSuggestion.findMany({
      where: { status: { in: ["pending", "approved", "applied"] } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        reason: true,
        status: true,
        newPlaylistTitle: true,
        contentItem: { select: { id: true, title: true } },
        suggestedPlaylist: { select: { title: true } },
      },
    }),
    prisma.googleAccount.findUnique({
      where: { id: ID_TAI_KHOAN },
      select: { scope: true },
    }),
  ]);

  const coQuyenGhi = Boolean(taiKhoan?.scope?.includes(QUYEN_SUA_PLAYLIST));

  return (
    <KhungTrang emailNguoiDung={phien?.user?.email}>
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <h1 className="text-xl font-semibold tracking-tight">Playlist</h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Trợ lý <strong>chỉ đề xuất</strong>. Không có gì được ghi lên YouTube
          nếu bạn không bấm duyệt rồi bấm ghi — hai bước tách rời.
        </p>

        <div className="mt-6">
          <BangPlaylist
            laChu={laChu}
            coQuyenGhi={coQuyenGhi}
            cacPlaylist={cacPlaylist.map((p) => ({
              id: p.id,
              ten: p.title,
              soMuc: p.itemCount,
              choSapXep: p.managedByAI,
            }))}
            cacDeXuat={cacDeXuat.map((d) => ({
              id: d.id,
              tieuDeVideo: d.contentItem.title,
              idNoiDung: d.contentItem.id,
              tenPlaylist:
                d.suggestedPlaylist?.title ??
                d.newPlaylistTitle ??
                "(không rõ)",
              laPlaylistMoi: !d.suggestedPlaylist,
              lyDo: d.reason,
              trangThai: d.status,
            }))}
          />
        </div>

        <p className="mt-10 text-xs text-neutral-400 dark:text-neutral-500">
          Hệ thống không bao giờ xoá playlist. Chỉ tạo mới và thêm video — hai
          việc gỡ ra được. Mọi lần ghi đều lưu lại trong bảng{" "}
          <code>PlaylistActionLog</code>.
        </p>
      </div>
    </KhungTrang>
  );
}
