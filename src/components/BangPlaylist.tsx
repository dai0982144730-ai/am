"use client";

/**
 * Bảng duyệt đề xuất playlist.
 *
 * ĐIỀU QUAN TRỌNG NHẤT VỀ GIAO DIỆN NÀY: **duyệt và ghi là hai nút khác nhau.**
 * Bấm "Duyệt" chỉ ghi lại ý định; phải bấm thêm "Ghi lên YouTube" mới thật sự
 * đổi tài khoản ngoài đời. Gộp lại một nút thì một cú bấm nhầm là xong chuyện —
 * mà đây là thứ duy nhất trong cả web này chạm được ra thế giới thật.
 *
 * Nút ghi cũng cố ý viết rõ là "lên YouTube", không viết "áp dụng" hay "OK".
 * Chữ trên nút phải nói đúng thứ nó làm.
 *
 * XOÁ THƯ MỤC LÀ VIỆC NGUY HIỂM NHẤT (từ 2026-08-17) — vẫn qua đúng ba bước
 * trên, nhưng đề xuất loại `delete_playlist` được tô đỏ riêng, không lẫn vào
 * hàng thêm/bớt video bình thường.
 */

import { MoreVertical } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";

import {
  dongBoLai,
  doiTenThuMuc,
  duyet,
  ghiLenYouTube,
  huyXoaThuMuc,
  batTatChoSapXep,
  taoThuMuc,
  tuChoi,
  xoaThuMuc,
} from "@/lib/playlist/actions";

export interface PlaylistGon {
  id: string;
  ten: string;
  soMuc: number;
  choSapXep: boolean;
  /** false = mới có trên Am, chưa từng ghi thật lên YouTube */
  daCoThat: boolean;
  /** Ảnh của video đầu danh sách, làm ảnh bìa — null nếu playlist rỗng */
  anhBia: string | null;
}

export interface ThuMucChoXoaGon {
  id: string;
  title: string;
}

export interface DeXuatGon {
  id: string;
  loai: string;
  /** Câu mô tả đã soạn sẵn ở máy chủ, ví dụ 'Thêm vào "0 AI"' */
  moTaViec: string;
  idNoiDung: string | null;
  tieuDeVideo: string | null;
  lyDo: string;
  trangThai: string;
  nguyHiem: boolean;
}

/**
 * Đặt menu vào chỗ còn thấy được — mở lên trên khi phía dưới hết chỗ. Cùng
 * cách tính với `MenuBaCham`, xem giải thích dài ở đó.
 */
function viTriMenu(o: DOMRect, rong: number): React.CSSProperties {
  const choDuoi = window.innerHeight - o.bottom - 12;
  const choTren = o.top - 12;
  const trai = Math.max(12, Math.min(o.right - rong, window.innerWidth - rong - 12));

  return choTren > choDuoi
    ? { bottom: window.innerHeight - o.top + 6, left: trai, maxHeight: choTren }
    : { top: o.bottom + 6, left: trai, maxHeight: choDuoi };
}

