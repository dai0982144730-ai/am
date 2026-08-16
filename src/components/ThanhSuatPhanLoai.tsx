"use client";

/**
 * Hai nhóm thanh trượt quyết định mỗi đêm Claude đọc những gì.
 *
 * **Nhóm trên — sáu chuyên mục.** Mỗi thanh là số bài của mục đó, giữa là 10,
 * kéo hết phải là 60 (sáu lần), kéo hết trái là 0. Dưới thanh hiện thẳng số bài
 * chứ không hiện phần trăm — chủ dự án chốt 2026-08-16: *"hiển thị là bao nhiêu
 * video, tập nghe, bài viết mỗi đêm"*.
 *
 * **Nhóm dưới — ba loại nguồn.** Ba phần trăm luôn cộng đúng 100. Ô thứ ba
 * không kéo được, nó **luôn bằng phần còn lại** — vì ba con số tự do thì gần
 * như lúc nào cũng lệch 100, và bắt người dùng tự cộng nhẩm cho khớp là việc
 * của máy chứ không phải của họ. Hai ô đầu vượt quá 100 thì ô thứ hai bị đẩy
 * xuống, ô ba không bao giờ âm.
 *
 * Ba thanh này hiện **số bài**, không hiện phần trăm.
 *
 * ## Số hiện lên đã nhân cường độ
 *
 * Thanh trượt giữ **mức thường ngày** (mặc định 10), còn con số bên phải là
 * *thật sự đêm nay chạy bao nhiêu* — tức đã nhân hệ số cường độ ở khối trên.
 * Kéo cường độ lên 200% thì mỗi mục hiện 20 bài và tổng hiện 120, đúng như chủ
 * dự án chỉ ra 2026-08-16: *"kéo thanh bên trên tới 200% thì bên dưới phải tự
 * động chuyển thành 120 mới là đúng"*.
 *
 * Vì vậy `muc`/`tyLe` do `KhoiCuongDoVaSuat` giữ hộ — nó biết cả cường độ.
 */

import { useState, useTransition } from "react";

import { datSuatPhanLoai } from "@/app/van-hanh/actions";
import {
  CAC_CHUYEN_MUC,
  CAC_NHOM_NGUON,
  DON_VI_NGUON,
  SO_LAN_TOI_DA,
  suatSauCuongDo,
  SUAT_MAC_DINH,
  TEN_CHUYEN_MUC,
  TEN_NHOM_NGUON,
  tongSuat,
  type MaChuyenMuc,
  type MaNhomNguon,
} from "@/lib/vanHanh/mucSuat";

/** Nguồn nào đang có bao nhiêu bài chờ — để nói thẳng chỗ nào hụt. */
export interface HangCon {
  youtube: number;
  nghe: number;
  viet: number;
}

