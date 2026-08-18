import Link from "next/link";
import { notFound } from "next/navigation";

import { auth } from "@/auth";
import { KhungTrang } from "@/components/KhungTrang";
import { LuoiPlaylistKeoTha } from "@/components/LuoiPlaylistKeoTha";
import { prisma } from "@/lib/db/prisma";
import { TRUONG_CAN_LAY } from "@/lib/nghiepVu/layNoiDungTrangChu";

export const dynamic = "force-dynamic";

/**
 * Trang chi tiết một playlist — bên trong có gì.
 *
 * Lưới bốn cột y hệt Khám phá, dùng lại đúng `TheNoiDungCard`. Khác một chỗ:
 * menu ba chấm trên mỗi thẻ đổi sang ngữ cảnh playlist (`trongPlaylistId`) —
 * "Xoá khỏi playlist" và "Chuyển đến playlist" thay vì "Thêm vào Playlist",
 * vì ở đây thẻ nào cũng ĐÃ nằm trong đúng một playlist rồi.
 *
 * NGUỒN DỮ LIỆU LÀ `PlaylistItem`, không phải `lastSyncedVideoIds` — bảng đó
 * mới là "ý Am muốn", đã được đắp khớp với thật mỗi lần đồng bộ (xem
 * `dongBo.ts`), và nó còn chứa được cả nội dung nguồn khác YouTube mà
 * `lastSyncedVideoIds` không bao giờ biết tới.
 */
export default async function TrangChiTietPlaylist({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const phien = await auth();
  const laChu = Boolean(phien?.user?.email);

  const playlist = await prisma.youTubePlaylist.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      itemCount: true,
      youtubePlaylistId: true,
      deletionRequestedAt: true,
      items: {
        orderBy: { position: "asc" },
        select: { contentItem: { select: TRUONG_CAN_LAY } },
      },
    },
  });

  if (!playlist) notFound();

  const cacThe = playlist.items.map((i) => i.contentItem);

  return (
    <KhungTrang emailNguoiDung={phien?.user?.email}>
      <div className="w-full px-4 py-6 sm:px-6 lg:px-8">
        <Link
          href="/playlist"
          className="text-sm text-neutral-500 hover:underline dark:text-neutral-400"
        >
          ← Playlist
        </Link>

        <div className="mt-2 flex items-baseline justify-between gap-4">
          <h1 className="text-xl font-semibold tracking-tight">
            {playlist.title}
          </h1>
          <span className="text-xs text-neutral-400 dark:text-neutral-500">
            {playlist.youtubePlaylistId ? playlist.itemCount : cacThe.length} mục
            {cacThe.length < playlist.itemCount
              ? ` (Am nhận ra ${cacThe.length})`
              : ""}
          </span>
        </div>

        {playlist.deletionRequestedAt ? (
          <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-950/30 dark:text-red-400">
            Thư mục này đang chờ xoá — mọi thay đổi ở đây vẫn giữ, nhưng sẽ mất
            hết nếu đề xuất xoá được duyệt.
          </p>
        ) : null}

        {!playlist.youtubePlaylistId ? (
          <p className="mt-2 rounded-lg bg-neutral-100 px-3 py-2 text-xs text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
            Thư mục này mới có trên Am, chưa từng ghi thật lên YouTube.
          </p>
        ) : null}

        {cacThe.length === 0 && playlist.itemCount > 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-neutral-300 p-10 text-center dark:border-neutral-700">
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Trên YouTube playlist này có {playlist.itemCount} video, nhưng
              Am chưa biết nội dung của video nào trong số đó.
            </p>
            <p className="mt-2 text-xs text-neutral-400 dark:text-neutral-500">
              Am chỉ hiện được video đến từ các kênh đang theo dõi hoặc đã quét
              qua — playlist gom video ngoài phạm vi đó (nhạc, việc riêng…) thì
              trang này tạm thời trống, dù bên YouTube vẫn còn nguyên.
            </p>
          </div>
        ) : cacThe.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-neutral-300 p-10 text-center dark:border-neutral-700">
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Playlist này chưa có nội dung nào.
            </p>
            <p className="mt-2 text-xs text-neutral-400 dark:text-neutral-500">
              Vào Khám phá, bấm nút ba chấm trên một thẻ rồi chọn &ldquo;Thêm
              vào Playlist&rdquo; để bỏ vào đây.
            </p>
          </div>
        ) : (
          <>
            {laChu ? (
              <p className="mt-4 text-xs text-neutral-400 dark:text-neutral-500">
                Kéo thẻ sang chỗ khác để đổi thứ tự, hoặc dùng hai nút ▲▼ dưới
                mỗi thẻ. Thứ tự lưu ngay trên Am; ghi thật lên YouTube vẫn chờ
                bạn duyệt ở trang Playlist.
              </p>
            ) : null}
            <LuoiPlaylistKeoTha
              playlistId={playlist.id}
              cacThe={cacThe}
              choKeo={laChu}
            />
          </>
        )}
      </div>
    </KhungTrang>
  );
}
