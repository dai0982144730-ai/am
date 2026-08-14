import Link from "next/link";

import { KhungTrang } from "@/components/KhungTrang";
import { prisma } from "@/lib/db/prisma";
import { emailChuDuAn } from "@/lib/quyen";

export const dynamic = "force-dynamic";

interface MucGon {
  id: string;
  tieuDe: string;
  nguon: string;
  thoiLuongGiay?: number | null;
  diem?: number | null;
  daThuatLai?: boolean;
  nhanXet?: string | null;
  chuyenMuc?: string;
}

interface NoiDungGon {
  topPicks?: {
    chuyenMuc: string;
    tenChuyenMuc: string;
    cacMuc: MucGon[];
  }[];
  moreIfInterested?: MucGon[];
}

function docThoiLuong(giay: number | null | undefined): string | null {
  if (!giay) return null;
  const phut = Math.round(giay / 60);
  return phut >= 60
    ? `${Math.floor(phut / 60)} giờ ${phut % 60} phút`
    : `${phut} phút`;
}

export default async function TrangBanTin() {
  const [email, banTin] = await Promise.all([
    emailChuDuAn(),
    prisma.assistantBriefing.findFirst({
      orderBy: { deliveredAt: "desc" },
      include: { digestRun: true },
    }),
  ]);

  const noiDung = (banTin?.pickedItemsTiered ?? {}) as NoiDungGon;

  return (
    <KhungTrang emailNguoiDung={email}>
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <h1 className="text-xl font-semibold tracking-tight">
          Am nói với bạn
        </h1>

        {!banTin ? (
          <div className="mt-6 rounded-xl border border-dashed border-neutral-300 p-10 text-center dark:border-neutral-700">
            <p className="text-sm text-neutral-500">Chưa có bản tin nào.</p>
            <p className="mt-2 text-xs text-neutral-400">
              Bản tin được viết mỗi đêm sau khi quét xong. Tạo tay bằng{" "}
              <code>npx tsx scripts/tao-ban-tin.ts</code>
            </p>
          </div>
        ) : (
          <>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              {banTin.deliveredAt.toLocaleString("vi-VN", {
                weekday: "long",
                day: "numeric",
                month: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>

            {/* Bản tin trò chuyện — thứ chính của trang này */}
            <div className="mt-5 rounded-2xl border border-neutral-200 bg-neutral-50 p-6 dark:border-neutral-800 dark:bg-neutral-900">
              <div className="whitespace-pre-wrap text-[15px] leading-relaxed text-neutral-800 dark:text-neutral-200">
                {banTin.conversationalScript}
              </div>
              <p className="mt-4 border-t border-neutral-200 pt-3 text-xs text-neutral-400 dark:border-neutral-800 dark:text-neutral-500">
                Phần đọc thành tiếng sẽ có khi cấu hình xong giọng đọc.
              </p>
            </div>

            {/* Các mục được nhắc tới, để bấm vào xem ngay */}
            {noiDung.topPicks?.map((muc) => (
              <section key={muc.chuyenMuc} className="mt-8">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                  {muc.tenChuyenMuc}
                </h2>
                <div className="space-y-3">
                  {muc.cacMuc.map((m) => (
                    <Link
                      key={m.id}
                      href={`/xem/${m.id}`}
                      className="block rounded-xl border border-neutral-200 p-4 transition-colors hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="text-sm font-medium leading-snug">
                          {m.tieuDe}
                        </h3>
                        {m.diem != null ? (
                          <span className="shrink-0 rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-semibold tabular-nums dark:bg-neutral-800">
                            {m.diem.toFixed(1)}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                        {[
                          m.nguon,
                          docThoiLuong(m.thoiLuongGiay),
                          m.daThuatLai ? "đã thuật lại tiếng Việt" : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      {m.nhanXet ? (
                        <p className="mt-2 text-xs leading-relaxed text-neutral-600 dark:text-neutral-300">
                          {m.nhanXet}
                        </p>
                      ) : null}
                    </Link>
                  ))}
                </div>
              </section>
            ))}

            {noiDung.moreIfInterested &&
            noiDung.moreIfInterested.length > 0 ? (
              <section className="mt-8">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                  Xem thêm nếu rảnh
                </h2>
                <div className="space-y-2">
                  {noiDung.moreIfInterested.map((m) => (
                    <Link
                      key={m.id}
                      href={`/xem/${m.id}`}
                      className="flex items-baseline justify-between gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    >
                      <span className="line-clamp-1">{m.tieuDe}</span>
                      <span className="shrink-0 text-xs text-neutral-400">
                        {m.nguon}
                      </span>
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}

            <p className="mt-8 text-xs text-neutral-400 dark:text-neutral-500">
              Chắt từ {banTin.digestRun.newItemsFound} nội dung quét về.
            </p>
          </>
        )}
      </div>
    </KhungTrang>
  );
}
