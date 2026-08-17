import Link from "next/link";

import { auth } from "@/auth";
import { BangPlaylist } from "@/components/BangPlaylist";
import { KhungTrang } from "@/components/KhungTrang";
import { prisma } from "@/lib/db/prisma";
import { coQuyenSuaPlaylist } from "@/lib/youtube/tokenGoogle";
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

  const [cacPlaylist, cacThuMucChoXoa, cacDeXuatTho, taiKhoan] = await Promise.all([
    prisma.youTubePlaylist.findMany({
      where: { deletionRequestedAt: null },
      orderBy: [{ managedByAI: "desc" }, { title: "asc" }],
      select: {
        id: true,
        title: true,
        itemCount: true,
        managedByAI: true,
        youtubePlaylistId: true,
        items: {
          select: { id: true },
        },
      },
    }),
    prisma.youTubePlaylist.findMany({
      where: { deletionRequestedAt: { not: null } },
      orderBy: { deletionRequestedAt: "desc" },
      select: { id: true, title: true },
    }),
    prisma.playlistOrganizationSuggestion.findMany({
      where: { status: { in: ["pending", "approved", "applied"] } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        reason: true,
        status: true,
        type: true,
        newPlaylistTitle: true,
        currentPlaylistTitle: true,
        contentItem: { select: { id: true, title: true } },
        suggestedPlaylist: { select: { title: true } },
      },
    }),
    prisma.googleAccount.findUnique({
      where: { id: ID_TAI_KHOAN },
      select: { scope: true },
    }),
  ]);

  const coQuyenGhi = coQuyenSuaPlaylist(taiKhoan?.scope ?? null);

  /** Câu mô tả việc, soạn sẵn ở máy chủ — giao diện không cần biết năm loại
   * đề xuất khác nhau ra sao, chỉ hiện đúng chuỗi đưa xuống. */
  function moTaViec(d: (typeof cacDeXuatTho)[number]): string {
    const ten = d.suggestedPlaylist?.title ?? d.newPlaylistTitle ?? "(không rõ)";
    switch (d.type) {
      case "new_save":
      case "misplaced_fix":
        return `Thêm vào "${ten}"${!d.suggestedPlaylist ? " (playlist mới)" : ""}`;
      case "remove_item":
        return `Bỏ khỏi "${ten}"`;
      case "delete_playlist":
        return `Xoá hẳn thư mục "${d.currentPlaylistTitle ?? ten}"`;
      case "rename_playlist":
        return `Đổi tên "${d.currentPlaylistTitle ?? ""}" thành "${d.newPlaylistTitle ?? ""}"`;
      case "reorder_items":
        return `Ghi lại thứ tự bài trong "${ten}"`;
    }
  }

  const cacDeXuat = cacDeXuatTho.map((d) => ({
    id: d.id,
    loai: d.type,
    moTaViec: moTaViec(d),
    idNoiDung: d.contentItem?.id ?? null,
    tieuDeVideo: d.contentItem?.title ?? null,
    lyDo: d.reason,
    trangThai: d.status,
    nguyHiem: d.type === "delete_playlist",
  }));

  return (
    <KhungTrang emailNguoiDung={phien?.user?.email}>
      <div className="w-full px-4 py-6 sm:px-6 lg:px-8">
        <h1 className="text-xl font-semibold tracking-tight">Playlist</h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Mỗi thư mục trên Am ánh xạ đúng một playlist thật trên YouTube. Sửa gì
          trên Am (thêm, bớt, đổi tên, xoá) đều làm ngay — nhưng phần <strong>ghi
          thật lên YouTube</strong> luôn dừng lại chờ bạn duyệt rồi mới ghi, kể
          cả xoá.
        </p>

        <div className="mt-6">
          <BangPlaylist
            laChu={laChu}
            coQuyenGhi={coQuyenGhi}
            cacPlaylist={cacPlaylist.map((p) => ({
              id: p.id,
              ten: p.title,
              // Số THẬT trên YouTube, không phải số dòng trong bảng ý muốn
              // của Am — hai con số khác hẳn nhau với playlist đã có video từ
              // trước khi Am biết tới nó. Đếm nhầm khiến trang này luôn báo
              // "0 mục" cho mọi playlist cũ, dù đọc lại từ YouTube rồi.
              soMuc: p.youtubePlaylistId !== null ? p.itemCount : p.items.length,
              choSapXep: p.managedByAI,
              daCoThat: p.youtubePlaylistId !== null,
            }))}
            cacThuMucChoXoa={cacThuMucChoXoa}
            cacDeXuat={cacDeXuat}
          />
        </div>

        <p className="mt-10 text-xs text-neutral-400 dark:text-neutral-500">
          Mọi lần ghi thật đều lưu lại trong bảng <code>PlaylistActionLog</code>{" "}
          để tra lại và sửa tay.
        </p>
      </div>
    </KhungTrang>
  );
}
