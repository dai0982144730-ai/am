"use client";

/**
 * Một dòng trong lịch sử xem, kèm nút trả lại luồng chính.
 *
 * VÌ SAO NÚT "TRẢ LẠI" LÀ BẮT BUỘC: cơ chế "mở ra là ẩn đi" rất dễ nuốt nhầm.
 * Bấm vào rồi nhận ra chưa muốn xem bây giờ, thế là nó biến khỏi trang chủ. Không
 * có nút này thì mỗi lần lỡ tay lại phải nhớ mà đi tìm — mà nhớ được thì đã
 * chẳng cần cái danh sách này.
 */

import Link from "next/link";
import { useState, useTransition } from "react";

import { boKhoiLichSu, xoaSachLichSu } from "@/lib/lichSu/actions";

function docLuc(luc: Date): string {
  const soPhut = Math.floor((Date.now() - luc.getTime()) / 60_000);
  if (soPhut < 60) return `${soPhut} phút trước`;
  const soGio = Math.floor(soPhut / 60);
  if (soGio < 24) return `${soGio} giờ trước`;
  return `${Math.floor(soGio / 24)} ngày trước`;
}

export function MucLichSu({
  id,
  tieuDe,
  anh,
  nguon,
  chuyenMuc,
  diem,
  daCatThuVien,
  moLuc,
  soLanMo,
}: {
  id: string;
  tieuDe: string;
  anh: string | null;
  nguon: string;
  chuyenMuc: string;
  diem: number | null;
  daCatThuVien: boolean;
  moLuc: Date;
  soLanMo: number;
}) {
  const [daTraLai, setDaTraLai] = useState(false);
  const [dangChay, batDau] = useTransition();

  return (
    <li className="flex gap-4 py-4">
      <Link
        href={`/xem/${id}`}
        className="hidden w-32 shrink-0 overflow-hidden rounded-lg bg-neutral-100 sm:block dark:bg-neutral-800"
      >
        {anh ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={anh} alt="" className="aspect-video w-full object-cover" />
        ) : (
          <div className="aspect-video" />
        )}
      </Link>

      <div className="min-w-0 flex-1">
        <Link href={`/xem/${id}`} className="hover:underline">
          <h3 className="line-clamp-2 text-sm font-medium leading-snug">
            {tieuDe}
          </h3>
        </Link>
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          {[
            nguon,
            chuyenMuc,
            diem != null ? `${diem.toFixed(1)}/10` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <p className="mt-0.5 text-xs text-neutral-400 dark:text-neutral-500">
          Mở {docLuc(moLuc)}
          {soLanMo > 1 ? ` · đã mở ${soLanMo} lần` : ""}
          {daCatThuVien ? " · đã cất thư viện, vẫn ở luồng chính" : ""}
        </p>

        {daTraLai ? (
          <p className="mt-2 text-xs text-cam-600 dark:text-cam-300">
            Đã trả lại luồng chính.
          </p>
        ) : (
          <button
            type="button"
            disabled={dangChay}
            onClick={() =>
              batDau(async () => {
                const kq = await boKhoiLichSu(id);
                if (kq.ok) setDaTraLai(true);
              })
            }
            className="mt-2 text-xs text-neutral-400 underline hover:text-neutral-700 disabled:opacity-40 dark:hover:text-neutral-200"
          >
            Trả lại trang chủ
          </button>
        )}
      </div>
    </li>
  );
}

/**
 * Xoá sạch lịch sử.
 *
 * Hỏi lại một lần trước khi xoá. Không phải vì mất mát gì lớn — nội dung trong
 * kho còn nguyên — mà vì hậu quả bất ngờ: xoá xong thì hàng trăm thứ đã xem đổ
 * ngược lại trang chủ cùng lúc.
 */
export function NutXoaSachLichSu() {
  const [hoiLai, setHoiLai] = useState(false);
  const [thongDiep, setThongDiep] = useState<string | null>(null);
  const [dangChay, batDau] = useTransition();

  if (thongDiep) {
    return (
      <span className="text-xs text-neutral-500 dark:text-neutral-400">
        {thongDiep}
      </span>
    );
  }

  if (!hoiLai) {
    return (
      <button
        type="button"
        onClick={() => setHoiLai(true)}
        className="text-xs text-neutral-400 underline hover:text-neutral-700 dark:hover:text-neutral-200"
      >
        Xoá sạch lịch sử
      </button>
    );
  }

  return (
    <span className="flex items-center gap-2 text-xs">
      <span className="text-neutral-500 dark:text-neutral-400">
        Xoá xong mọi thứ đã xem sẽ hiện lại ở trang chủ. Chắc chưa?
      </span>
      <button
        type="button"
        disabled={dangChay}
        onClick={() =>
          batDau(async () => {
            const kq = await xoaSachLichSu();
            setThongDiep(kq.thongDiep);
          })
        }
        className="rounded-lg bg-cam-600 px-2.5 py-1 font-medium text-white disabled:opacity-40"
      >
        Xoá
      </button>
      <button
        type="button"
        onClick={() => setHoiLai(false)}
        className="text-neutral-400 underline"
      >
        Thôi
      </button>
    </span>
  );
}
