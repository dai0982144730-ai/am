/**
 * Ô "Giọng đọc" trong Cài đặt — nói thật về hạn mức và trạng thái.
 *
 * Trả lời đúng nỗi lo của chủ dự án: *"liệu có lúc nào nó lặng lẽ ngừng chạy
 * hoặc lặng lẽ tính tiền không?"*
 *
 * KHÔNG BAO GIỜ HIỆN KHOÁ. Chỉ báo có hay chưa. Khoá nằm trong `.env` và ở
 * nguyên đó — đưa lên màn hình là nó lọt vào ảnh chụp màn hình, vào bản sao
 * lưu, vào mọi chỗ không nên có.
 */

import { ChonGiongDoc } from "@/components/ChonGiongDoc";
import { CAC_GIONG } from "@/lib/tts/giong";
import {
  NGUONG_CANH_BAO,
  NGUONG_KHOA,
  type TinhHinhTts,
} from "@/lib/tts/hanMuc";

function docSo(n: number): string {
  return n.toLocaleString("vi-VN");
}

/** Ước lượng số giờ nghe. Tiếng Việt đọc khoảng 45.000 ký tự một giờ. */
const KY_TU_MOI_GIO = 45_000;

export function TinhHinhGiongDoc({
  tinhHinh,
  daCoKhoa,
  giongDangChon,
  tocDoDangDung,
  laChu,
}: {
  tinhHinh: TinhHinhTts;
  daCoKhoa: boolean;
  giongDangChon: string;
  tocDoDangDung: number;
  laChu: boolean;
}) {
  const phanTram = Math.min(100, Math.round(tinhHinh.phanTram * 100));
  const soGio = tinhHinh.conLai / KY_TU_MOI_GIO;

  const mauThanh = tinhHinh.daKhoa
    ? "bg-red-500"
    : tinhHinh.sapHet
      ? "bg-amber-500"
      : "bg-cam-500";

  return (
    // Khong dat margin o day: trang Cai dat xep cac khoi thanh luoi 2 cot,
    // khoang cach do `gap` cua luoi lo. Co margin rieng thi hai cot lech nhau.
    <section>
      <h2 className="text-base font-semibold">Giọng đọc</h2>
      <p className="mt-1 text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
        Am đưa chữ tiếng Việt cho Google đọc thành tiếng. Google cho{" "}
        <strong>{docSo(tinhHinh.tran)} ký tự miễn phí mỗi tháng</strong>, cấp
        lại đầu tháng — đây là mức vĩnh viễn, không phải bản dùng thử.
      </p>

      {!daCoKhoa ? (
        <div className="mt-3 rounded-xl border border-dashed border-neutral-300 p-4 dark:border-neutral-700">
          <p className="text-sm text-neutral-600 dark:text-neutral-300">
            Chưa cấu hình giọng đọc.
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
            Bật <strong>Cloud Text-to-Speech API</strong> trong Google Cloud,
            tạo khoá, rồi thêm dòng <code>TTS_API_KEY=…</code> vào file{" "}
            <code>.env</code>. Khoá để trong đó chứ không nhập trên web — như
            vậy nó không lọt vào ảnh chụp màn hình hay bản sao lưu database.
          </p>
        </div>
      ) : (
        <div className="mt-3 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-sm font-medium">
              Tháng {tinhHinh.thang}
            </span>
            <span className="text-sm tabular-nums text-neutral-600 dark:text-neutral-300">
              <strong
                className={
                  tinhHinh.daKhoa
                    ? "text-red-600 dark:text-red-400"
                    : tinhHinh.sapHet
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-cam-600 dark:text-cam-500"
                }
              >
                {phanTram}%
              </strong>{" "}
              · {docSo(tinhHinh.daDung)}/{docSo(tinhHinh.tran)} ký tự
            </span>
          </div>

          <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
            <div
              className={`h-full transition-all ${mauThanh}`}
              style={{ width: `${phanTram}%` }}
            />
          </div>

          <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
            Còn {docSo(tinhHinh.conLai)} ký tự, tương đương khoảng{" "}
            <strong>{soGio.toFixed(0)} giờ nghe</strong>.
          </p>

          {tinhHinh.daKhoa ? (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs leading-relaxed text-red-700 dark:bg-red-950/40 dark:text-red-300">
              <strong>Đã tự khoá.</strong> Am ngừng gọi dịch vụ đọc thành tiếng
              cho tới đầu tháng sau, để không phát sinh tiền vào thẻ. Nội dung
              vẫn quét và phân loại bình thường, chỉ thiếu phần giọng đọc.
            </p>
          ) : tinhHinh.sapHet ? (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              <strong>Sắp hết.</strong> Qua{" "}
              {Math.round(NGUONG_KHOA * 100)}% là Am tự dừng cho tới tháng sau.
            </p>
          ) : null}

          {tinhHinh.loiGanNhat ? (
            <p className="mt-3 rounded-lg bg-neutral-100 px-3 py-2 text-xs leading-relaxed text-neutral-600 dark:bg-neutral-900 dark:text-neutral-300">
              Lần gọi gần nhất hỏng: {tinhHinh.loiGanNhat}
            </p>
          ) : null}
        </div>
      )}

      <ChonGiongDoc
        cacGiong={CAC_GIONG}
        dangChon={giongDangChon}
        tocDoDangDung={tocDoDangDung}
        laChu={laChu}
      />

      <p className="mt-4 text-xs leading-relaxed text-neutral-400 dark:text-neutral-500">
        Cảnh báo ở {Math.round(NGUONG_CANH_BAO * 100)}%, tự khoá ở{" "}
        {Math.round(NGUONG_KHOA * 100)}%. Chừa 10% cuối làm vùng đệm vì cách đếm
        của Am và cách đếm của Google không khớp tuyệt đối — Google tính cả phần
        đánh dấu và báo trễ vài giờ.
      </p>
    </section>
  );
}
