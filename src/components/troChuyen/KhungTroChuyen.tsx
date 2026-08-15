"use client";

/**
 * Khung trò chuyện với trợ lý — gắn một lần ở bố cục gốc.
 *
 * Làm theo bản mẫu `ChatWidget.tsx` của dự án QLDA mà chủ dự án chỉ vào.
 *
 * ## Hai chế độ
 *
 * **NEO** — dính mép trái hoặc mép phải, cao nguyên màn hình.
 *
 *   Điểm quan trọng nhất: nó **đẩy nội dung sang bên chứ không che lên**. Khung
 *   ghi hai biến CSS lên thẻ `<html>`, khung trang lấy làm khoảng đệm. Che mất
 *   nội dung thì vừa đọc vừa hỏi không được — mà đó đúng là lúc cần hỏi nhất.
 *
 *   Thanh kéo mảnh ở mép TRONG của panel để đổi bề rộng. Thu gọn thì còn một
 *   dải dọc 40px dính đúng mép đang neo.
 *
 * **NỔI** — kéo thả tự do bằng thanh tiêu đề, đổi kích thước từ **cả 8 hướng**:
 * 4 mép mỏng 6px và 4 góc là ô vuông 14px đè lên mép. Kéo mép trên hoặc trái
 * thì đổi cả vị trí lẫn kích thước (mép đối diện đứng yên); mép dưới/phải chỉ
 * đổi kích thước.
 *
 * ## Dính mép kiểu Windows
 *
 * Đang nổi, kéo con trỏ vào dải 80px sát mép trái hoặc phải thì hiện khung xem
 * trước; thả ra là neo. Kéo vào ô 220×220 góc phải dưới thì về khung nhỏ mặc
 * định. Đang neo, kéo tiêu đề rời mép quá 120px thì gỡ neo ngay giữa chừng và
 * panel bám theo tay trong cùng một thao tác — không phải thả ra rồi kéo lại.
 *
 * ## Vì sao dùng pointer capture
 *
 * Bắt chuột bằng `setPointerCapture` chứ không nghe trên `window`: kéo nhanh ra
 * ngoài cửa sổ trình duyệt thì sự kiện vẫn về đúng phần tử, không bị "kẹt" ở
 * trạng thái đang kéo. Đây là lỗi kinh điển của kéo thả tự viết.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minus,
  PanelLeft,
  PanelRight,
  RotateCcw,
  Sparkles,
  Square,
  X,
} from "lucide-react";

import { BangTroChuyen } from "@/components/troChuyen/BangTroChuyen";
import {
  BAN_DAU,
  DAY_BAT_GOC,
  DAY_BAT_MEP,
  MOC_GO_NEO,
  NOI_CAO_MIN,
  NOI_RONG_MIN,
  NOI_TY_LE_MAX,
  RONG_DAI_THU_GON,
  datChoChua,
  docTrangThai,
  ghiTrangThai,
  hinhMacDinh,
  kep,
  kepNeoRong,
  kepVaoManHinh,
  vungDinhTai,
  type BenNeo,
  type TrangThaiKhung,
  type VungDinh,
} from "@/lib/giaoDien/khungChat";

type HuongKeo = "n" | "s" | "w" | "e" | "nw" | "ne" | "sw" | "se";
type KieuKeo = "di" | HuongKeo;

interface TayNam {
  huong: HuongKeo;
  kieu: React.CSSProperties;
}

/**
 * Bốn mép trải hết cạnh (z 40), bốn góc đè lên (z 45).
 *
 * Cho góc thắng ở phần chồng lấn, nhờ vậy không có hai phần tử tranh nhau cùng
 * một mức z — kéo góc luôn ra góc, không bao giờ ra nhầm mép.
 */
