"use client";

/**
 * Menu ba chấm trên mỗi thẻ nội dung.
 *
 * Chốt 2026-08-17: hai lựa chọn — **Thêm vào thư viện** (làm ngay, không đụng
 * YouTube) và **Thêm vào Playlist** (bung ra danh sách thư mục + "+ Playlist
 * mới", giống hộp "Lưu vào…" của chính YouTube). Chọn một thư mục ở đây thêm
 * NGAY trên Am — chỉ phần ghi thật lên YouTube mới cần duyệt sau, xem
 * `thanhVien.ts`.
 *
 * BÊN TRONG TRANG CHI TIẾT MỘT PLAYLIST (`trongPlaylistId`), menu đổi khác:
 * thêm hai lựa chọn "Xoá khỏi playlist" (bỏ thẳng, không cần bung danh sách)
 * và "Chuyển đến playlist" (bung danh sách CÁC PLAYLIST KHÁC + "+ Playlist
 * mới" — chọn một cái là chuyển hẳn, không phải thêm-thêm).
 *
 * Vẽ bằng cổng ra `document.body`, cùng lý do với `NutXo` ở `ChipLoc.tsx`: thẻ
 * nội dung nằm trong lưới, menu đặt bên trong dễ bị cắt bởi `overflow` của
 * lưới cha.
 */

import { MoreVertical } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";

import { batTatLuu } from "@/lib/thuVien/actions";
import {
  chuyenDenThuMuc,
  layDuLieuMenuBaCham,
  taoThuMuc,
  themVaoThuMuc,
  xoaKhoiThuMuc,
} from "@/lib/playlist/actions";

/** Bề ngang menu, khai một chỗ vì cả `w-64` lẫn phép tính lề đều cần con số này. */
const RONG = 256;

/**
 * Đặt menu vào chỗ còn thấy được, và cao tối đa bằng đúng khoảng trống ấy.
 *
 * VÌ SAO PHẢI TỰ TÍNH: danh sách playlist dài tới 26 dòng, cao hơn 500px. Bản
 * trước luôn mở XUỐNG DƯỚI nút, mà từ lúc nút ba chấm dời từ góc trên ảnh
 * xuống giữa-dưới ảnh thì mốc neo tụt thêm cả trăm pixel nữa — menu đổ hẳn ra
 * ngoài đáy màn hình. Bấm vào thấy y như không có gì hiện ra, dù nó có hiện.
 */
function viTriMenu(o: DOMRect): React.CSSProperties {
  const choDuoi = window.innerHeight - o.bottom - 12;
  const choTren = o.top - 12;
  const trai = Math.max(12, Math.min(o.right - RONG, window.innerWidth - RONG - 12));

  // Mở lên trên khi phía trên rộng rãi hơn, thay vì cố nhét xuống dưới
  return choTren > choDuoi
    ? { bottom: window.innerHeight - o.top + 6, left: trai, maxHeight: choTren }
    : { top: o.bottom + 6, left: trai, maxHeight: choDuoi };
}

