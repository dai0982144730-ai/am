"use client";

/**
 * Ô đặt hàng cho chuyên mục Ngẫu hứng.
 *
 * ## Vì sao không phải một ô từ khoá
 *
 * Bản cũ chỉ có một ô gõ cụm chữ, ném thẳng vào ô tìm kiếm YouTube. Chủ dự án
 * chốt 2026-08-16 rằng thứ họ cần là **đặt hàng bằng lời thường**:
 *
 * > *"Tìm thể loại sách về truyện nhưng phải là truyện kinh dị của Trung quốc
 * > loại ngắn có thời lượng trên 1h và nội dung hiện đại"*
 *
 * Một câu như thế chứa bốn điều kiện mà từ khoá không diễn đạt nổi: thể loại,
 * xuất xứ, thời lượng, thời đại. Nên ô lớn giữ nguyên văn cho Claude đọc, còn
 * **ba ô nhỏ** là ba hướng cụ thể để đi tìm — và chính ba chữ đó hiện ra ngoài
 * màn hình chính: *"Riêng ngẫu: nói về ma, hiện tượng có thật, tìm mộ"*.
 *
 * ## Kết quả chỉ có vào hôm sau
 *
 * Không tìm ngay lúc bấm lưu. Mỗi lượt tìm YouTube tốn 100 đơn vị hạn mức, mà
 * một câu đặt hàng đẻ ra nhiều lượt — bấm lưu vài lần trong một buổi tối là
 * cạn hạn mức cả ngày. Nên nó chờ lượt quét đêm.
 */

import { useState, useTransition } from "react";

import { datHangNgauHung } from "@/app/cai-dat/actions";

export interface DonNgauHung {
  yeuCau: string;
  chuDeCon: string[];
  quetLanCuoi: string | null;
  soBaiTimDuoc: number;
}

export function DatHangNgauHung({
  banDau,
  laChu,
}: {
  banDau: DonNgauHung | null;
  laChu: boolean;
}) {
  const [yeuCau, setYeuCau] = useState(banDau?.yeuCau ?? "");
  const [oChuDe, setOChuDe] = useState<string[]>([
    banDau?.chuDeCon[0] ?? "",
    banDau?.chuDeCon[1] ?? "",
    banDau?.chuDeCon[2] ?? "",
  ]);
  const [thongDiep, setThongDiep] = useState<string | null>(null);
  const [dangChay, batDau] = useTransition();

  function luu() {
    setThongDiep(null);
    batDau(async () => {
      const kq = await datHangNgauHung(yeuCau, oChuDe);
      setThongDiep(kq.thongDiep);
    });
  }

  const daDay = oChuDe.filter((x) => x.trim()).length;

  return (
    <section>
      <h2 className="text-base font-semibold">Ngẫu hứng</h2>
      <p className="mt-2 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
        Chỗ đặt hàng cho những thứ không thuộc năm mảng cố định. Viết bằng lời
        thường, càng rõ điều kiện càng tốt — Claude đọc câu này rồi tự rút ra
        tiêu chí để đi tìm.
      </p>
      <p className="mt-2 rounded-lg bg-neutral-50 px-3 py-2 text-xs leading-relaxed text-neutral-600 dark:bg-neutral-900 dark:text-neutral-300">
        Kết quả <strong>có vào sáng hôm sau</strong>, không tìm ngay lúc lưu. Mỗi
        lượt tìm YouTube tốn 100 đơn vị hạn mức nên việc tìm chờ lượt quét đêm.
      </p>

      <div className="mt-4 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
        <label htmlFor="yeu-cau-ngau-hung" className="text-sm font-medium">
          Bạn muốn tìm gì
        </label>
        <textarea
          id="yeu-cau-ngau-hung"
          rows={4}
          value={yeuCau}
          disabled={!laChu || dangChay}
          onChange={(e) => setYeuCau(e.target.value)}
          placeholder="Ví dụ: Tìm truyện kinh dị Trung Quốc loại ngắn, thời lượng trên 1 tiếng, nội dung hiện đại chứ không phải cổ trang"
          className="mt-2 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm leading-relaxed outline-none focus:border-cam-500 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900"
        />

        <p className="mt-4 text-sm font-medium">Ba hướng cụ thể</p>
        <p className="mt-1 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
          Chính ba chữ này hiện ngoài màn hình chính, kiểu{" "}
          <em>&ldquo;Riêng ngẫu: nói về ma, hiện tượng có thật, tìm mộ&rdquo;</em>.
        </p>

        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {oChuDe.map((gia, i) => (
            <input
              key={i}
              type="text"
              value={gia}
              disabled={!laChu || dangChay}
              onChange={(e) => {
                const moi = [...oChuDe];
                moi[i] = e.target.value;
                setOChuDe(moi);
              }}
              placeholder={["nói về ma", "hiện tượng có thật", "tìm mộ"][i]}
              className="min-w-0 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-cam-500 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900"
            />
          ))}
        </div>

        <button
          type="button"
          onClick={luu}
          disabled={!laChu || dangChay || (!yeuCau.trim() && daDay === 0)}
          className="mt-3 rounded-lg bg-cam-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-cam-700 disabled:opacity-50"
        >
          {dangChay ? "Đang lưu…" : "Lưu đơn đặt hàng"}
        </button>

        {thongDiep ? (
          <p className="mt-3 text-xs leading-relaxed text-cam-700 dark:text-cam-300">
            {thongDiep}
          </p>
        ) : null}

        {banDau?.quetLanCuoi ? (
          <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
            Quét gần nhất {banDau.quetLanCuoi} · tìm được {banDau.soBaiTimDuoc}{" "}
            nội dung
          </p>
        ) : banDau ? (
          <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
            Chưa quét lần nào — sẽ chạy trong lượt quét đêm nay.
          </p>
        ) : null}

        {!laChu ? (
          <p className="mt-2 text-xs text-neutral-400">
            Đăng nhập để đặt hàng.
          </p>
        ) : null}
      </div>
    </section>
  );
}
