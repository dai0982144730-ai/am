/**
 * Trạng thái hình học của khung trò chuyện, và cách nhớ nó vào máy.
 *
 * Tách riêng khỏi component vì phần này thuần tính toán: kẹp số vào giới hạn,
 * đọc/ghi bộ nhớ máy, quyết định vùng dính mép. Component chỉ còn lo việc bắt
 * chuột và vẽ.
 *
 * ## Hai chế độ
 *
 * **Neo** — dính mép trái hoặc mép phải, cao nguyên màn hình. Điểm mấu chốt:
 * nó **đẩy nội dung sang bên chứ không che lên**. Làm được nhờ ghi hai biến CSS
 * lên thẻ `<html>`, còn khung trang lấy đó làm khoảng đệm.
 *
 * **Nổi** — kéo thả tự do, đổi kích thước từ cả 8 hướng.
 *
 * ## Vì sao phải nhớ kích thước khung nổi trước khi neo
 *
 * Người dùng chỉnh khung nổi vừa ý rồi kéo vào mép để neo. Lúc gỡ neo ra mà trả
 * về kích thước mặc định thì công chỉnh ấy mất trắng. Nên trước mỗi lần neo,
 * chụp lại kích thước đang có vào `nhoKhungNoi`.
 */

export type CheDo = "neo" | "noi";
export type BenNeo = "trai" | "phai";

/** Khung nổi: kích thước mặc định và giới hạn. */
export const NOI_RONG_MAC_DINH = 400;
export const NOI_CAO_MAC_DINH = 600;
export const NOI_RONG_MIN = 320;
export const NOI_CAO_MIN = 360;
/** Trần kích thước khung nổi = 96% màn hình, chừa mép để còn thấy nội dung */
export const NOI_TY_LE_MAX = 0.96;
/** Khoảng cách mép màn hình khi đặt khung nổi về chỗ mặc định */
export const NOI_CACH_MEP = 20;

/** Khung neo: bề rộng mặc định và giới hạn. */
export const NEO_RONG_MAC_DINH = 420;
export const NEO_RONG_MIN = 320;
export const NEO_RONG_MAX = 720;
/** Bề rộng dải dọc khi thu gọn ở chế độ neo */
export const RONG_DAI_THU_GON = 40;

/** Bề dày vùng bắt chuột: 4 mép mỏng, 4 góc là ô vuông đè lên mép. */
export const DAY_BAT_MEP = 6;
export const DAY_BAT_GOC = 14;

/** Kéo con trỏ vào dải sát mép rộng ngần này thì xem trước "neo". */
export const DAI_DINH_MEP = 80;
/** Ô vuông góc phải dưới: kéo vào đây thì xem trước "về khung nhỏ". */
export const O_DINH_GOC = 220;
/** Đang neo, kéo tiêu đề rời khỏi mép quá mốc này thì gỡ neo ngay. */
export const MOC_GO_NEO = 120;

/** Tên hai biến CSS mà khung trang đọc để chừa chỗ cho panel. */
export const BIEN_CHUA_TRAI = "--chat-neo-trai";
export const BIEN_CHUA_PHAI = "--chat-neo-phai";
/** 0ms khi đang kéo (nội dung bám tay), 150ms khi đóng/mở. */
export const BIEN_NHIP = "--chat-neo-nhip";

export const KHOA_KHUNG_CHAT = "am-khung-chat";

export interface HinhKhungNoi {
  x: number;
  y: number;
  rong: number;
  cao: number;
}

export interface TrangThaiKhung {
  cheDo: CheDo;
  benNeo: BenNeo;
  neoRong: number;
  x: number;
  y: number;
  rong: number;
  cao: number;
  moRa: boolean;
  thuGon: boolean;
  /** Kích thước khung nổi ngay TRƯỚC lần neo gần nhất */
  nhoKhungNoi?: HinhKhungNoi;
}

export const BAN_DAU: TrangThaiKhung = {
  cheDo: "neo",
  // Mặc định neo PHẢI, giống ảnh chủ dự án gửi
  benNeo: "phai",
  neoRong: NEO_RONG_MAC_DINH,
  x: -1,
  y: -1,
  rong: NOI_RONG_MAC_DINH,
  cao: NOI_CAO_MAC_DINH,
  moRa: false,
  thuGon: false,
};

export function kep(v: number, thap: number, cao: number): number {
  return Math.min(Math.max(v, thap), Math.max(thap, cao));
}

/** Trần bề rộng khung neo: không quá 720px và không quá nửa màn hình. */
export function neoRongMax(): number {
  const vw = typeof window === "undefined" ? 1280 : window.innerWidth;
  return Math.max(NEO_RONG_MIN, Math.min(NEO_RONG_MAX, Math.round(vw * 0.5)));
}