export function MenuBaCham({
  contentItemId,
  trongPlaylistId,
  luonHien,
  nhanPlaylist,
}: {
  contentItemId: string;
  /** Có giá trị khi thẻ này đang hiện trong trang chi tiết một playlist */
  trongPlaylistId?: string;
  /**
   * Dùng cho danh sách dạng DÒNG (Thư viện, Lịch sử) thay vì thẻ ảnh.
   * Không có ảnh để bấm-lộ-ra lúc di chuột, và trên điện thoại thì làm gì có
   * chuột — nên hiện thẳng luôn, kiểu nút phẳng như các nút khác trong dòng.
   */
  luonHien?: boolean;
  /**
   * Tên playlist đã biết trước (server đã nạp sẵn) — hiện thẳng tên này thay
   * cho ba chấm, để liếc qua là biết bài đã nằm trong playlist nào, không
   * phải bấm mở menu ra mới thấy. `undefined`/rỗng thì hiện ba chấm như cũ.
   */
  nhanPlaylist?: string | null;
}) {
  const [mo, datMo] = useState(false);
  const [mucPlaylist, setMucPlaylist] = useState(false);
  const [oNut, datONut] = useState<DOMRect | null>(null);
  const [thongDiep, setThongDiep] = useState<string | null>(null);
  const [tenMoi, setTenMoi] = useState("");
  const [cacPlaylist, setCacPlaylist] = useState<{ id: string; ten: string }[]>([]);
  const [dangTrongThuVien, setDangTrongThuVien] = useState(false);
  const [dangNap, setDangNap] = useState(false);
  const nutRef = useRef<HTMLButtonElement>(null);
  const [dangChay, batDau] = useTransition();

  useEffect(() => {
    if (!mo) return;
    const dong = () => {
      datMo(false);
      setMucPlaylist(false);
    };
    window.addEventListener("scroll", dong, true);
    window.addEventListener("resize", dong);
    return () => {
      window.removeEventListener("scroll", dong, true);
      window.removeEventListener("resize", dong);
    };
  }, [mo]);

  /**
   * Nạp danh sách playlist — gọi ngay lúc bấm mở, KHÔNG qua `useEffect`.
   *
   * Đặt trong effect thì React phải dựng hình một lần chỉ để rồi bật cờ "đang
   * tải" lên và dựng lại — đúng thứ quy tắc `set-state-in-effect` cảnh báo.
   * Việc này vốn do một cú bấm gây ra, nên cứ để cú bấm gọi thẳng.
   *
   * Chỉ nạp lúc mở, không nạp sẵn cho mọi thẻ trên trang.
   */
  function napDuLieu() {
    setDangNap(true);
    layDuLieuMenuBaCham(contentItemId)
      .then((d) => {
        setCacPlaylist(d.cacPlaylist);
        setDangTrongThuVien(d.dangTrongThuVien);
      })
      .finally(() => setDangNap(false));
  }

  function dong() {
    datMo(false);
    setMucPlaylist(false);
    setThongDiep(null);
    setTenMoi("");
  }

  /**
   * Xong một việc: báo kết quả, và CHỈ tự đóng khi thành công.
   *
   * Thất bại mà vẫn tự đóng thì thông điệp lỗi biến mất trước khi đọc kịp —
   * người dùng chỉ thấy menu đóng lại, không thấy gì đổi, và kết luận là nút
   * hỏng. Đúng chuyện đã xảy ra 2026-08-18.
   */
  function xong(kq: { ok: boolean; thongDiep: string }) {
    setThongDiep(kq.thongDiep);
    if (kq.ok) setTimeout(dong, 700);
  }

  return (
    <>
      <button
        ref={nutRef}
        type="button"
        // Thẻ cha là <Link> — chặn để bấm ba chấm không điều hướng sang trang xem
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setTimeout(() => datONut(nutRef.current?.getBoundingClientRect() ?? null));
          if (mo) {
            // Đóng bằng chính nút này cũng phải dọn sạch như đóng bằng cách
            // bấm ra ngoài. Bản trước chỉ tắt cờ `mo`, để lại `mucPlaylist`
            // đang bật — mở lần sau là rơi thẳng vào danh sách playlist, không
            // thấy "Thêm vào thư viện" đâu nữa.
            dong();
          } else {
            napDuLieu();
            datMo(true);
          }
        }}
        aria-label={nhanPlaylist ? `Đã lưu vào ${nhanPlaylist}` : "Thêm vào"}
        className={
          luonHien
            ? "flex shrink-0 items-center gap-1 rounded-md border border-neutral-300 px-1.5 py-1 text-neutral-500 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
            : "absolute bottom-1.5 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-full bg-white px-2 py-1 text-neutral-900 shadow-sm hover:bg-neutral-100"
        }
      >
        {nhanPlaylist ? (
          <span className="max-w-28 truncate text-[11px] font-medium">
            {nhanPlaylist}
          </span>
        ) : (
          <MoreVertical size={luonHien ? 16 : 14} />
        )}
      </button>

      {mo && oNut
        ? createPortal(
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={(e) => {
                  e.preventDefault();
                  dong();
                }}
                aria-hidden
              />
              <div
                onClick={(e) => e.preventDefault()}
                className="fixed z-50 w-64 overflow-y-auto rounded-xl border border-neutral-300 bg-background p-1.5 shadow-2xl dark:border-neutral-700"
                style={viTriMenu(oNut)}
              >
                {dangNap ? (
                  <p className="px-3 py-2 text-sm text-neutral-400">Đang tải…</p>
                ) : !mucPlaylist ? (
                  <>
                    <button
                      type="button"
                      disabled={dangChay}
                      onClick={() =>
                        batDau(async () => {
                          xong(await batTatLuu(contentItemId));
                        })
                      }
                      className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-neutral-100 disabled:opacity-40 dark:hover:bg-neutral-800"
                    >
                      {dangTrongThuVien ? "Bỏ khỏi thư viện" : "Thêm vào thư viện"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setMucPlaylist(true)}
                      className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    >
                      {trongPlaylistId ? "Chuyển đến playlist" : "Thêm vào Playlist"}
                    </button>
                    {trongPlaylistId ? (
                      <button
                        type="button"
                        disabled={dangChay}
                        onClick={() =>
                          batDau(async () => {
                            xong(await xoaKhoiThuMuc(contentItemId, trongPlaylistId));
                          })
                        }
                        className="w-full rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 disabled:opacity-40 dark:text-red-400 dark:hover:bg-red-950/40"
                      >
                        Xoá khỏi playlist
                      </button>
                    ) : null}
                  </>
                ) : (
                  <>
                    <p className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                      {trongPlaylistId ? "Chuyển đến…" : "Lưu vào…"}
                    </p>
                    {cacPlaylist
                      .filter((p) => p.id !== trongPlaylistId)
                      .map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        disabled={dangChay}
                        onClick={() =>
                          batDau(async () => {
                            xong(
                              trongPlaylistId
                                ? await chuyenDenThuMuc(contentItemId, trongPlaylistId, p.id)
                                : await themVaoThuMuc(contentItemId, p.id),
                            );
                          })
                        }
                        className="w-full truncate rounded-lg px-3 py-2 text-left text-sm hover:bg-neutral-100 disabled:opacity-40 dark:hover:bg-neutral-800"
                      >
                        {p.ten}
                      </button>
                    ))}
                    <form
                      className="mt-1 flex gap-1 border-t border-neutral-200 pt-2 dark:border-neutral-800"
                      onClick={(e) => e.preventDefault()}
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (!tenMoi.trim()) return;
                        batDau(async () => {
                          const moi = await taoThuMuc(tenMoi);
                          if (!moi.ok || !moi.id) {
                            xong(moi);
                            return;
                          }
                          xong(
                            trongPlaylistId
                              ? await chuyenDenThuMuc(contentItemId, trongPlaylistId, moi.id)
                              : await themVaoThuMuc(contentItemId, moi.id),
                          );
                        });
                      }}
                    >
                      {/* KHÔNG dùng `autoFocus`. Ô này nằm CUỐI danh sách 26
                          playlist; tự lấy tiêu điểm là trình duyệt cuộn hộp
                          xuống đáy để lộ nó ra — đo được 577/978 pixel — nên
                          mở menu ra chỉ thấy mỗi ô nhập, toàn bộ tên playlist
                          bị đẩy khuất lên trên. Trông y như "danh sách không
                          hiện ra", đúng lỗi chủ dự án báo 2026-08-18.

                          Mà tiêu điểm ở đây vốn cũng sai chỗ: mở menu này là
                          để CHỌN một playlist có sẵn, tạo mới chỉ là lối thoát
                          hiếm khi dùng. */}
                      <input
                        value={tenMoi}
                        onChange={(e) => setTenMoi(e.target.value)}
                        placeholder="+ Playlist mới"
                        className="min-w-0 flex-1 rounded-md border border-neutral-300 px-2 py-1 text-xs outline-none focus:border-cam-500 dark:border-neutral-700 dark:bg-neutral-900"
                      />
                      <button
                        type="submit"
                        disabled={dangChay || !tenMoi.trim()}
                        className="shrink-0 rounded-md bg-cam-600 px-2 py-1 text-xs font-medium text-white disabled:opacity-40 dark:bg-cam-500"
                      >
                        Tạo
                      </button>
                    </form>
                  </>
                )}

                {thongDiep ? (
                  <p className="mt-1 px-3 py-1 text-xs text-neutral-500">{thongDiep}</p>
                ) : null}
              </div>
            </>,
            document.body,
          )
        : null}
    </>
  );
}