function MotPlaylist({
  muc,
  laChu,
}: {
  muc: PlaylistGon;
  laChu: boolean;
}) {
  const [choSapXep, setChoSapXep] = useState(muc.choSapXep);
  const [dangSuaTen, setDangSuaTen] = useState(false);
  const [ten, setTen] = useState(muc.ten);
  const [thongDiep, setThongDiep] = useState<string | null>(null);
  const [dangChay, batDau] = useTransition();

  // Menu ba chấm: Đổi tên / Xoá — gộp lại thay vì bày chữ "Xoá" trần cạnh
  // tên, giống cách YouTube gói hai việc này vào một nút trên mỗi thẻ.
  const [moMenu, setMoMenu] = useState(false);
  const [oNut, setONut] = useState<DOMRect | null>(null);
  const nutRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!moMenu) return;
    const dong = () => setMoMenu(false);
    window.addEventListener("scroll", dong, true);
    window.addEventListener("resize", dong);
    return () => {
      window.removeEventListener("scroll", dong, true);
      window.removeEventListener("resize", dong);
    };
  }, [moMenu]);

  return (
    <li className="flex flex-col overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800">
      <Link
        href={`/playlist/${muc.id}`}
        className="relative block aspect-video bg-neutral-100 dark:bg-neutral-800"
      >
        {muc.anhBia ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={muc.anhBia} alt="" className="size-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center text-xs text-neutral-400">
            Chưa có ảnh
          </div>
        )}
        <span className="absolute bottom-1.5 right-1.5 rounded-md bg-black/80 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-white">
          {muc.soMuc} mục
        </span>
      </Link>

      <div className="flex flex-1 flex-col p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            {dangSuaTen ? (
              <input
                autoFocus
                value={ten}
                onChange={(e) => setTen(e.target.value)}
                onBlur={() => {
                  setDangSuaTen(false);
                  if (ten.trim() && ten.trim() !== muc.ten) {
                    batDau(async () => {
                      const kq = await doiTenThuMuc(muc.id, ten);
                      setThongDiep(kq.thongDiep);
                    });
                  }
                }}
                onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                className="w-full rounded-md border border-cam-500 bg-transparent px-1.5 py-0.5 text-sm outline-none"
              />
            ) : (
              <p className="truncate text-sm font-medium">
                {muc.ten}
                {!muc.daCoThat ? (
                  <span className="ml-1.5 rounded bg-neutral-100 px-1 py-0.5 text-[10px] font-normal text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
                    chưa có trên YouTube
                  </span>
                ) : null}
              </p>
            )}
            {thongDiep ? (
              <p className="mt-0.5 truncate text-xs text-neutral-400">{thongDiep}</p>
            ) : null}
          </div>

          {laChu ? (
            <>
              <button
                ref={nutRef}
                type="button"
                aria-label="Tuỳ chọn playlist"
                onClick={() => {
                  setONut(nutRef.current?.getBoundingClientRect() ?? null);
                  setMoMenu((m) => !m);
                }}
                className="shrink-0 rounded-md border border-neutral-300 p-1 text-neutral-500 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
              >
                <MoreVertical size={16} />
              </button>

              {moMenu && oNut
                ? createPortal(
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setMoMenu(false)}
                        aria-hidden
                      />
                      <div
                        className="fixed z-50 w-40 overflow-y-auto rounded-xl border border-neutral-300 bg-background p-1.5 shadow-2xl dark:border-neutral-700"
                        style={viTriMenu(oNut, 160)}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setDangSuaTen(true);
                            setMoMenu(false);
                          }}
                          className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
                        >
                          Đổi tên
                        </button>
                        <button
                          type="button"
                          disabled={dangChay}
                          title="Yêu cầu xoá — chưa xoá gì thật, chỉ ẩn đi và tạo đề xuất chờ bạn duyệt"
                          onClick={() => {
                            setMoMenu(false);
                            batDau(async () => {
                              const kq = await xoaThuMuc(muc.id);
                              setThongDiep(kq.thongDiep);
                            });
                          }}
                          className="w-full rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 disabled:opacity-40 dark:text-red-400 dark:hover:bg-red-950/40"
                        >
                          Xoá
                        </button>
                      </div>
                    </>,
                    document.body,
                  )
                : null}
            </>
          ) : null}
        </div>

        {laChu ? (
          <button
            type="button"
            disabled={dangChay}
            title={
              choSapXep
                ? "Trợ lý được phép đề xuất thêm video vào playlist này. Bấm để tắt."
                : "Trợ lý bỏ qua playlist này. Bấm để cho phép đề xuất."
            }
            onClick={() => {
              const moi = !choSapXep;
              setChoSapXep(moi);
              batDau(async () => {
                const kq = await batTatChoSapXep(muc.id, moi);
                if (!kq.ok) setChoSapXep(!moi);
                setThongDiep(kq.thongDiep);
              });
            }}
            className={`mt-2 self-start rounded-full border px-2.5 py-1 text-[11px] transition-colors disabled:opacity-40 ${
              choSapXep
                ? "border-cam-600 bg-cam-600 text-white dark:border-cam-500 dark:bg-cam-500"
                : "border-neutral-300 text-neutral-500 dark:border-neutral-700"
            }`}
          >
            {choSapXep ? "Trợ lý được gợi ý thêm bài" : "Trợ lý không đụng tới"}
          </button>
        ) : null}
      </div>
    </li>
  );
}

