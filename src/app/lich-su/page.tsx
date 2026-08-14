import Link from "next/link";

import { auth } from "@/auth";
import { KhungTrang } from "@/components/KhungTrang";
import { MucLichSu, NutXoaSachLichSu } from "@/components/MucLichSu";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

const TEN_NHOM: Record<string, string> = {
  ai: "AI",
  triet_hoc: "Triết học",
  truyen: "Truyện",
  music: "Music",
  khoa_hoc: "Khoa học",
  new_search: "New",
  other: "Khác",
};

export default async function TrangLichSu() {
  const phien = await auth();

  if (!phien?.user?.email) {
    return (
      <KhungTrang emailNguoiDung={null}>
        <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
          <h1 className="text-xl font-semibold tracking-tight">Lịch sử xem</h1>
          <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
            Lịch sử là của riêng chủ nhà. Cần đăng nhập mới mở được.
          </p>
          <Link
            href="/dang-nhap"
            className="mt-6 inline-block rounded-lg bg-cam-600 px-4 py-2 text-sm font-medium text-white"
          >
            Đăng nhập
          </Link>
        </div>
      </KhungTrang>
    );
  }

  const cacMuc = await prisma.watchHistory.findMany({
    orderBy: { lastOpenedAt: "desc" },
    take: 200,
    select: {
      lastOpenedAt: true,
      openCount: true,
      contentItem: {
        select: {
          id: true,
          title: true,
          thumbnailUrl: true,
          durationSeconds: true,
          contentGroup: true,
          source: { select: { title: true } },
          score: { select: { compositeScore: true } },
          libraryItem: { select: { id: true } },
        },
      },
    },
  });

  return (
    <KhungTrang emailNguoiDung={phien.user.email}>
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h1 className="text-xl font-semibold tracking-tight">Lịch sử xem</h1>
          {cacMuc.length > 0 ? <NutXoaSachLichSu /> : null}
        </div>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Mở ra xem là nội dung chuyển sang đây và biến khỏi Trang chủ, Khám
          phá, New — nên lần sau lướt là toàn thứ mới. Trừ thứ bạn đã cất vào
          thư viện, chúng vẫn ở lại luồng chính.
        </p>

        {cacMuc.length === 0 ? (
          <div className="mt-10 rounded-xl border border-dashed border-neutral-300 p-10 text-center dark:border-neutral-700">
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Chưa mở nội dung nào.
            </p>
          </div>
        ) : (
          <ul className="mt-6 divide-y divide-neutral-200 dark:divide-neutral-800">
            {cacMuc.map((m) => (
              <MucLichSu
                key={m.contentItem.id}
                id={m.contentItem.id}
                tieuDe={m.contentItem.title}
                anh={m.contentItem.thumbnailUrl}
                nguon={m.contentItem.source.title}
                chuyenMuc={
                  TEN_NHOM[m.contentItem.contentGroup] ??
                  m.contentItem.contentGroup
                }
                diem={m.contentItem.score?.compositeScore ?? null}
                daCatThuVien={Boolean(m.contentItem.libraryItem)}
                moLuc={m.lastOpenedAt}
                soLanMo={m.openCount}
              />
            ))}
          </ul>
        )}
      </div>
    </KhungTrang>
  );
}
