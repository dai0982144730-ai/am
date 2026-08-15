"use client";

/**
 * Hàng chip lọc và ô chọn cách sắp xếp cho trang Khám phá.
 *
 * Mọi lựa chọn đều ghi vào địa chỉ trang, nên bấm quay lại là về đúng bộ lọc
 * cũ, và gửi đường dẫn cho người khác thì họ thấy đúng thứ mình thấy.
 */

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

const CAC_NHOM = [
  { ma: "", ten: "Tất cả" },
  { ma: "ai", ten: "AI" },
  { ma: "triet_hoc", ten: "Triết học" },
  { ma: "khoa_hoc", ten: "Khoa học" },
  { ma: "truyen", ten: "Truyện" },
  { ma: "music", ten: "Music" },
  { ma: "other", ten: "Khác" },
];

const CACH_SAP_XEP = [
  { ma: "phu_hop_nhat", ten: "Phù hợp nhất" },
  { ma: "chat_luong_cao_nhat", ten: "Chất lượng cao nhất" },
  { ma: "moi_nhat", ten: "Mới nhất trước" },
];

const LOC_NHANH = [
  { khoa: "daThuatLai", giaTri: "1", ten: "Đã thuật lại" },
  { khoa: "duoi", giaTri: "10", ten: "Dưới 10 phút" },
  { khoa: "tu", giaTri: "20", ten: "Trên 20 phút" },
  { khoa: "ngay", giaTri: "3", ten: "3 ngày gần đây" },
];

export function ChipLoc({
  demTheoNhom,
}: {
  demTheoNhom: Record<string, number>;
}) {
  const duongDan = usePathname();
  const thamSo = useSearchParams();
  const dieuHuong = useRouter();
  const [dangChuyen, batDauChuyen] = useTransition();

  const nhomHienTai = thamSo.get("nhom") ?? "";
  const sapXepHienTai = thamSo.get("sap") ?? "phu_hop_nhat";

  function doiThamSo(khoa: string, giaTri: string | null) {
    const moi = new URLSearchParams(thamSo.toString());
    if (giaTri === null || giaTri === "") moi.delete(khoa);
    else moi.set(khoa, giaTri);
    // Đổi bộ lọc thì về trang đầu, chứ không giữ nguyên trang 5 của kết quả cũ
    moi.delete("trang");
    batDauChuyen(() => dieuHuong.push(`${duongDan}?${moi.toString()}`));
  }

  /**
   * Nút chuyên mục: TO BẰNG NHAU, chữ đậm, nổi lên khi rê chuột.
   *
   * Chủ dự án yêu cầu (2026-08-15) và có lý về mặt nhìn: bản trước mỗi nút một
   * bề ngang theo độ dài chữ, nên hàng nút trông so le, mắt phải đọc từng cái
   * mới biết có gì. Bằng nhau thì liếc một cái là nắm được cả hàng.
   *
   * `flex-1 basis-0` là chỗ làm nên chuyện: mọi nút chia đều bề ngang còn lại
   * bất kể chữ dài ngắn. `min-w-0` để chữ dài không phá vỡ phần chia đều.
   */
  const kieuChip =
    "min-w-0 flex-1 basis-0 rounded-xl px-3 py-2.5 text-sm font-semibold " +
    "transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0";

  // Nút đang chọn: nổi hẳn lên bằng bóng đổ màu cam. Dùng bóng chứ không dùng
  // viền — viền làm nút xê dịch 1px khi đổi trạng thái, nhìn giật.
  const kieuChon =
    "bg-cam-600 text-white shadow-lg shadow-cam-600/40 dark:bg-cam-500 dark:shadow-cam-500/30";
  const kieuThuong =
    "bg-neutral-100 text-neutral-700 hover:bg-neutral-200 hover:shadow-md " +
    "dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700";

  return (
    <div className={dangChuyen ? "opacity-60 transition-opacity" : undefined}>
      <div className="flex gap-2">
        {CAC_NHOM.map((nhom) => {
          const so = nhom.ma ? demTheoNhom[nhom.ma] : undefined;
          const dangO = nhomHienTai === nhom.ma;
          return (
            <button
              key={nhom.ma || "tat-ca"}
              type="button"
              onClick={() => doiThamSo("nhom", nhom.ma)}
              className={`${kieuChip} ${dangO ? kieuChon : kieuThuong}`}
            >
              <span className="truncate">{nhom.ten}</span>
              {so !== undefined ? (
                <span
                  className={`ml-1.5 tabular-nums ${
                    dangO ? "opacity-80" : "opacity-55"
                  }`}
                >
                  {so}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {LOC_NHANH.map((loc) => {
          const dangBat = thamSo.get(loc.khoa) === loc.giaTri;
          return (
            <button
              key={loc.khoa + loc.giaTri}
              type="button"
              onClick={() =>
                doiThamSo(loc.khoa, dangBat ? null : loc.giaTri)
              }
              className={`${kieuChip} ${dangBat ? kieuChon : kieuThuong}`}
            >
              {loc.ten}
            </button>
          );
        })}

        <select
          value={sapXepHienTai}
          onChange={(e) => doiThamSo("sap", e.target.value)}
          className="ml-auto rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-900"
        >
          {CACH_SAP_XEP.map((c) => (
            <option key={c.ma} value={c.ma}>
              {c.ten}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
