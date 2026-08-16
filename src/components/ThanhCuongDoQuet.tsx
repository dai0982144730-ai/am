"use client";

/**
 * Thanh trượt cường độ quét đêm.
 *
 * ## Vì sao chỉ ghi khi thả tay
 *
 * Kéo một lượt từ trái sang phải sinh ra hàng trăm lần đổi giá trị. Ghi từng
 * lần là hàng trăm lượt vào database cho một thao tác duy nhất. Nên con số hiện
 * lên đổi ngay theo tay (`onChange`), còn việc ghi chỉ chạy lúc buông
 * (`onPointerUp`/`onKeyUp`) — người dùng vẫn thấy phản hồi tức thì mà máy chủ
 * chỉ nhận đúng một lời gọi.
 *
 * ## Vì sao có nấc 100 rõ ràng
 *
 * Mốc giữa là "như thiết kế gốc" và người ta sẽ quay về đó thường xuyên. Thanh
 * trượt trơn thì canh đúng 100 rất khó — trượt tay một chút là 97 hay 104, chạy
 * đêm ra kết quả hơi khác mà không hiểu vì sao. Bước nhảy 10 làm mốc giữa bắt
 * dính, và không ai cần độ chính xác hơn thế.
 */

import { useState, useTransition } from "react";

import { datCuongDoQuet } from "@/app/van-hanh/actions";
import {
  CUONG_DO_MAC_DINH,
  CUONG_DO_TOI_DA,
  moTaCuongDo,
} from "@/lib/vanHanh/mucCuongDo";

/** Ví dụ cho dễ hình dung: mỗi đêm phân loại chừng này nội dung ở mức 100%. */
const VI_DU_MOC_100 = 80;

export function ThanhCuongDoQuet({
  banDau,
  choPhepSua,
}: {
  banDau: number;
  /** Khách vẫn THẤY mức đang đặt, chỉ không kéo được */
  choPhepSua: boolean;
}) {
  const [giaTri, setGiaTri] = useState(banDau);
  const [dangGhi, batDau] = useTransition();

  const daLuu = giaTri === banDau;

  function ghi(x: number) {
    if (!choPhepSua || x === banDau) return;
    batDau(() => datCuongDoQuet(x));
  }

  return (
    <section>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
        Cường độ quét đêm
      </h2>
      <p className="mt-1.5 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
        Một thanh kéo cho cả đường ống: số video xét mỗi kênh, số bài mỗi blog,
        số nội dung nhờ Claude phân loại… đều nhân theo hệ số này. Chỉnh chung
        thì đường ống luôn cân — quét về gấp đôi mà vẫn phân loại như cũ thì
        phần dôi ra chỉ nằm chờ.
      </p>

      <div className="mt-4">
        <div className="flex items-baseline justify-between gap-3">
          <span
            className={`text-2xl font-semibold tabular-nums ${
              giaTri === 0
                ? "text-neutral-400 dark:text-neutral-500"
                : giaTri > CUONG_DO_MAC_DINH
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-neutral-900 dark:text-neutral-100"
            }`}
          >
            {giaTri}%
          </span>
          <span className="text-xs text-neutral-500 dark:text-neutral-400">
            {!choPhepSua
              ? "đăng nhập để chỉnh"
              : dangGhi
                ? "đang lưu…"
                : daLuu
                  ? "đã lưu"
                  : "thả tay để lưu"}
          </span>
        </div>

        <input
          type="range"
          min={0}
          max={CUONG_DO_TOI_DA}
          step={10}
          value={giaTri}
          disabled={dangGhi || !choPhepSua}
          onChange={(e) => setGiaTri(Number(e.target.value))}
          onPointerUp={() => ghi(giaTri)}
          onKeyUp={() => ghi(giaTri)}
          aria-label="Cường độ quét đêm"
          className="mt-3 w-full accent-cam-600 dark:accent-cam-500"
        />

        <div className="mt-1 flex justify-between text-[11px] text-neutral-400 dark:text-neutral-500">
          <span>0% · đứng im</span>
          <span>100% · thường ngày</span>
          <span>200% · gấp đôi</span>
        </div>

        <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-300">
          {moTaCuongDo(giaTri)}
        </p>

        {/* Nói bằng con số cụ thể, vì "gấp đôi" một mình thì không hình dung được */}
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          {giaTri === 0
            ? "Lịch chạy 21h vẫn tới, nhưng lượt chạy sẽ thoát ngay và không ghi lại gì."
            : `Mỗi đêm nhờ Claude phân loại chừng ${Math.max(
                1,
                Math.ceil((VI_DU_MOC_100 * giaTri) / 100),
              )} nội dung (mức thường ngày là ${VI_DU_MOC_100}).`}
        </p>

        {giaTri > CUONG_DO_MAC_DINH ? (
          <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800 dark:bg-amber-950 dark:text-amber-300">
            Trên 100% thì hạn mức YouTube và gói Claude Pro cũng tiêu theo đúng
            tỷ lệ đó. Xem ô hạn mức đầu trang trước khi để lâu ở mức này.
          </p>
        ) : null}
      </div>
    </section>
  );
}