const CAC_TAY_NAM: TayNam[] = [
  { huong: "n", kieu: { top: 0, left: 0, right: 0, height: DAY_BAT_MEP, cursor: "n-resize", zIndex: 40 } },
  { huong: "s", kieu: { bottom: 0, left: 0, right: 0, height: DAY_BAT_MEP, cursor: "s-resize", zIndex: 40 } },
  { huong: "w", kieu: { left: 0, top: 0, bottom: 0, width: DAY_BAT_MEP, cursor: "w-resize", zIndex: 40 } },
  { huong: "e", kieu: { right: 0, top: 0, bottom: 0, width: DAY_BAT_MEP, cursor: "e-resize", zIndex: 40 } },
  { huong: "nw", kieu: { left: 0, top: 0, width: DAY_BAT_GOC, height: DAY_BAT_GOC, cursor: "nw-resize", zIndex: 45 } },
  { huong: "ne", kieu: { right: 0, top: 0, width: DAY_BAT_GOC, height: DAY_BAT_GOC, cursor: "ne-resize", zIndex: 45 } },
  { huong: "sw", kieu: { left: 0, bottom: 0, width: DAY_BAT_GOC, height: DAY_BAT_GOC, cursor: "sw-resize", zIndex: 45 } },
  { huong: "se", kieu: { right: 0, bottom: 0, width: DAY_BAT_GOC, height: DAY_BAT_GOC, cursor: "se-resize", zIndex: 45 } },
];

interface GocKeo {
  kieu: KieuKeo;
  batX: number;
  batY: number;
  x: number;
  y: number;
  rong: number;
  cao: number;
  /** Thao tác này bắt đầu ở chế độ NEO và chưa vượt mốc gỡ neo */
  dangNeo: boolean;
  benNeo: BenNeo;
}