export function kepNeoRong(r: number): number {
  const max = neoRongMax();
  if (!Number.isFinite(r)) return Math.min(NEO_RONG_MAC_DINH, max);
  return Math.min(Math.max(Math.round(r), NEO_RONG_MIN), max);
}

/** Hình mặc định của khung nhỏ góc phải dưới. */
export function hinhMacDinh(): HinhKhungNoi {
  const vw = typeof window === "undefined" ? 1280 : window.innerWidth;
  const vh = typeof window === "undefined" ? 800 : window.innerHeight;
  const rong = Math.min(NOI_RONG_MAC_DINH, Math.round(vw * NOI_TY_LE_MAX));
  const cao = Math.min(NOI_CAO_MAC_DINH, Math.round(vh * NOI_TY_LE_MAX));
  return {
    x: Math.max(0, vw - rong - NOI_CACH_MEP),
    y: Math.max(0, vh - cao - NOI_CACH_MEP),
    rong,
    cao,
  };
}

/**
 * Kẹp khung nổi vào trong màn hình.
 *
 * Lạc hẳn ra ngoài thì đưa về góc phải dưới — hay gặp khi đổi từ màn hình rộng
 * sang màn hình hẹp, hoặc rút màn hình phụ ra.
 */
export function kepVaoManHinh(s: TrangThaiKhung): TrangThaiKhung {
  if (typeof window === "undefined") return s;

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const rong = kep(s.rong, NOI_RONG_MIN, Math.round(vw * NOI_TY_LE_MAX));
  const cao = kep(s.cao, NOI_CAO_MIN, Math.round(vh * NOI_TY_LE_MAX));

  let { x, y } = s;
  const langThang =
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    x < 0 ||
    y < 0 ||
    x + rong > vw ||
    y + cao > vh;

  if (langThang) {
    const md = hinhMacDinh();
    x = md.x;
    y = md.y;
  }

  return {
    ...s,
    x,
    y,
    rong,
    cao,
    neoRong: kepNeoRong(s.neoRong),
    // Hình đã nhớ chỉ kẹp theo KÍCH THƯỚC, không ép vị trí — vị trí sẽ kẹp lại
    // đúng lúc khôi phục, vì lúc đó mới biết màn hình đang bao nhiêu
    nhoKhungNoi: s.nhoKhungNoi
      ? {
          ...s.nhoKhungNoi,
          rong: kep(s.nhoKhungNoi.rong, NOI_RONG_MIN, Math.round(vw * NOI_TY_LE_MAX)),
          cao: kep(s.nhoKhungNoi.cao, NOI_CAO_MIN, Math.round(vh * NOI_TY_LE_MAX)),
        }
      : undefined,
  };
}

function docHinhNho(v: unknown): HinhKhungNoi | undefined {
  if (!v || typeof v !== "object") return undefined;
  const g = v as Partial<HinhKhungNoi>;
  const so = [g.x, g.y, g.rong, g.cao];
  if (so.some((n) => typeof n !== "number" || !Number.isFinite(n))) return undefined;
  return { x: g.x!, y: g.y!, rong: g.rong!, cao: g.cao! };
}

export function docTrangThai(): TrangThaiKhung {
  try {
    const tho = window.localStorage.getItem(KHOA_KHUNG_CHAT);
    if (!tho) return kepVaoManHinh(BAN_DAU);

    const p = JSON.parse(tho) as Partial<TrangThaiKhung> | null;
    if (!p) return kepVaoManHinh(BAN_DAU);

    const soHoac = (v: unknown, md: number) =>
      typeof v === "number" && Number.isFinite(v) ? v : md;

    return kepVaoManHinh({
      cheDo: p.cheDo === "noi" ? "noi" : "neo",
      benNeo: p.benNeo === "trai" ? "trai" : "phai",
      neoRong: soHoac(p.neoRong, NEO_RONG_MAC_DINH),
      x: soHoac(p.x, -1),
      y: soHoac(p.y, -1),
      rong: soHoac(p.rong, NOI_RONG_MAC_DINH),
      cao: soHoac(p.cao, NOI_CAO_MAC_DINH),
      moRa: p.moRa === true,
      thuGon: p.thuGon === true,
      nhoKhungNoi: docHinhNho(p.nhoKhungNoi),
    });
  } catch {
    return kepVaoManHinh(BAN_DAU);
  }
}

export function ghiTrangThai(s: TrangThaiKhung): void {
  try {
    window.localStorage.setItem(KHOA_KHUNG_CHAT, JSON.stringify(s));
  } catch {
    // Không ghi được thì thôi — phiên này vẫn dùng bình thường
  }
}

/**
 * Đẩy hai biến CSS lên thẻ `<html>` để khung trang chừa chỗ.
 *
 * VÌ SAO KHÔNG CHO PANEL NẰM ĐÈ LÊN: che mất nội dung thì vừa đọc vừa hỏi không
 * được, mà đó chính là lúc người ta cần hỏi nhất. Đẩy sang bên thì cả hai cùng
 * nhìn thấy.
 */
