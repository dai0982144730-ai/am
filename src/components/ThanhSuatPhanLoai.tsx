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
 */

import { useState, useTransition } from "react";

import { datSuatPhanLoai } from "@/app/van-hanh/actions";
import {
  CAC_CHUYEN_MUC,
  CAC_NHOM_NGUON,
  DON_VI_NGUON,
  SO_LAN_TOI_DA,
  SUAT_MAC_DINH,
  TEN_CHUYEN_MUC,
  TEN_NHOM_NGUON,
  type CaiDatSuat,
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
  banDau,
  hangCon,
  choPhepSua,
}: {
  banDau: CaiDatSuat;
  hangCon: HangCon;
  choPhepSua: boolean;
}) {
  const [muc, setMuc] = useState(banDau.chuyenMuc);
  const [tyLe, setTyLe] = useState(banDau.tyLeNguon);
  const [dangGhi, batDau] = useTransition();
  const [daLuu, setDaLuu] = useState(true);

  const tong = CAC_CHUYEN_MUC.reduce((t, m) => t + muc[m], 0);

  function ghi(mucMoi = muc, tyLeMoi = tyLe) {
    if (!choPhepSua) return;
    setDaLuu(false);
    batDau(async () => {
      await datSuatPhanLoai(mucMoi, tyLeMoi);
      setDaLuu(true);
    });
  }

  function doiMuc(m: MaChuyenMuc, x: number) {
    const moi = { ...muc, [m]: x };
    setMuc(moi);
    return moi;
  }

  /**
   * Kéo YouTube hoặc Podcast thì ô Blog tự tính lại.
   *
   * Kéo YouTube lên quá cao thì Podcast bị đẩy xuống trước, Blog giữ 0 — chứ
   * không để Blog âm.
   */
  function doiTyLe(n: MaNhomNguon, x: number) {
    let youtube = tyLe.youtube;
    let nghe = tyLe.nghe;
    if (n === "youtube") {
      youtube = Math.min(100, x);
      nghe = Math.min(nghe, 100 - youtube);
    } else {
      nghe = Math.min(x, 100 - youtube);
    }
    const moi = { youtube, nghe, viet: 100 - youtube - nghe };
    setTyLe(moi);
    return moi;
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

      <div className="mt-2 space-y-2.5">
        {CAC_CHUYEN_MUC.map((m) => (
          <MotThanh
            key={m}
            nhan={TEN_CHUYEN_MUC[m]}
            giaTri={muc[m]}
            toiDa={SUAT_MAC_DINH[m] * SO_LAN_TOI_DA}
            duoi={`${muc[m]} bài`}
            tat={!choPhepSua || dangGhi}
            onDoi={(x) => setMuc({ ...muc, [m]: x })}
            onXong={(x) => ghi(doiMuc(m, x), tyLe)}
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
              onDoi={(x) => doiTyLe(n, x)}
              onXong={(x) => ghi(muc, doiTyLe(n, x))}
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
