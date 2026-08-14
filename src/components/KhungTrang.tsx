/**
 * Khung chung của web: thanh trên cùng và cột điều hướng bên trái.
 *
 * Bám theo bản demo `docs/demo-ui.html`, vốn cố ý làm giống YouTube cho quen
 * tay. Những mục chưa có trang thật thì vẫn hiện nhưng làm mờ và không bấm
 * được — để thấy rõ web sẽ đi tới đâu, thay vì bấm vào rồi gặp trang trống.
 */

import Link from "next/link";

interface MucDieuHuong {
  ten: string;
  bieuTuong: string;
  duongDan?: string;
  /** Phase nào sẽ làm mục này — hiện ra khi rê chuột */
  seLamO?: string;
}

const NHOM_CHINH: MucDieuHuong[] = [
  { ten: "Trang chủ", bieuTuong: "⌂", duongDan: "/" },
  { ten: "Khám phá", bieuTuong: "⌕", seLamO: "Phase 4b" },
  { ten: "New", bieuTuong: "✦", seLamO: "Phase 4c" },
  { ten: "Đang phát", bieuTuong: "▶", seLamO: "Phase 5" },
];

const NHOM_CUA_BAN: MucDieuHuong[] = [
  { ten: "Thư viện", bieuTuong: "☰", seLamO: "Phase 7" },
  { ten: "Playlist", bieuTuong: "≡", seLamO: "Phase 7" },
  { ten: "Ghi chú", bieuTuong: "✎", seLamO: "Phase 8" },
  { ten: "Tủ sách", bieuTuong: "◫", seLamO: "Phase 6" },
];

const NHOM_TRO_LY: MucDieuHuong[] = [
  { ten: "Trò chuyện", bieuTuong: "☁", seLamO: "Phase 13" },
  { ten: "Cài đặt", bieuTuong: "⚙", seLamO: "Phase 4" },
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

        <div className="mx-auto w-full max-w-xl">
          <input
            type="search"
            disabled
            placeholder="Tìm trong nội dung đã quét… (Phase 4b)"
            className="w-full rounded-full border border-neutral-200 bg-neutral-50 px-4 py-1.5 text-sm text-neutral-500 placeholder:text-neutral-400 dark:border-neutral-800 dark:bg-neutral-900"
          />
        </div>

        {emailNguoiDung ? (
          <span
            title={emailNguoiDung}
            className="hidden shrink-0 text-xs text-neutral-500 sm:block dark:text-neutral-400"
          >
            {emailNguoiDung}
          </span>
        ) : (
          <Link
            href="/dang-nhap"
            className="shrink-0 rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white dark:bg-neutral-100 dark:text-neutral-900"
          >
            Đăng nhập
          </Link>
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
