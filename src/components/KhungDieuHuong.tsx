"use client";

/**
 * Thanh trên cùng và cột điều hướng bên trái.
 *
 * Bám theo cách YouTube làm, vì chủ dự án đã quen tay:
 *
 *   - **Menu bung**: icon nhỏ nằm bên trái, chữ nằm ngang bên phải
 *   - **Menu co**: icon TO hơn nằm giữa, chữ bé xíu bên dưới
 *
 * Hai kiểu icon khác nhau hẳn chứ không phải cùng một icon thu nhỏ — chủ dự án
 * chỉ ra đúng chỗ này khi so với YouTube. Lý do: lúc co lại, icon gần như là
 * thứ duy nhất để nhận ra mục, nên nó phải to và đậm hơn; lúc bung ra đã có
 * chữ đỡ nên icon lùi về làm nền.
 *
 * VÌ SAO TÁCH KHỎI `KhungTrang`: chỗ này cần nhớ trạng thái co/bung và biết
 * đang ở trang nào, tức là phải chạy ở trình duyệt. Còn `KhungTrang` phải nằm
 * ở máy chủ để gọi được lệnh đăng xuất. Nút đăng xuất vì thế được truyền
 * xuống đây dưới dạng một mẩu giao diện dựng sẵn.
 */

import {
  BookMarked,
  Compass,
  History,
  House,
  Library,
  ListMusic,
  Menu,
  MessageCircle,
  PenLine,
  Search,
  Settings,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";

import { datKhung, docKhung } from "@/lib/giaoDien/khungChat";

interface MucDieuHuong {
  ten: string;
  /** Tên ngắn dùng khi menu co lại — chữ chỉ còn một dòng bé xíu */
  tenNgan?: string;
  bieuTuong: LucideIcon;
  duongDan?: string;
  /** Bấm vào thì mở khung trò chuyện thay vì chuyển trang */
  moTroLy?: boolean;
  /** Phase nào sẽ làm mục này — hiện ra khi rê chuột */
  seLamO?: string;
}

const NHOM_CHINH: MucDieuHuong[] = [
  { ten: "Trang chủ", bieuTuong: House, duongDan: "/" },
  {
    ten: "Am nói với bạn",
    tenNgan: "Bản tin",
    bieuTuong: Sparkles,
    duongDan: "/ban-tin",
  },
  { ten: "Khám phá", bieuTuong: Compass, duongDan: "/kham-pha" },
  { ten: "New", bieuTuong: Search, duongDan: "/quan-tam" },
];

const NHOM_CUA_BAN: MucDieuHuong[] = [
  {
    ten: "Lịch sử xem",
    tenNgan: "Lịch sử",
    bieuTuong: History,
    duongDan: "/lich-su",
  },
  { ten: "Thư viện", bieuTuong: Library, duongDan: "/thu-vien" },
  { ten: "Playlist", bieuTuong: ListMusic, duongDan: "/playlist" },
  { ten: "Ghi chú", bieuTuong: PenLine, duongDan: "/ghi-chu" },
  { ten: "Tủ sách", bieuTuong: BookMarked, seLamO: "Phase 6" },
];

const NHOM_TRO_LY: MucDieuHuong[] = [
  {
    // Bấm vào đây mở đúng khung trò chuyện mà nút tròn góc phải dưới mở —
    // chủ dự án chốt 2026-08-15. Hai lối vào, một cái đích.
    ten: "Trò chuyện",
    tenNgan: "Chat",
    bieuTuong: MessageCircle,
    moTroLy: true,
  },
  { ten: "Cài đặt", bieuTuong: Settings, duongDan: "/cai-dat" },
];

const KHOA_NHO = "am-menu-co-lai";

/**
 * Nhớ trạng thái co/bung vào máy.
 *
 * VÌ SAO KHÔNG DÙNG `useState` + `useEffect`: đọc bộ nhớ máy rồi gọi `setState`
 * ngay trong effect làm React vẽ lại hai lần liên tiếp mỗi lần mở trang, và
 * ESLint chặn đúng kiểu đó. Còn đọc thẳng lúc vẽ thì lần vẽ ở máy chủ (không
 * có bộ nhớ máy) và lần vẽ ở trình duyệt lệch nhau.
 *
 * `useSyncExternalStore` giải đúng bài này: nó nhận **hai** hàm đọc — một cho
 * máy chủ (luôn trả "bung", vì máy chủ không thể biết), một cho trình duyệt.
 */
const NGUOI_NGHE = new Set<() => void>();

function dangKyNghe(goiLai: () => void): () => void {
  NGUOI_NGHE.add(goiLai);
  return () => {
    NGUOI_NGHE.delete(goiLai);
  };
}

function docTrenTrinhDuyet(): boolean {
  return window.localStorage.getItem(KHOA_NHO) === "1";
}

/** Máy chủ không biết lựa chọn của người dùng — luôn dựng ở trạng thái bung. */
function docTrenMayChu(): boolean {
  return false;
}

function datCoLai(moi: boolean): void {
  window.localStorage.setItem(KHOA_NHO, moi ? "1" : "0");
  for (const goiLai of NGUOI_NGHE) goiLai();
}

/**
 * Mở khung trò chuyện — dùng chung cho mục "Trò chuyện" trong menu.
 *
 * Gọi thẳng vào kho trạng thái của khung chứ không truyền hàm xuống qua nhiều
 * tầng: khung nằm ở bố cục gốc còn menu nằm sâu trong cây, nối bằng props thì
 * phải xâu qua bốn năm chỗ chẳng liên quan.
 */
function moKhungTroChuyen(): void {
  const nay = docKhung();
  datKhung({ ...nay, moRa: true, thuGon: false });
}

function dangOMuc(duongDan: string | undefined, hienTai: string): boolean {
  if (!duongDan) return false;
  if (duongDan === "/") return hienTai === "/";
  return hienTai.startsWith(duongDan);
}

/** Một mục khi menu đang BUNG: icon nhỏ bên trái, chữ nằm ngang. */
function MucBung({ muc, dangO }: { muc: MucDieuHuong; dangO: boolean }) {
  const Icon = muc.bieuTuong;
  const kieu =
    "flex items-center gap-4 rounded-lg px-3 py-2 text-sm transition-colors";

  if (muc.moTroLy) {
    return (
      <button
        type="button"
        onClick={moKhungTroChuyen}
        className={`${kieu} w-full text-neutral-700 hover:bg-cam-50 dark:text-neutral-200 dark:hover:bg-cam-50`}
      >
        <Icon size={20} strokeWidth={1.75} className="shrink-0" />
        {muc.ten}
      </button>
    );
  }

  if (!muc.duongDan) {
    return (
      <span
        title={`Chưa làm — dự kiến ${muc.seLamO}`}
        className={`${kieu} cursor-default text-neutral-400 dark:text-neutral-600`}
      >
        <Icon size={20} strokeWidth={1.75} className="shrink-0" />
        {muc.ten}
      </span>
    );
  }

  return (
    <Link
      href={muc.duongDan}
      className={`${kieu} ${
        dangO
          ? // Nền mục đang mở ám cam chứ không xám trung tính. Ở tông tối,
            // `cam-100` là nâu rất đậm (#2a1d16) — cùng họ với chữ cam nên
            // trông là một khối, thay vì một mảng xám tình cờ có chữ cam.
            "bg-cam-100 font-medium text-cam-700 dark:text-cam-300"
          : "text-neutral-700 hover:bg-cam-50 dark:text-neutral-200 dark:hover:bg-cam-50"
      }`}
    >
      <Icon size={20} strokeWidth={dangO ? 2.25 : 1.75} className="shrink-0" />
      {muc.ten}
    </Link>
  );
}

/** Một mục khi menu đang CO: icon to nằm giữa, chữ bé xíu bên dưới. */
function MucCo({ muc, dangO }: { muc: MucDieuHuong; dangO: boolean }) {
  const Icon = muc.bieuTuong;
  const ten = muc.tenNgan ?? muc.ten;
  const kieu =
    "flex w-full flex-col items-center gap-1 rounded-lg px-1 py-3.5 text-[10px] leading-tight transition-colors";

  if (muc.moTroLy) {
    return (
      <button
        type="button"
        onClick={moKhungTroChuyen}
        title={muc.ten}
        className={`${kieu} text-neutral-700 hover:bg-cam-50 dark:text-neutral-200 dark:hover:bg-cam-50`}
      >
        <Icon size={24} strokeWidth={1.9} />
        <span className="line-clamp-1">{ten}</span>
      </button>
    );
  }

  if (!muc.duongDan) {
    return (
      <span
        title={`Chưa làm — dự kiến ${muc.seLamO}`}
        className={`${kieu} cursor-default text-neutral-400 dark:text-neutral-600`}
      >
        <Icon size={24} strokeWidth={1.75} />
        <span className="line-clamp-1">{ten}</span>
      </span>
    );
  }

  return (
    <Link
      href={muc.duongDan}
      title={muc.ten}
      className={`${kieu} ${
        dangO
          ? // Nền mục đang mở ám cam chứ không xám trung tính. Ở tông tối,
            // `cam-100` là nâu rất đậm (#2a1d16) — cùng họ với chữ cam nên
            // trông là một khối, thay vì một mảng xám tình cờ có chữ cam.
            "bg-cam-100 font-medium text-cam-700 dark:text-cam-300"
          : "text-neutral-700 hover:bg-cam-50 dark:text-neutral-200 dark:hover:bg-cam-50"
      }`}
    >
      <Icon size={24} strokeWidth={dangO ? 2.5 : 1.9} />
      <span className="line-clamp-1">{ten}</span>
    </Link>
  );
}

export function KhungDieuHuong({
  children,
  emailNguoiDung,
  dangXuat,
}: {
  children: React.ReactNode;
  emailNguoiDung?: string | null;
  dangXuat?: React.ReactNode;
}) {
  const hienTai = usePathname();
  const coLai = useSyncExternalStore(
    dangKyNghe,
    docTrenTrinhDuyet,
    docTrenMayChu,
  );

  const cacNhom: { nhan?: string; cacMuc: MucDieuHuong[] }[] = [
    { cacMuc: NHOM_CHINH },
    { nhan: "Của bạn", cacMuc: NHOM_CUA_BAN },
    { nhan: "Trợ lý", cacMuc: NHOM_TRO_LY },
  ];

  return (
    <div
      className="min-h-screen bg-background"
      // Chừa chỗ cho khung trò chuyện khi nó đang neo mép.
      //
      // ĐÂY LÀ CHỖ LÀM NÊN KHÁC BIỆT: panel đẩy nội dung sang bên chứ không đè
      // lên. Che mất nội dung thì vừa đọc vừa hỏi không được — mà đó đúng là
      // lúc cần hỏi nhất. Hai biến do `KhungTroChuyen` ghi lên thẻ <html>.
      style={{
        paddingLeft: "var(--chat-neo-trai, 0px)",
        paddingRight: "var(--chat-neo-phai, 0px)",
        transition: "padding var(--chat-neo-nhip, 150ms) ease",
      }}
    >
      <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-neutral-200 bg-nen-menu/95 px-4 backdrop-blur dark:border-neutral-800">
        <button
          type="button"
          onClick={() => datCoLai(!coLai)}
          aria-label={coLai ? "Mở rộng menu" : "Thu gọn menu"}
          className="hidden rounded-full p-2 text-neutral-600 transition-colors hover:bg-cam-100 lg:block dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          <Menu size={22} strokeWidth={2} />
        </button>

        <Link
          href="/"
          className="text-lg font-bold tracking-tight text-cam-600 dark:text-cam-500"
        >
          Am
        </Link>

        <form action="/kham-pha" className="mx-auto w-full max-w-xl">
          <input
            type="search"
            name="q"
            placeholder="Tìm trong nội dung đã quét…"
            className="w-full rounded-full border border-neutral-200 bg-background px-4 py-1.5 text-sm placeholder:text-neutral-400 focus:border-cam-500 focus:outline-none dark:border-neutral-800"
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
            {dangXuat}
          </div>
        ) : (
          <div className="flex shrink-0 items-center gap-3">
            <span className="hidden text-xs text-neutral-400 md:block dark:text-neutral-500">
              Đang xem với tư cách khách
            </span>
            <Link
              href="/dang-nhap"
              className="rounded-lg bg-cam-600 px-3.5 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
            >
              Đăng nhập
            </Link>
          </div>
        )}
      </header>

      <div className="flex">
        <nav
          className={`sticky top-14 hidden h-[calc(100vh-3.5rem)] shrink-0 overflow-y-auto border-r border-neutral-200 bg-nen-menu py-2 lg:block dark:border-neutral-800 ${
            coLai ? "w-[72px] px-1" : "w-56 px-2"
          }`}
        >
          {cacNhom.map((nhom, i) => (
            <div key={nhom.nhan ?? i}>
              {i > 0 ? (
                <div className="my-1 border-t border-neutral-200/70 dark:border-neutral-800" />
              ) : null}
              {/* Nhãn nhóm chỉ có nghĩa khi còn chỗ cho chữ */}
              {nhom.nhan && !coLai ? (
                <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
                  {nhom.nhan}
                </p>
              ) : null}
              <div className="py-1">
                {nhom.cacMuc.map((m) =>
                  coLai ? (
                    <MucCo
                      key={m.ten}
                      muc={m}
                      dangO={dangOMuc(m.duongDan, hienTai)}
                    />
                  ) : (
                    <MucBung
                      key={m.ten}
                      muc={m}
                      dangO={dangOMuc(m.duongDan, hienTai)}
                    />
                  ),
                )}
              </div>
            </div>
          ))}
        </nav>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