function KhoiTaoThuMuc({ laChu }: { laChu: boolean }) {
  const [ten, setTen] = useState("");
  const [thongDiep, setThongDiep] = useState<string | null>(null);
  const [dangChay, batDau] = useTransition();

  if (!laChu) return null;

  return (
    <form
      className="mt-3 flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!ten.trim()) return;
        batDau(async () => {
          const kq = await taoThuMuc(ten);
          setThongDiep(kq.thongDiep);
          if (kq.ok) setTen("");
        });
      }}
    >
      <input
        value={ten}
        onChange={(e) => setTen(e.target.value)}
        placeholder="Tên thư mục mới"
        className="flex-1 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm outline-none focus:border-cam-500 dark:border-neutral-700 dark:bg-neutral-900"
      />
      <button
        type="submit"
        disabled={dangChay || !ten.trim()}
        className="shrink-0 rounded-lg bg-cam-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40 dark:bg-cam-500"
      >
        + Tạo thư mục
      </button>
      {thongDiep ? (
        <span className="self-center text-xs text-neutral-500">{thongDiep}</span>
      ) : null}
    </form>
  );
}

function MotThuMucChoXoa({ muc }: { muc: ThuMucChoXoaGon }) {
  const [thongDiep, setThongDiep] = useState<string | null>(null);
  const [dangChay, batDau] = useTransition();

  return (
    <li className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 dark:border-red-900 dark:bg-red-950/30">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{muc.title}</p>
        <p className="text-xs text-red-600 dark:text-red-400">
          Đang chờ duyệt đề xuất xoá.
          {thongDiep ? ` ${thongDiep}` : ""}
        </p>
      </div>
      <button
        type="button"
        disabled={dangChay}
        onClick={() =>
          batDau(async () => {
            const kq = await huyXoaThuMuc(muc.id);
            setThongDiep(kq.thongDiep);
          })
        }
        className="shrink-0 rounded-lg border border-neutral-300 px-3 py-1.5 text-xs disabled:opacity-40 dark:border-neutral-700"
      >
        Huỷ xoá
      </button>
    </li>
  );
}