export function ThanhSuatPhanLoai({
  muc,
  tyLe,
  heSo,
  hangCon,
  choPhepSua,
  onDoiMuc,
  onDoiTyLe,
}: {
  muc: Record<MaChuyenMuc, number>;
  tyLe: Record<MaNhomNguon, number>;
  /** Hệ số cường độ đang kéo. 1 = mức thường ngày */
  heSo: number;
  hangCon: HangCon;
  choPhepSua: boolean;
  onDoiMuc: (m: MaChuyenMuc, x: number) => Record<MaChuyenMuc, number>;
  onDoiTyLe: (n: MaNhomNguon, x: number) => Record<MaNhomNguon, number>;
}) {
  const [dangGhi, batDau] = useTransition();
  const [daLuu, setDaLuu] = useState(true);

  // Số THẬT SỰ chạy đêm nay, không phải số ghi trên thanh trượt
  const thuc = suatSauCuongDo(muc, heSo);
  const tong = tongSuat(thuc);

  function ghi(mucMoi = muc, tyLeMoi = tyLe) {
    if (!choPhepSua) return;
    setDaLuu(false);
    batDau(async () => {
      await datSuatPhanLoai(mucMoi, tyLeMoi);
      setDaLuu(true);
    });
  }

  return (
    <section>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
        Mỗi đêm đọc những gì
      </h2>
      <p className="mt-1.5 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
        Trước đây Claude lấy các bài mới nhất, không phân biệt nguồn — YouTube có
        269 kênh nên nuốt gần hết suất, kho thành 81% YouTube và 2% podcast. Giờ
        bạn tự chia.
      </p>

      {/* ---- Sáu chuyên mục ---- */}
      <div className="mt-4 flex items-baseline justify-between gap-3">
        <span className="text-xs font-medium uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
          Từng chuyên mục
        </span>
        <span className="text-sm font-semibold tabular-nums">
          {tong} bài mỗi đêm
        </span>
      </div>

      {heSo !== 1 ? (
        <p className="mt-1 text-[11px] text-neutral-400 dark:text-neutral-500">
          Thanh trượt giữ mức thường ngày; số bài bên phải đã nhân cường độ{" "}
          {Math.round(heSo * 100)}%.
        </p>
      ) : null}

      <div className="mt-2 space-y-2.5">
        {CAC_CHUYEN_MUC.map((m) => (
          <MotThanh
            key={m}
            nhan={TEN_CHUYEN_MUC[m]}
            giaTri={muc[m]}
            toiDa={SUAT_MAC_DINH[m] * SO_LAN_TOI_DA}
            duoi={`${thuc[m]} bài`}
            tat={!choPhepSua || dangGhi}
            onDoi={(x) => onDoiMuc(m, x)}
            onXong={(x) => ghi(onDoiMuc(m, x), tyLe)}
          />
        ))}
      </div>

      {/* ---- Ba loại nguồn ---- */}
      <p className="mt-6 text-xs font-medium uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
        Chia theo loại nguồn
      </p>

      <div className="mt-2 space-y-2.5">
        {CAC_NHOM_NGUON.map((n) => {
          const soBai = Math.round((tong * tyLe[n]) / 100);
          const co = hangCon[n];
          const duU = co >= soBai;
          return (
            <MotThanh
              key={n}
              nhan={TEN_NHOM_NGUON[n]}
              giaTri={tyLe[n]}
              toiDa={100}
              // Thanh cuối không kéo được: nó là phần còn lại của hai thanh trên
              khoa={n === "viet"}
              duoi={
                <>
                  <span className={duU ? "" : "text-amber-600 dark:text-amber-400"}>
                    {soBai} {DON_VI_NGUON[n]}
                  </span>
                  {!duU ? (
                    <span className="text-amber-600 dark:text-amber-400">
                      {" "}
                      · chỉ có {co} bài đang chờ, phần thiếu lấy bù ở nguồn khác
                    </span>
                  ) : null}
                </>
              }
              tat={!choPhepSua || dangGhi}
              onDoi={(x) => onDoiTyLe(n, x)}
              onXong={(x) => ghi(muc, onDoiTyLe(n, x))}
            />
          );
        })}
      </div>

      <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
        {!choPhepSua
          ? "Đăng nhập để chỉnh."
          : dangGhi
            ? "đang lưu…"
            : daLuu
              ? "đã lưu"
              : "thả tay để lưu"}
      </p>
    </section>
  );
}

function MotThanh({
  nhan,
  giaTri,
  toiDa,
  duoi,
  tat,
  khoa,
  onDoi,
  onXong,
}: {
  nhan: string;
  giaTri: number;
  toiDa: number;
  duoi: React.ReactNode;
  tat: boolean;
  khoa?: boolean;
  onDoi: (x: number) => void;
  onXong: (x: number) => void;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-xs">
        <span className="font-medium text-neutral-700 dark:text-neutral-200">
          {nhan}
        </span>
        <span className="tabular-nums text-neutral-500 dark:text-neutral-400">
          {duoi}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={toiDa}
        step={1}
        value={giaTri}
        disabled={tat || khoa}
        onChange={(e) => onDoi(Number(e.target.value))}
        onPointerUp={(e) => onXong(Number(e.currentTarget.value))}
        onKeyUp={(e) => onXong(Number(e.currentTarget.value))}
        aria-label={nhan}
        className={`mt-1 w-full accent-cam-600 dark:accent-cam-500 ${
          khoa ? "opacity-60" : ""
        }`}
      />
    </div>
  );
}
