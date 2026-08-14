import Link from "next/link";

/**
 * Hàng "đang xem dở" ở trang chủ.
 *
 * ĐÂY LÀ CHỖ VIỆC ĐỒNG BỘ HAI MÁY TRẢ CÔNG. Ghi được vị trí đang xem mà không
 * bày ra thì cũng như không: mở điện thoại lên vẫn phải nhớ tên video rồi đi
 * tìm lại. Có hàng này thì bỏ dở ở máy tính, cầm điện thoại lên là thấy ngay,
 * bấm một cái vào đúng chỗ đang dở.
 *
 * Khách không thấy gì cả — họ không có lịch sử, và cũng không được nhìn lịch sử
 * của chủ nhà.
 */

import type { MucDangDo } from "@/lib/tieuThu/docTienDo";

function docPhutGiay(giay: number): string {
  const g = Math.floor(giay / 3600);
  const p = Math.floor((giay % 3600) / 60);
  const s = Math.floor(giay % 60);
  const haiSo = (n: number) => String(n).padStart(2, "0");
  return g > 0 ? `${g}:${haiSo(p)}:${haiSo(s)}` : `${p}:${haiSo(s)}`;
}

function conLai(muc: MucDangDo): string | null {
  if (!muc.durationSeconds) return null;
  const phut = Math.round((muc.durationSeconds - muc.viTriGiay) / 60);
  return phut > 0 ? `còn ${phut} phút` : "sắp hết";
}

export function DangXemDo({ cacMuc }: { cacMuc: MucDangDo[] }) {
  if (cacMuc.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="mb-3 text-base font-semibold">Đang xem dở</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cacMuc.map((muc) => (
          <Link
            key={muc.id}
            href={`/xem/${muc.id}`}
            className="group overflow-hidden rounded-xl border border-neutral-200 transition-colors hover:border-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-600"
          >
            <div className="relative aspect-video bg-neutral-100 dark:bg-neutral-800">
              {muc.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={muc.thumbnailUrl}
                  alt=""
                  className="size-full object-cover"
                />
              ) : null}
              {/* Thanh tiến độ đỏ, đúng chỗ mắt đã quen tìm */}
              <div className="absolute inset-x-0 bottom-0 h-1 bg-neutral-900/40">
                <div
                  className="h-full bg-red-500"
                  style={{ width: `${muc.phanTram}%` }}
                />
              </div>
            </div>
            <div className="p-3">
              <h3 className="line-clamp-2 text-sm font-medium leading-snug">
                {muc.title}
              </h3>
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                {muc.tenNguon}
              </p>
              <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
                Tiếp từ {docPhutGiay(muc.viTriGiay)}
                {conLai(muc) ? ` · ${conLai(muc)}` : ""}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