export function KhungTroChuyen({ laChu }: { laChu: boolean }) {
  const [s, datS] = useState<TrangThaiKhung>(BAN_DAU);
  // Chỉ vẽ sau khi đã đọc bộ nhớ máy. Vẽ trước rồi sửa sau thì lần vẽ ở máy chủ
  // và lần vẽ ở trình duyệt lệch nhau, React báo lỗi đỏ.
  const [daGanVao, datDaGanVao] = useState(false);
  const [vungDinh, datVungDinh] = useState<VungDinh>(null);

  const oPanel = useRef<HTMLDivElement>(null);
  const goc = useRef<GocKeo | null>(null);

  useEffect(() => {
    datS(docTrangThai());
    datDaGanVao(true);
  }, []);

  /** Ghi trạng thái và cập nhật chỗ chừa cho nội dung. */
  const luu = useCallback((moi: TrangThaiKhung, dangKeo = false) => {
    datS(moi);
    ghiTrangThai(moi);

    const dangNeoThat = moi.moRa && moi.cheDo === "neo";
    const be = dangNeoThat
      ? moi.thuGon
        ? RONG_DAI_THU_GON
        : moi.neoRong
      : 0;
    datChoChua(
      dangNeoThat && moi.benNeo === "trai" ? be : 0,
      dangNeoThat && moi.benNeo === "phai" ? be : 0,
      dangKeo,
    );
  }, []);

  // Đặt chỗ chừa ngay khi gắn vào, và trả về 0 khi gỡ ra
  useEffect(() => {
    if (!daGanVao) return;
    luu(s);
    return () => datChoChua(0, 0, false);
    // Chỉ chạy một lần sau khi đọc xong bộ nhớ máy — những lần sau do `luu` lo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [daGanVao]);

  // Màn hình đổi kích thước thì kẹp lại, kẻo panel lạc ra ngoài
  useEffect(() => {
    if (!daGanVao) return;
    const doi = () => luu(kepVaoManHinh(s));
    window.addEventListener("resize", doi);
    return () => window.removeEventListener("resize", doi);
  }, [daGanVao, s, luu]);

  // Ctrl+K bật tắt
  useEffect(() => {
    const phim = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        luu({ ...s, moRa: !s.moRa, thuGon: false });
      }
    };
    window.addEventListener("keydown", phim);
    return () => window.removeEventListener("keydown", phim);
  }, [s, luu]);

  // ----- Kéo và đổi kích thước -----

  const batDauKeo = useCallback(
    (e: React.PointerEvent, kieu: KieuKeo) => {
      // Chỉ nút chuột trái
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

      const dangNeo = s.cheDo === "neo";
      // Đang neo mà bắt đầu kéo tiêu đề: lấy hình khung nổi đã nhớ làm điểm
      // xuất phát, để lúc gỡ neo panel về đúng kích thước người dùng từng chỉnh
      const hinh = dangNeo ? (s.nhoKhungNoi ?? hinhMacDinh()) : s;

      goc.current = {
        kieu,
        batX: e.clientX,
        batY: e.clientY,
        x: dangNeo ? hinh.x : s.x,
        y: dangNeo ? hinh.y : s.y,
        rong: dangNeo ? hinh.rong : s.rong,
        cao: dangNeo ? hinh.cao : s.cao,
        dangNeo,
        benNeo: s.benNeo,
      };
    },
    [s],
  );

  const dangKeo = useCallback(
    (e: React.PointerEvent) => {
      const g = goc.current;
      if (!g) return;

      const dx = e.clientX - g.batX;
      const dy = e.clientY - g.batY;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const rongMax = Math.round(vw * NOI_TY_LE_MAX);
      const caoMax = Math.round(vh * NOI_TY_LE_MAX);

      // --- Kéo thanh đổi bề rộng khung NEO ---
      if (g.kieu === "e" && g.dangNeo) {
        // Neo trái thì kéo sang phải là rộng ra; neo phải thì ngược lại
        const moi =
          g.benNeo === "trai" ? g.rong + dx : g.rong - dx;
        luu({ ...s, neoRong: kepNeoRong(moi) }, true);
        return;
      }

      // --- Kéo tiêu đề ---
      if (g.kieu === "di") {
        // Đang neo: chưa rời mép đủ xa thì không làm gì, rời đủ xa thì gỡ neo
        // ngay giữa chừng và panel bám theo tay trong cùng thao tác
        if (g.dangNeo) {
          const roiMep =
            g.benNeo === "trai" ? e.clientX > s.neoRong + MOC_GO_NEO : e.clientX < vw - s.neoRong - MOC_GO_NEO;
          if (!roiMep) return;

          goc.current = {
            ...g,
            dangNeo: false,
            // Đổi mốc: từ giờ tính theo vị trí con trỏ hiện tại, để panel
            // không nhảy giật một đoạn bằng quãng đã kéo trước đó
            batX: e.clientX,
            batY: e.clientY,
            x: Math.round(e.clientX - g.rong / 2),
            y: Math.max(0, Math.round(e.clientY - 20)),
          };
          luu(
            {
              ...s,
              cheDo: "noi",
              thuGon: false,
              x: Math.round(e.clientX - g.rong / 2),
              y: Math.max(0, Math.round(e.clientY - 20)),
              rong: g.rong,
              cao: g.cao,
            },
            true,
          );
          return;
        }

        datVungDinh(vungDinhTai(e.clientX, e.clientY));
        luu(
          {
            ...s,
            x: kep(g.x + dx, 0, vw - g.rong),
            y: kep(g.y + dy, 0, vh - g.cao),
          },
          true,
        );
        return;
      }

      // --- Đổi kích thước khung nổi, 8 hướng ---
      let { x, y, rong, cao } = g;

      if (g.kieu.includes("e")) rong = kep(g.rong + dx, NOI_RONG_MIN, rongMax);
      if (g.kieu.includes("s")) cao = kep(g.cao + dy, NOI_CAO_MIN, caoMax);
      if (g.kieu.includes("w")) {
        // Mép trái: đổi cả vị trí lẫn bề rộng, mép phải đứng yên
        rong = kep(g.rong - dx, NOI_RONG_MIN, rongMax);
        x = g.x + (g.rong - rong);
      }
      if (g.kieu.includes("n")) {
        cao = kep(g.cao - dy, NOI_CAO_MIN, caoMax);
        y = g.y + (g.cao - cao);
      }

      luu({ ...s, x, y, rong, cao }, true);
    },
    [s, luu],
  );

  const thoiKeo = useCallback(
    (e: React.PointerEvent) => {
      const g = goc.current;
      goc.current = null;
      if (!g) return;

      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // Con trỏ đã mất trước đó — không sao
      }

      const vung = vungDinhTai(e.clientX, e.clientY);
      datVungDinh(null);

      // Thả trong vùng dính mép sau khi kéo tiêu đề
      if (g.kieu === "di" && s.cheDo === "noi" && vung) {
        if (vung === "goc") {
          luu({ ...s, ...hinhMacDinh(), cheDo: "noi", thuGon: false });
        } else {
          luu({
            ...s,
            // Nhớ kích thước đang có trước khi neo, để gỡ neo còn trả về đúng
            nhoKhungNoi: { x: s.x, y: s.y, rong: s.rong, cao: s.cao },
            cheDo: "neo",
            benNeo: vung === "trai" ? "trai" : "phai",
            thuGon: false,
          });
        }
        return;
      }

      luu(s);
    },
    [s, luu],
  );

  // ----- Nút trên thanh tiêu đề -----

  const doiSangNeo = (ben: BenNeo) =>
    luu({
      ...s,
      ...(s.cheDo === "noi"
        ? { nhoKhungNoi: { x: s.x, y: s.y, rong: s.rong, cao: s.cao } }
        : {}),
      cheDo: "neo",
      benNeo: ben,
      thuGon: false,
    });

  const doiSangNoi = () => {
    const hinh = s.nhoKhungNoi ?? hinhMacDinh();
    luu(kepVaoManHinh({ ...s, ...hinh, cheDo: "noi", thuGon: false }));
  };

  const veMacDinh = () =>
    luu({ ...s, ...hinhMacDinh(), cheDo: "noi", thuGon: false, nhoKhungNoi: undefined });

  if (!daGanVao) return null;

  // ----- Chưa mở: nút bong bóng góc phải dưới -----
  if (!s.moRa) {
    return (
      <button
        type="button"
        onClick={() => luu({ ...s, moRa: true, thuGon: false })}
        title="Trò chuyện với trợ lý (Ctrl+K)"
        className="fixed bottom-5 right-5 z-50 flex size-12 items-center justify-center rounded-full bg-cam-600 text-white shadow-lg transition-transform hover:scale-105 hover:bg-cam-500"
      >
        <Sparkles size={20} />
      </button>
    );
  }

  // ----- Neo + thu gọn: dải dọc mảnh dính mép -----
  if (s.cheDo === "neo" && s.thuGon) {
    const MuiTen = s.benNeo === "trai" ? ChevronRight : ChevronLeft;
    return (
      <button
        type="button"
        onClick={() => luu({ ...s, thuGon: false })}
        title="Mở lại khung trò chuyện"
        style={{ width: RONG_DAI_THU_GON }}
        className={`fixed inset-y-0 z-50 flex flex-col items-center gap-3 border-neutral-800 bg-nen-menu py-4 transition-colors hover:bg-neutral-900 ${
          s.benNeo === "trai" ? "left-0 border-r" : "right-0 border-l"
        }`}
      >
        <Sparkles size={18} className="text-cam-600 dark:text-cam-500" />
        <MuiTen size={16} className="text-neutral-500" />
      </button>
    );
  }

  const dangNeo = s.cheDo === "neo";

  const kieuKhung: React.CSSProperties = dangNeo
    ? {
        position: "fixed",
        top: 0,
        bottom: 0,
        width: s.neoRong,
        ...(s.benNeo === "trai" ? { left: 0 } : { right: 0 }),
      }
    : {
        position: "fixed",
        left: s.x,
        top: s.y,
        width: s.rong,
        height: s.cao,
      };

  return (
    <>
      {/* Khung xem trước lúc kéo tới vùng dính mép */}
      {vungDinh ? (
        <div
          className="pointer-events-none fixed z-40 rounded-lg border-2 border-cam-500 bg-cam-500/10"
          style={
            vungDinh === "goc"
              ? { ...hinhMacDinhKieu() }
              : {
                  top: 0,
                  bottom: 0,
                  width: s.neoRong,
                  ...(vungDinh === "trai" ? { left: 0 } : { right: 0 }),
                }
          }
        />
      ) : null}

      <div
        ref={oPanel}
        style={{ ...kieuKhung, zIndex: 50 }}
        className={`flex flex-col overflow-hidden border-neutral-200 bg-nen-menu shadow-2xl dark:border-neutral-800 ${
          dangNeo
            ? s.benNeo === "trai"
              ? "border-r"
              : "border-l"
            : "rounded-xl border"
        }`}
      >
        {/* Tay nắm đổi kích thước — chỉ có ở chế độ nổi */}
        {!dangNeo
          ? CAC_TAY_NAM.map((t) => (
              <div
                key={t.huong}
                onPointerDown={(e) => batDauKeo(e, t.huong)}
                onPointerMove={dangKeo}
                onPointerUp={thoiKeo}
                onPointerCancel={thoiKeo}
                style={{ position: "absolute", ...t.kieu }}
              />
            ))
          : null}

        {/* Thanh kéo đổi bề rộng — chỉ có ở chế độ neo, đặt ở mép TRONG */}
        {dangNeo ? (
          <div
            onPointerDown={(e) => batDauKeo(e, "e")}
            onPointerMove={dangKeo}
            onPointerUp={thoiKeo}
            onPointerCancel={thoiKeo}
            title="Kéo để đổi bề rộng"
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              width: 5,
              cursor: "col-resize",
              zIndex: 40,
              ...(s.benNeo === "trai" ? { right: 0 } : { left: 0 }),
            }}
            className="transition-colors hover:bg-cam-500/40"
          />
        ) : null}

        {/* Thanh tiêu đề */}
        <div
          onPointerDown={(e) => batDauKeo(e, "di")}
          onPointerMove={dangKeo}
          onPointerUp={thoiKeo}
          onPointerCancel={thoiKeo}
          className="flex shrink-0 cursor-grab items-center gap-1 border-b border-neutral-200 px-3 py-2 active:cursor-grabbing dark:border-neutral-800"
        >
          <Sparkles size={15} className="shrink-0 text-cam-600 dark:text-cam-500" />
          <span className="mr-auto truncate text-sm font-medium">Trợ lý</span>

          <NutNho
            dangBat={dangNeo && s.benNeo === "trai"}
            nhan="Neo mép trái"
            onClick={() => doiSangNeo("trai")}
          >
            <PanelLeft size={14} />
          </NutNho>
          <NutNho dangBat={!dangNeo} nhan="Khung nổi" onClick={doiSangNoi}>
            <Square size={14} />
          </NutNho>
          <NutNho
            dangBat={dangNeo && s.benNeo === "phai"}
            nhan="Neo mép phải"
            onClick={() => doiSangNeo("phai")}
          >
            <PanelRight size={14} />
          </NutNho>

          <span className="mx-1 h-4 w-px bg-neutral-200 dark:bg-neutral-800" />

          <NutNho nhan="Về mặc định" onClick={veMacDinh}>
            <RotateCcw size={14} />
          </NutNho>
          <NutNho
            nhan="Mở cửa sổ riêng"
            onClick={() => {
              window.open("/tro-chuyen", "am-tro-chuyen", "width=460,height=720");
              luu({ ...s, moRa: false });
            }}
          >
            <Maximize2 size={14} />
          </NutNho>
          <NutNho
            nhan={dangNeo ? "Thu gọn thành dải" : "Thu nhỏ"}
            onClick={() =>
              dangNeo ? luu({ ...s, thuGon: true }) : luu({ ...s, moRa: false })
            }
          >
            <Minus size={14} />
          </NutNho>
          <NutNho nhan="Đóng" onClick={() => luu({ ...s, moRa: false })}>
            <X size={14} />
          </NutNho>
        </div>

        <BangTroChuyen laChu={laChu} />
      </div>
    </>
  );
}

/** Vị trí khung xem trước khi kéo vào ô góc phải dưới. */
function hinhMacDinhKieu(): React.CSSProperties {
  const h = hinhMacDinh();
  return { left: h.x, top: h.y, width: h.rong, height: h.cao };
}

function NutNho({
  children,
  nhan,
  onClick,
  dangBat,
}: {
  children: React.ReactNode;
  nhan: string;
  onClick: () => void;
  dangBat?: boolean;
}) {
  return (
    <button
      type="button"
      title={nhan}
      aria-label={nhan}
      // Chặn `pointerdown` nổi lên thanh tiêu đề, kẻo bấm nút lại thành kéo khung
      onPointerDown={(e) => e.stopPropagation()}
      onClick={onClick}
      className={`rounded-md p-1.5 transition-colors ${
        dangBat
          ? "bg-cam-100 text-cam-700 dark:text-cam-300"
          : "text-neutral-500 hover:bg-cam-50 hover:text-neutral-800 dark:hover:text-neutral-200"
      }`}
    >
      {children}
    </button>
  );
}
