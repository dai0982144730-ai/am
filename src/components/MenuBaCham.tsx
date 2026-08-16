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
 * Vẽ bằng cổng ra `document.body`, cùng lý do với `NutXo` ở `ChipLoc.tsx`: thẻ
 * nội dung nằm trong lưới, menu đặt bên trong dễ bị cắt bởi `overflow` của
 * lưới cha.
 */

import { MoreVertical } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";

import { batTatLuu } from "@/lib/thuVien/actions";
import {
  layDuLieuMenuBaCham,
  taoThuMuc,
  themVaoThuMuc,
} from "@/lib/playlist/actions";

export function MenuBaCham({ contentItemId }: { contentItemId: string }) {
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

  // Nạp một lần lúc mở menu — không nạp sẵn cho mọi thẻ trên trang
  useEffect(() => {
    if (!mo) return;
    setDangNap(true);
    layDuLieuMenuBaCham(contentItemId)
      .then((d) => {
        setCacPlaylist(d.cacPlaylist);
        setDangTrongThuVien(d.dangTrongThuVien);
      })
      .finally(() => setDangNap(false));
  }, [mo, contentItemId]);

  function dong() {
    datMo(false);
    setMucPlaylist(false);
    setThongDiep(null);
    setTenMoi("");
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
          datMo((cu) => !cu);
        }}
        aria-label="Thêm vào"
        className="absolute right-1.5 top-1.5 z-10 rounded-full bg-black/60 p-1 text-white opacity-0 backdrop-blur transition-opacity group-hover:opacity-100 hover:bg-black/80 focus:opacity-100"
      >
        <MoreVertical size={16} />
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
                className="fixed z-50 max-h-[70vh] w-64 overflow-y-auto rounded-xl border border-neutral-300 bg-background p-1.5 shadow-2xl dark:border-neutral-700"
                style={{
                  top: oNut.bottom + 6,
                  left: Math.max(12, Math.min(oNut.right - 256, window.innerWidth - 268)),
                }}
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
                          const kq = await batTatLuu(contentItemId);
                          setThongDiep(kq.thongDiep);
                          setTimeout(dong, 700);
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
                      Thêm vào Playlist
                    </button>
                  </>
                ) : (
                  <>
                    <p className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                      Lưu vào…
                    </p>
                    {cacPlaylist.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        disabled={dangChay}
                        onClick={() =>
                          batDau(async () => {
                            const kq = await themVaoThuMuc(contentItemId, p.id);
                            setThongDiep(kq.thongDiep);
                            setTimeout(dong, 700);
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
                          if (moi.ok && moi.id) {
                            const kq = await themVaoThuMuc(contentItemId, moi.id);
                            setThongDiep(kq.thongDiep);
                          } else {
                            setThongDiep(moi.thongDiep);
                          }
                          setTimeout(dong, 700);
                        });
                      }}
                    >
                      <input
                        autoFocus
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