export function BangPlaylist({
  cacPlaylist,
  cacThuMucChoXoa,
  cacDeXuat,
  laChu,
  coQuyenGhi,
}: {
  cacPlaylist: PlaylistGon[];
  cacThuMucChoXoa: ThuMucChoXoaGon[];
  cacDeXuat: DeXuatGon[];
  laChu: boolean;
  coQuyenGhi: boolean;
}) {
  const [thongDiep, setThongDiep] = useState<string | null>(null);
  const [dangChay, batDau] = useTransition();

  function chay(viec: () => Promise<{ ok: boolean; thongDiep: string }>) {
    batDau(async () => {
      const kq = await viec();
      setThongDiep(kq.thongDiep);
    });
  }

  const choDuyet = cacDeXuat.filter((d) => d.trangThai === "pending");
  const daDuyet = cacDeXuat.filter((d) => d.trangThai === "approved");
  const daGhi = cacDeXuat.filter((d) => d.trangThai === "applied");

  return (
    <div>
      {/* Cảnh báo thiếu quyền — nói trước khi người dùng bấm rồi mới gặp lỗi */}
      {laChu && !coQuyenGhi ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/40">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
            Tài khoản mới chỉ cấp quyền <strong>đọc</strong> YouTube.
          </p>
          <p className="mt-1.5 text-xs text-amber-700 dark:text-amber-400">
            Vẫn xem được playlist và đọc đề xuất, nhưng bấm &ldquo;Ghi lên
            YouTube&rdquo; sẽ báo lỗi. Ứng dụng <strong>đã xin</strong> quyền
            sửa playlist rồi, còn thiếu hai bước bạn phải tự làm:
          </p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-amber-700 dark:text-amber-400">
            <li>
              Vào <code>console.cloud.google.com</code> → APIs &amp; Services →
              OAuth consent screen → Data Access → Add or Remove Scopes, lọc
              theo <code>youtube</code> và tick dòng{" "}
              <code>.../auth/youtube</code> (dòng không có đuôi{" "}
              <code>.readonly</code>), rồi Update và Save.
            </li>
            <li>Đăng xuất khỏi Am rồi đăng nhập lại.</li>
          </ol>
          <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
            Google chỉ cấp những quyền đã khai sẵn ở màn hình đó — thiếu bước 1
            thì đăng nhập lại bao nhiêu lần cũng không có quyền.
          </p>
        </div>
      ) : null}

      {thongDiep ? (
        <p className="mt-3 rounded-lg bg-neutral-100 px-3 py-2 text-sm dark:bg-neutral-900">
          {thongDiep}
        </p>
      ) : null}

      {/* Trang này làm gì — chủ dự án hỏi thẳng, nên trả lời ngay tại chỗ */}
      <div className="mt-5 grid gap-4 rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-xs leading-relaxed sm:grid-cols-3 dark:border-neutral-800 dark:bg-neutral-900">
        <div>
          <p className="font-semibold text-neutral-700 dark:text-neutral-200">
            1 · Sửa trên Am ngay
          </p>
          <p className="mt-1 text-neutral-600 dark:text-neutral-300">
            Thêm/bớt/đổi tên/xoá thư mục — bạn hoặc trợ lý làm ngay trên Am,
            không cần duyệt. Đây chỉ là ý định, chưa đụng gì tới YouTube.
          </p>
        </div>
        <div>
          <p className="font-semibold text-neutral-700 dark:text-neutral-200">
            2 · Bạn duyệt việc ghi thật
          </p>
          <p className="mt-1 text-neutral-600 dark:text-neutral-300">
            Am tự so ý muốn với thật trên YouTube, sinh đề xuất cho chỗ lệch.
            Bấm <strong>Duyệt</strong> = đồng ý, YouTube vẫn chưa đổi gì.
          </p>
        </div>
        <div>
          <p className="font-semibold text-neutral-700 dark:text-neutral-200">
            3 · Ghi lên YouTube
          </p>
          <p className="mt-1 text-neutral-600 dark:text-neutral-300">
            Đây mới là lúc thay đổi thật trên tài khoản của bạn. Kể cả xoá thư
            mục cũng đi đúng ba bước này, không có ngoại lệ tự động.
          </p>
        </div>
      </div>

      {/* Đề xuất đang chờ */}
      <section className="mt-6">
        <h2 className="text-base font-semibold">
          Chờ bạn quyết ({choDuyet.length})
        </h2>
        {choDuyet.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-400">
            Không có đề xuất nào đang chờ.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {choDuyet.map((d) => (
              <li
                key={d.id}
                className={`rounded-xl border p-4 ${
                  d.nguyHiem
                    ? "border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/30"
                    : "border-neutral-200 dark:border-neutral-800"
                }`}
              >
                {d.idNoiDung && d.tieuDeVideo ? (
                  <Link
                    href={`/xem/${d.idNoiDung}`}
                    className="text-sm font-medium leading-snug hover:underline"
                  >
                    {d.tieuDeVideo}
                  </Link>
                ) : null}
                <p
                  className={`mt-1.5 text-sm font-medium ${
                    d.nguyHiem ? "text-red-700 dark:text-red-400" : "text-neutral-700 dark:text-neutral-200"
                  }`}
                >
                  {d.moTaViec}
                </p>
                <p className="mt-1.5 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
                  {d.lyDo}
                </p>

                {laChu ? (
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      disabled={dangChay}
                      onClick={() => chay(() => duyet(d.id))}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium disabled:opacity-40 ${
                        d.nguyHiem
                          ? "border-red-600 text-red-700 dark:border-red-500 dark:text-red-400"
                          : "border-cam-600 dark:border-cam-500"
                      }`}
                    >
                      Duyệt
                    </button>
                    <button
                      type="button"
                      disabled={dangChay}
                      onClick={() => chay(() => tuChoi(d.id))}
                      className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs text-neutral-500 disabled:opacity-40 dark:border-neutral-700"
                    >
                      Bỏ
                    </button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Đã duyệt, chờ ghi thật */}
      {daDuyet.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-base font-semibold">
            Đã duyệt, chưa ghi ({daDuyet.length})
          </h2>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            Duyệt rồi vẫn chưa có gì thay đổi trên YouTube. Bấm nút dưới mới ghi
            thật.
          </p>
          <ul className="mt-3 space-y-2">
            {daDuyet.map((d) => (
              <li
                key={d.id}
                className={`flex flex-wrap items-center gap-3 rounded-xl border p-3 ${
                  d.nguyHiem
                    ? "border-red-300 dark:border-red-900"
                    : "border-neutral-300 dark:border-neutral-700"
                }`}
              >
                <div className="min-w-0 flex-1">
                  {d.tieuDeVideo ? (
                    <p className="line-clamp-1 text-sm">{d.tieuDeVideo}</p>
                  ) : null}
                  <p
                    className={`text-xs ${
                      d.nguyHiem ? "text-red-600 dark:text-red-400" : "text-neutral-500 dark:text-neutral-400"
                    }`}
                  >
                    {d.moTaViec}
                  </p>
                </div>
                {laChu ? (
                  <button
                    type="button"
                    disabled={dangChay}
                    onClick={() => chay(() => ghiLenYouTube(d.id))}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40 ${
                      d.nguyHiem ? "bg-red-600 dark:bg-red-500" : "bg-cam-600 dark:bg-cam-500"
                    }`}
                  >
                    Ghi lên YouTube
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Đã ghi rồi */}
      {daGhi.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-base font-semibold">Đã ghi ({daGhi.length})</h2>
          <ul className="mt-3 space-y-1">
            {daGhi.map((d) => (
              <li
                key={d.id}
                className="flex items-baseline justify-between gap-3 text-sm text-neutral-500 dark:text-neutral-400"
              >
                <span className="line-clamp-1">{d.tieuDeVideo ?? d.moTaViec}</span>
                <span className="shrink-0 text-xs">{d.moTaViec}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Thư mục đang chờ xoá */}
      {cacThuMucChoXoa.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-base font-semibold">
            Đang chờ xoá ({cacThuMucChoXoa.length})
          </h2>
          <ul className="mt-3 space-y-2">
            {cacThuMucChoXoa.map((m) => (
              <MotThuMucChoXoa key={m.id} muc={m} />
            ))}
          </ul>
        </section>
      ) : null}

      {/* Thư mục */}
      <section className="mt-10">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-base font-semibold">
            Thư mục của bạn ({cacPlaylist.length})
          </h2>
          {laChu ? (
            <button
              type="button"
              disabled={dangChay}
              onClick={() => chay(() => dongBoLai())}
              className="text-xs text-neutral-500 underline hover:text-neutral-900 disabled:opacity-40 dark:hover:text-neutral-200"
            >
              Đọc lại từ YouTube
            </button>
          ) : null}
        </div>
        <p className="mt-1 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
          Bấm vào tên để đổi. <strong className="text-cam-700 dark:text-cam-300">Cho
          sắp xếp</strong> = trợ lý được phép đề xuất thêm video vào playlist
          này · <strong>Không đụng tới</strong> = nó bỏ qua hẳn.
        </p>

        <KhoiTaoThuMuc laChu={laChu} />

        {cacPlaylist.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-400">
            Chưa có thư mục nào. Tạo mới ở trên, hoặc bấm &ldquo;Đọc lại từ
            YouTube&rdquo;.
          </p>
        ) : (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {cacPlaylist.map((p) => (
              <MotPlaylist key={p.id} muc={p} laChu={laChu} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