export function datChoChua(
  trai: number,
  phai: number,
  dangKeo: boolean,
): void {
  const g = document.documentElement.style;
  g.setProperty(BIEN_CHUA_TRAI, `${trai}px`);
  g.setProperty(BIEN_CHUA_PHAI, `${phai}px`);
  // Đang kéo thì bỏ hiệu ứng mượt, để nội dung bám sát tay. Có hiệu ứng thì
  // nội dung chạy trễ hơn con trỏ, nhìn như bị giật.
  g.setProperty(BIEN_NHIP, dangKeo ? "0ms" : "150ms");
}

// ==========================================================================
// Kho trạng thái nhỏ, dùng với useSyncExternalStore
// ==========================================================================

/**
 * VÌ SAO PHẢI LÀ KHO NGOÀI CHỨ KHÔNG PHẢI `useState` + `useEffect`
 *
 * Đọc bộ nhớ máy rồi `setState` ngay trong effect là kiểu ESLint chặn thẳng
 * ("Calling setState synchronously within an effect"), và chặn có lý: React vẽ
 * hai lần liên tiếp mỗi lần mở trang. Đây là lần thứ ba dự án này vấp đúng lỗi
 * đó — hai lần trước ở ô nhập ghi chú và ở menu điều hướng.
 *
 * Khuôn đúng: để trạng thái nằm NGOÀI React, React chỉ đăng ký nghe.
 *   - Máy chủ đọc: luôn trả `BAN_DAU`, vì máy chủ không thể biết
 *   - Trình duyệt đọc: trả giá trị thật, nhưng chỉ sau khi đã có người nghe
 *
 * Nhờ vậy lần vẽ đầu ở hai bên khớp nhau, không báo lỗi lệch, mà cũng không
 * `setState` trong effect.
 *
 * `docKhung` phải trả về **cùng một đối tượng** giữa hai lần vẽ nếu chưa có gì
 * đổi — trả về đối tượng mới mỗi lần thì React coi là đã đổi và vẽ lại vô tận.
 */
let hienTai: TrangThaiKhung | null = null;
const NGUOI_NGHE = new Set<() => void>();

/** Đẩy chỗ chừa theo trạng thái hiện có. */
function apChoChua(s: TrangThaiKhung, dangKeo: boolean): void {
  const neoThat = s.moRa && s.cheDo === "neo";
  const be = neoThat ? (s.thuGon ? RONG_DAI_THU_GON : s.neoRong) : 0;
  datChoChua(
    neoThat && s.benNeo === "trai" ? be : 0,
    neoThat && s.benNeo === "phai" ? be : 0,
    dangKeo,
  );
}

export function dangKyNgheKhung(goiLai: () => void): () => void {
  NGUOI_NGHE.add(goiLai);

  // Lần đầu có người nghe mới đọc bộ nhớ máy. Đọc trong `docKhung` thì hàm đó
  // có tác dụng phụ, mà React gọi nó rất nhiều lần.
  if (hienTai === null) {
    hienTai = docTrangThai();
    apChoChua(hienTai, false);
    // Báo ngay để React vẽ lại với trạng thái thật
    goiLai();
  }

  return () => {
    NGUOI_NGHE.delete(goiLai);
  };
}

export function docKhung(): TrangThaiKhung {
  return hienTai ?? BAN_DAU;
}

/** Máy chủ không biết người dùng đã kéo khung đi đâu — luôn trả mặc định. */
export function docKhungMayChu(): TrangThaiKhung {
  return BAN_DAU;
}

export function datKhung(moi: TrangThaiKhung, dangKeo = false): void {
  hienTai = moi;
  ghiTrangThai(moi);
  apChoChua(moi, dangKeo);
  for (const goiLai of NGUOI_NGHE) goiLai();
}

/** Trả chỗ chừa về 0 — gọi khi gỡ khung ra khỏi trang. */
export function xoaChoChua(): void {
  datChoChua(0, 0, false);
}

export type VungDinh = "trai" | "phai" | "goc" | null;

/**
 * Con trỏ đang ở vùng dính nào.
 *
 * Ô góc phải dưới CHỒNG lên dải mép phải. Cho ô góc thắng, vì kéo vào đúng góc
 * là ý định rõ ràng hơn — người ta nhắm tới cái ô nhỏ chứ không phải lướt qua
 * dải mép.
 */
export function vungDinhTai(x: number, y: number): VungDinh {
  if (typeof window === "undefined") return null;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  if (x > vw - O_DINH_GOC && y > vh - O_DINH_GOC) return "goc";
  if (x < DAI_DINH_MEP) return "trai";
  if (x > vw - DAI_DINH_MEP) return "phai";
  return null;
}
