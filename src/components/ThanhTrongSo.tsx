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

  /**
   * Kéo một thanh lên thì BỐN THANH KIA TỰ TỤT XUỐNG cho tổng vẫn tròn 100%.
   *
   * ## Vì sao phải đổi cách làm
   *
   * Bản trước: mỗi thanh giữ một số thô 0–1, còn con số bên cạnh là **tỷ lệ**
   * (số thô chia tổng). Hai thứ đó chỉ trùng nhau lúc ban đầu. Vừa kéo một cái
   * là lệch ngay — kéo "chất lượng" lên hết cỡ thì núm nằm cuối vạch mà số lại
   * ghi 61%. Chủ dự án hỏi thẳng: *"khi tôi kéo 1 thanh đo tăng lên thì các
   * thanh còn lại không giảm... công thức tính của thanh đo này là ntn?"*
   *
   * Câu hỏi đúng chỗ. Công thức chấm điểm thì không sai — trọng số vốn chỉ có
   * ý nghĩa **tương đối**, nhân đôi cả năm cái thì điểm không đổi. Nhưng giao
   * diện vẽ núm theo số thô mà ghi số theo tỷ lệ, nên nhìn như hỏng.
   *
   * ## Cách làm mới
   *
   * Giờ thanh trượt CHÍNH LÀ tỷ lệ. Kéo một trụ tới x thì phần còn lại `1 - x`
   * chia cho bốn trụ kia **theo đúng tỷ lệ chúng đang có với nhau** — giữ
   * nguyên tương quan cũ, chỉ co lại cho vừa chỗ.
   *
   * Bốn trụ kia đang bằng 0 hết thì chia đều, vì lúc đó không còn tương quan
   * nào để giữ.
   */
  function doi(khoa: keyof BoTrongSo, giaTriMoi: number) {
    datThongBao(null);
    datTrongSo((cu) => {
      const x = Math.min(Math.max(giaTriMoi, 0), 1);
      const conLai = CAC_TRU.map((t) => t.khoa).filter((k) => k !== khoa);
      const tongConLai = conLai.reduce((s, k) => s + cu[k], 0);
      const choConLai = 1 - x;

      const moi = { ...cu, [khoa]: x } as BoTrongSo;
      for (const k of conLai) {
        moi[k] =
          tongConLai > 0
            ? (cu[k] / tongConLai) * choConLai
            : choConLai / conLai.length;
      }
      return moi;
    });
  }

  function luu() {
    batDauLuu(async () => {
      const kq = await luuTrongSo(loaiNguon, trongSo);
      datThongBao(kq.thongDiep);
    });
  }

  return (
    <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="mb-3 flex items-baseline justify-between">
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

      {/* MỘT DÒNG MỖI TRỤ: nhãn — thanh đo — số phần trăm.

          Bản trước xếp ba tầng (nhãn trên, thanh dưới), làm cả khối cao gấp
          đôi mà chẳng thêm thông tin gì. Chủ dự án yêu cầu thu thấp lại.

          Nhãn có bề ngang cố định `w-32` để mọi thanh đo bắt đầu và kết thúc
          cùng một chỗ — nhãn co giãn theo độ dài chữ thì thanh so le, mắt
          không so được trụ nào dài hơn trụ nào. */}
      <div className="space-y-1.5">
        {CAC_TRU.map((tru) => {
          const giaTri = trongSo[tru.khoa];
          const phanTram = tong > 0 ? (giaTri / tong) * 100 : 0;

          return (
            <div key={tru.khoa} className="flex items-center gap-3">
              <label
                htmlFor={`${loaiNguon}-${tru.khoa}`}
                title={tru.moTa}
                className="w-32 shrink-0 cursor-help truncate text-xs font-medium text-neutral-700 decoration-dotted underline-offset-2 hover:underline dark:text-neutral-300"
              >
                {tru.ten}
              </label>
              <input
                id={`${loaiNguon}-${tru.khoa}`}
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={giaTri}
                disabled={!choSua}
                onChange={(e) => doi(tru.khoa, Number(e.target.value))}
                className="min-w-0 flex-1 accent-cam-600 disabled:opacity-40 dark:accent-cam-500"
              />
              <span className="w-9 shrink-0 text-right text-xs tabular-nums text-neutral-500 dark:text-neutral-400">
                {phanTram.toFixed(0)}%
              </span>
            </div>
          );
        })}
      </div>

      {choSua ? (
        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            onClick={luu}
            disabled={!daDoi || dangLuu || tong <= 0}
            className="rounded-lg bg-cam-600 px-4 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-30 dark:bg-cam-500 dark:text-white"
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
