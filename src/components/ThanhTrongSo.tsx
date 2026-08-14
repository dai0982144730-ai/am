"use client";

/**
 * Thanh trượt chỉnh trọng số chấm điểm cho một loại nguồn.
 *
 * Người dùng cứ kéo thoải mái, không phải tự tính cho tròn 100% — phần chuẩn
 * hoá về tổng bằng 1 làm ở phía máy chủ. Nhưng vẫn hiện phần trăm thực tế ngay
 * bên cạnh, để thấy được mình đang cho trụ nào nặng hơn trụ nào.
 *
 * Khách xem được nhưng không kéo được: thanh trượt bị khoá và nút lưu biến mất.
 */

import { useState, useTransition } from "react";

import { luuTrongSo } from "@/app/cai-dat/actions";
import type { SourceType } from "@/generated/prisma/enums";

interface BoTrongSo {
  popularity: number;
  engagementDepth: number;
  discussion: number;
  authority: number;
  contentQuality: number;
}

const CAC_TRU: {
  khoa: keyof BoTrongSo;
  ten: string;
  moTa: string;
}[] = [
  {
    khoa: "popularity",
    ten: "Độ phổ biến",
    moTa: "Lượt xem chia theo quy mô nguồn, để kênh nhỏ không bị kênh lớn đè",
  },
  {
    khoa: "engagementDepth",
    ten: "Độ tương tác",
    moTa: "Tỷ lệ bình luận và lượt thích trên lượt xem",
  },
  {
    khoa: "discussion",
    ten: "Chất lượng thảo luận",
    moTa: "Claude đọc bình luận thật, phân biệt bàn luận thực chất với emoji",
  },
  {
    khoa: "authority",
    ten: "Uy tín nguồn",
    moTa: "Người theo dõi, whitelist, tuổi kênh",
  },
  {
    khoa: "contentQuality",
    ten: "Chất lượng nội dung",
    moTa: "Claude đọc nội dung — không áp dụng cho nhạc",
  },
];

export function ThanhTrongSo({
  loaiNguon,
  tenHienThi,
  banDau,
  macDinh,
  choSua,
}: {
  loaiNguon: SourceType;
  tenHienThi: string;
  banDau: BoTrongSo;
  macDinh: BoTrongSo | null;
  choSua: boolean;
}) {
  const [trongSo, datTrongSo] = useState<BoTrongSo>(banDau);
  const [dangLuu, batDauLuu] = useTransition();
  const [thongBao, datThongBao] = useState<string | null>(null);

  const tong =
    trongSo.popularity +
    trongSo.engagementDepth +
    trongSo.discussion +
    trongSo.authority +
    trongSo.contentQuality;

  const daDoi = CAC_TRU.some(
    (tru) => Math.abs(trongSo[tru.khoa] - banDau[tru.khoa]) > 0.001,
  );

  function doi(khoa: keyof BoTrongSo, giaTri: number) {
    datTrongSo((cu) => ({ ...cu, [khoa]: giaTri }));
    datThongBao(null);
  }

  function luu() {
    batDauLuu(async () => {
      const kq = await luuTrongSo(loaiNguon, trongSo);
      datThongBao(kq.thongDiep);
    });
  }

  return (
    <div className="rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
      <div className="mb-4 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold">{tenHienThi}</h3>
        {macDinh ? (
          <button
            type="button"
            disabled={!choSua}
            onClick={() => {
              datTrongSo(macDinh);
              datThongBao(null);
            }}
            className="text-xs text-neutral-400 underline disabled:no-underline disabled:opacity-40 dark:text-neutral-500"
          >
            Về mặc định
          </button>
        ) : null}
      </div>

      <div className="space-y-3">
        {CAC_TRU.map((tru) => {
          const giaTri = trongSo[tru.khoa];
          const phanTram = tong > 0 ? (giaTri / tong) * 100 : 0;

          return (
            <div key={tru.khoa}>
              <div className="flex items-baseline justify-between gap-3">
                <label
                  htmlFor={`${loaiNguon}-${tru.khoa}`}
                  className="text-xs font-medium text-neutral-700 dark:text-neutral-300"
                >
                  {tru.ten}
                </label>
                <span className="shrink-0 text-xs tabular-nums text-neutral-500 dark:text-neutral-400">
                  {phanTram.toFixed(0)}%
                </span>
              </div>
              <input
                id={`${loaiNguon}-${tru.khoa}`}
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={giaTri}
                disabled={!choSua}
                onChange={(e) => doi(tru.khoa, Number(e.target.value))}
                className="mt-1 w-full accent-neutral-900 disabled:opacity-40 dark:accent-neutral-100"
              />
              <p className="mt-0.5 text-[11px] leading-snug text-neutral-400 dark:text-neutral-500">
                {tru.moTa}
              </p>
            </div>
          );
        })}
      </div>

      {choSua ? (
        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={luu}
            disabled={!daDoi || dangLuu || tong <= 0}
            className="rounded-lg bg-neutral-900 px-4 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-30 dark:bg-neutral-100 dark:text-neutral-900"
          >
            {dangLuu ? "Đang lưu…" : "Lưu"}
          </button>
          {thongBao ? (
            <p className="text-xs leading-snug text-neutral-500 dark:text-neutral-400">
              {thongBao}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
