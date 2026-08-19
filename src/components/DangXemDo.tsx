"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * Hàng "đang xem dở" ở trang chủ — MỘT hàng ngang, tua trái phải được.
 *
 * ĐÂY LÀ CHỖ VIỆC GHI NHỚ VỊ TRÍ TRẢ CÔNG. Ghi được chỗ đang xem mà không bày
 * ra thì cũng như không: mở máy lên vẫn phải nhớ tên video rồi đi tìm lại.
 *
 * ## Vì sao một hàng chứ không phải lưới hai hàng
 *
 * Chủ dự án chốt 2026-08-19. Lưới 2 hàng × 3 cột chiếm gần hết màn hình đầu
 * tiên, đẩy các chuyên mục xuống dưới nếp gấp — mà "đang xem dở" là thứ để
 * liếc qua rồi đi tiếp, không phải thứ chính của trang chủ. Một hàng ngang kèm
 * nút tua giữ đủ sáu bài mà chỉ tốn một phần ba chiều cao.
 *
 * ## Ba cách tua, vì mỗi người quen một kiểu
 *
 * 1. **Hai nút mũi tên** — hiện ra khi còn chỗ để tua về phía đó
 * 2. **Kéo thả bằng chuột** — nhấn giữ rồi kéo ngang, kiểu vuốt trên điện thoại
 * 3. **Lăn chuột / vuốt** — trình duyệt tự lo, chỉ cần `overflow-x-auto`
 *
 * Khách không thấy gì cả — họ không có lịch sử, và cũng không được nhìn lịch
 * sử của chủ nhà.
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
  const dayRef = useRef<HTMLDivElement>(null);
  const [tuaTraiDuoc, setTuaTraiDuoc] = useState(false);
  const [tuaPhaiDuoc, setTuaPhaiDuoc] = useState(false);

  /**
   * Kéo ngang bằng chuột — nhớ điểm bắt đầu để tính quãng đã kéo.
   *
   * Để trong `ref` vì mấy con số này đổi liên tục theo từng pixel chuột chạy;
   * nếu là state thì mỗi lần nhúc nhích lại vẽ lại cả hàng thẻ.
   */
  const keo = useRef({ dangKeo: false, batDauX: 0, batDauCuon: 0, daDiChuyen: 0 });
  /** Riêng cờ này thì phải là state — nó quyết định lớp CSS lúc vẽ */
  const [dangKeoTay, setDangKeoTay] = useState(false);

  function xemConTuaDuoc() {
    const el = dayRef.current;
    if (!el) return;
    setTuaTraiDuoc(el.scrollLeft > 4);
    // Trừ hao 4px: chiều rộng tính ra số lẻ nên `scrollLeft` gần như không bao
    // giờ bằng đúng phần dư, mũi tên phải sẽ sáng mãi dù đã hết chỗ tua.
    setTuaPhaiDuoc(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }

  useEffect(() => {
    xemConTuaDuoc();
    const el = dayRef.current;
    if (!el) return;
    const xem = () => xemConTuaDuoc();
    el.addEventListener("scroll", xem, { passive: true });
    window.addEventListener("resize", xem);
    return () => {
      el.removeEventListener("scroll", xem);
      window.removeEventListener("resize", xem);
    };
  }, [cacMuc.length]);

  function tua(huong: -1 | 1) {
    const el = dayRef.current;
    if (!el) return;
    // Tua đúng một "màn" trừ đi một chút, để bài ở mép vẫn còn thấy một phần —
    // nhảy trọn một màn thì mất mạch, không biết vừa lướt qua cái gì.
    el.scrollBy({ left: huong * (el.clientWidth * 0.85), behavior: "smooth" });
  }

  if (cacMuc.length === 0) return null;

  const kieuNut =
    "absolute top-1/2 z-10 -translate-y-1/2 rounded-full border border-neutral-300 bg-background/95 p-1.5 shadow-lg backdrop-blur transition-opacity hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800";

  return (
    <section className="mt-8">
      <h2 className="mb-3 text-base font-semibold">Đang xem dở</h2>

      <div className="relative">
        {tuaTraiDuoc ? (
          <button
            type="button"
            onClick={() => tua(-1)}
            aria-label="Tua sang trái"
            className={`${kieuNut} -left-3`}
          >
            <ChevronLeft size={20} />
          </button>
        ) : null}

        <div
          ref={dayRef}
          // `scroll-smooth` chỉ dành cho nút mũi tên; lúc kéo tay phải tắt đi,
          // không thì thẻ chạy đuổi theo con trỏ một cách trễ nải
          className={`flex gap-4 overflow-x-auto pb-1 ${
            dangKeoTay ? "cursor-grabbing select-none" : "scroll-smooth"
          }`}
          // Ẩn thanh cuộn: đã có hai nút mũi tên làm dấu hiệu rồi, thêm thanh
          // cuộn xám vắt ngang dưới hàng thẻ chỉ làm bẩn trang chủ
          style={{ scrollbarWidth: "none" }}
          onPointerDown={(e) => {
            const el = dayRef.current;
            if (!el || e.pointerType !== "mouse") return;
            keo.current = {
              dangKeo: true,
              batDauX: e.clientX,
              batDauCuon: el.scrollLeft,
              daDiChuyen: 0,
            };
            setDangKeoTay(true);
          }}
          onPointerMove={(e) => {
            const el = dayRef.current;
            if (!el || !keo.current.dangKeo) return;
            const lech = e.clientX - keo.current.batDauX;
            keo.current.daDiChuyen = Math.abs(lech);
            el.scrollLeft = keo.current.batDauCuon - lech;
          }}
          onPointerUp={() => {
            keo.current.dangKeo = false;
            setDangKeoTay(false);
          }}
          onPointerLeave={() => {
            keo.current.dangKeo = false;
            setDangKeoTay(false);
          }}
          // Kéo xong mà không chặn thì cú thả cũng tính là một cú bấm, và trang
          // nhảy sang video ở chỗ vừa buông tay
          onClickCapture={(e) => {
            if (keo.current.daDiChuyen > 5) {
              e.preventDefault();
              e.stopPropagation();
              keo.current.daDiChuyen = 0;
            }
          }}
        >
          {cacMuc.map((muc) => (
            <Link
              key={muc.id}
              href={`/xem/${muc.id}`}
              draggable={false}
              className="group w-64 shrink-0 overflow-hidden rounded-xl border border-neutral-200 transition-colors hover:border-neutral-400 sm:w-72 dark:border-neutral-800 dark:hover:border-neutral-600"
            >
              <div className="relative aspect-video overflow-hidden bg-neutral-100 dark:bg-neutral-800">
                {muc.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={muc.thumbnailUrl}
                    alt=""
                    draggable={false}
                    className="absolute inset-0 size-full object-cover"
                  />
                ) : null}
                {/* Thanh tiến độ, đúng chỗ dưới đáy ảnh mà mắt đã quen tìm.
                    Dùng màu cam của ứng dụng thay vì đỏ như YouTube — đỏ ở đây
                    chỉ dành cho việc đang thu âm. */}
                <div className="absolute inset-x-0 bottom-0 h-1 bg-neutral-900/25">
                  <div
                    className="h-full bg-cam-500"
                    style={{ width: `${muc.phanTram}%` }}
                  />
                </div>
              </div>
              <div className="p-3">
                <h3 className="line-clamp-2 text-sm font-medium leading-snug">
                  {muc.title}
                </h3>
                <p className="mt-1 line-clamp-1 text-xs text-neutral-500 dark:text-neutral-400">
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

        {tuaPhaiDuoc ? (
          <button
            type="button"
            onClick={() => tua(1)}
            aria-label="Tua sang phải"
            className={`${kieuNut} -right-3`}
          >
            <ChevronRight size={20} />
          </button>
        ) : null}
      </div>
    </section>
  );
}
