/**
 * Khung chung của web: thanh trên cùng và cột điều hướng bên trái.
 *
 * Bám theo bản demo `docs/demo-ui.html`, vốn cố ý làm giống YouTube cho quen
 * tay. Những mục chưa có trang thật thì vẫn hiện nhưng làm mờ và không bấm
 * được — để thấy rõ web sẽ đi tới đâu, thay vì bấm vào rồi gặp trang trống.
 */

import Link from "next/link";

import { signOut } from "@/auth";

interface MucDieuHuong {
  ten: string;
  bieuTuong: string;
  duongDan?: string;
  /** Phase nào sẽ làm mục này — hiện ra khi rê chuột */
  seLamO?: string;
}

const NHOM_CHINH: MucDieuHuong[] = [
  { ten: "Trang chủ", bieuTuong: "⌂", duongDan: "/" },
  { ten: "Am nói với bạn", bieuTuong: "◈", duongDan: "/ban-tin" },
  { ten: "Khám phá", bieuTuong: "⌕", duongDan: "/kham-pha" },
  { ten: "New", bieuTuong: "✦", duongDan: "/quan-tam" },
];

const NHOM_CUA_BAN: MucDieuHuong[] = [
  { ten: "Thư viện", bieuTuong: "☰", duongDan: "/thu-vien" },
  { ten: "Playlist", bieuTuong: "≡", seLamO: "Phase 7" },
  { ten: "Ghi chú", bieuTuong: "✎", duongDan: "/ghi-chu" },
  { ten: "Tủ sách", bieuTuong: "◫", seLamO: "Phase 6" },
];

const NHOM_TRO_LY: MucDieuHuong[] = [
  { ten: "Trò chuyện", bieuTuong: "☁", seLamO: "Phase 13" },
  { ten: "Cài đặt", bieuTuong: "⚙", duongDan: "/cai-dat" },
];

function MotMuc({ muc }: { muc: MucDieuHuong }) {
  const kieuChung =
    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors";

  if (!muc.duongDan) {
    return (
      <span
        title={`Chưa làm — dự kiến ${muc.seLamO}`}
        className={`${kieuChung} cursor-default text-neutral-300 dark:text-neutral-600`}
      >
        <span aria-hidden className="w-5 text-center text-base">
          {muc.bieuTuong}
        </span>
        {muc.ten}
      </span>
    );
  }

  return (
    <Link
      href={muc.duongDan}
      className={`${kieuChung} text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800`}
    >
      <span aria-hidden className="w-5 text-center text-base">
        {muc.bieuTuong}
      </span>
      {muc.ten}
    </Link>
  );
}

function NhomMuc({ nhan, cacMuc }: { nhan?: string; cacMuc: MucDieuHuong[] }) {
  return (
    <div className="py-2">
      {nhan ? (
        <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
          {nhan}
        </p>
      ) : null}
      {cacMuc.map((m) => (
        <MotMuc key={m.ten} muc={m} />
      ))}
    </div>
  );
}

export function KhungTrang({
  children,
  emailNguoiDung,
}: {
  children: React.ReactNode;
  emailNguoiDung?: string | null;
}) {
  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950">
      <header className="sticky top-0 z-20 flex h-14 items-center gap-4 border-b border-neutral-200 bg-white/90 px-4 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/90">
        <Link href="/" className="text-lg font-bold tracking-tight">
          Am
        </Link>

        <form action="/kham-pha" className="mx-auto w-full max-w-xl">
          <input
            type="search"
            name="q"
            placeholder="Tìm trong nội dung đã quét…"
            className="w-full rounded-full border border-neutral-200 bg-neutral-50 px-4 py-1.5 text-sm placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none dark:border-neutral-800 dark:bg-neutral-900"
          />
        </form>

        {emailNguoiDung ? (
          <div className="flex shrink-0 items-center gap-2">
            <span
              title={emailNguoiDung}
              className="hidden max-w-[180px] truncate text-xs text-neutral-500 sm:block dark:text-neutral-400"
            >
              {emailNguoiDung}
            </span>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            >
              <button
                type="submit"
                className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
              >
                Đăng xuất
              </button>
            </form>
          </div>
        ) : (
          <div className="flex shrink-0 items-center gap-3">
            <span className="hidden text-xs text-neutral-400 md:block dark:text-neutral-500">
              Đang xem với tư cách khách
            </span>
            <Link
              href="/dang-nhap"
              className="rounded-lg bg-neutral-900 px-3.5 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 dark:bg-neutral-100 dark:text-neutral-900"
            >
              Đăng nhập
            </Link>
          </div>
        )}
      </header>

      <div className="flex">
        <nav className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-56 shrink-0 overflow-y-auto border-r border-neutral-200 px-2 py-2 lg:block dark:border-neutral-800">
          <NhomMuc cacMuc={NHOM_CHINH} />
          <div className="border-t border-neutral-100 dark:border-neutral-900" />
          <NhomMuc nhan="Của bạn" cacMuc={NHOM_CUA_BAN} />
          <div className="border-t border-neutral-100 dark:border-neutral-900" />
          <NhomMuc nhan="Trợ lý" cacMuc={NHOM_TRO_LY} />
        </nav>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
