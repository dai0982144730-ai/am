"use client";

/**
 * Trình phát YouTube nhúng — biết mình đang ở giây thứ mấy.
 *
 * VÌ SAO KHÔNG DÙNG THẺ IFRAME THƯỜNG: iframe trơn thì trang không hỏi được
 * video đang phát tới đâu, mà biết vị trí chính là toàn bộ mục đích của phần
 * này — để bỏ dở trên máy tính, mở điện thoại lên là nghe tiếp đúng chỗ. Phải
 * nạp thư viện IFrame API của YouTube mới hỏi được.
 *
 * NHỊP GHI: mỗi 10 giây trong lúc đang phát, cộng thêm một lần bắn cuối cùng
 * bằng `sendBeacon` lúc đóng tab. Thưa hơn thì sai lệch thấy rõ, dày hơn thì
 * ghi rác vào database mà chẳng ai cần độ chính xác từng giây.
 *
 * KHÁCH KHÔNG BỊ GHI GÌ: khi `laChu` là `false`, mọi lời gọi ghi đều bị bỏ qua
 * ngay tại đây — nhẹ máy hơn, và server cũng chặn lần nữa cho chắc.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import type { DeviceType } from "@/generated/prisma/enums";
import {
  capNhatTienDo,
  dongPhien,
  ghiSuKien,
  moPhien,
} from "@/lib/tieuThu/actions";
import { dangKyNguonViTri } from "@/lib/tieuThu/viTriHienTai";

/** Bao lâu ghi tiến độ một lần, tính bằng mili giây. */
const NHIP_GHI_MS = 10_000;

// Kiểu tối thiểu cho thư viện của YouTube — chỉ khai những gì thật sự dùng
interface TrinhPhat {
  getCurrentTime(): number;
  getDuration(): number;
  seekTo(giay: number, chinhXac: boolean): void;
  playVideo(): void;
  destroy(): void;
}

interface SuKienPhat {
  target: TrinhPhat;
  data: number;
}

interface YouTubeToanCuc {
  Player: new (
    phanTu: HTMLElement,
    tuyChon: {
      videoId: string;
      host?: string;
      playerVars?: Record<string, string | number>;
      events?: {
        onReady?: (e: { target: TrinhPhat }) => void;
        onStateChange?: (e: SuKienPhat) => void;
      };
    },
  ) => TrinhPhat;
  PlayerState: {
    ENDED: number;
    PLAYING: number;
    PAUSED: number;
  };
}

declare global {
  interface Window {
    YT?: YouTubeToanCuc;
    onYouTubeIframeAPIReady?: () => void;
  }
}

/** Nạp thư viện IFrame API một lần duy nhất cho cả trang. */
function napThuVien(): Promise<YouTubeToanCuc> {
  return new Promise((traVe) => {
    if (window.YT?.Player) {
      traVe(window.YT);
      return;
    }

    const goiTruoc = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      goiTruoc?.();
      if (window.YT) traVe(window.YT);
    };

    if (!document.getElementById("thu-vien-youtube")) {
      const the = document.createElement("script");
      the.id = "thu-vien-youtube";
      the.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(the);
    }
  });
}

function doanThietBi(): DeviceType {
  return window.innerWidth < 768 ? "mobile" : "desktop";
}

function docPhutGiay(giay: number): string {
  const g = Math.floor(giay / 3600);
  const p = Math.floor((giay % 3600) / 60);
  const s = Math.floor(giay % 60);
  const haiSo = (n: number) => String(n).padStart(2, "0");
  return g > 0 ? `${g}:${haiSo(p)}:${haiSo(s)}` : `${p}:${haiSo(s)}`;
}

export interface TrinhPhatYouTubeProps {
  maVideo: string;
  idNoiDung: string;
  tieuDe: string;
  laChu: boolean;
  /** Giây đang dở lấy từ server, để hiện lời nhắc trước khi trình phát sẵn sàng */
  viTriDangDo: number;
  /** Lần xem lại thứ mấy, `0` là lần đầu */
  soLanDaXem: number;
}

export function TrinhPhatYouTube({
  maVideo,
  idNoiDung,
  tieuDe,
  laChu,
  viTriDangDo,
  soLanDaXem,
}: TrinhPhatYouTubeProps) {
  const oChua = useRef<HTMLDivElement>(null);
  const trinhPhat = useRef<TrinhPhat | null>(null);
  const idPhien = useRef<string | null>(null);
  const giayDaXem = useRef(0);
  const dangPhat = useRef(false);
  const thietBi = useRef<DeviceType>("desktop");

  const [xemXong, setXemXong] = useState(false);

  /**
   * Mở phiên đúng lần bấm phát đầu tiên.
   *
   * Dùng cờ riêng chứ không kiểm tra `idPhien.current` vì lời gọi tạo phiên mất
   * vài trăm mili giây — bấm phát rồi tạm dừng ngay trong khoảng đó sẽ tạo hai
   * phiên cho cùng một lần xem.
   */
  const dangMoPhien = useRef(false);
  const baoDamCoPhien = useCallback(async () => {
    if (!laChu || idPhien.current || dangMoPhien.current) return;
    dangMoPhien.current = true;
    idPhien.current = await moPhien(idNoiDung, thietBi.current);
  }, [idNoiDung, laChu]);

  /** Bắn tiến độ về server. */
  const ghiTienDo = useCallback(() => {
    const may = trinhPhat.current;
    const phien = idPhien.current;
    if (!may || !phien || !laChu) return;

    void capNhatTienDo({
      idPhien: phien,
      idNoiDung,
      viTriGiay: may.getCurrentTime(),
      giayDaXem: giayDaXem.current,
      thoiLuongGiay: may.getDuration(),
      thietBi: thietBi.current,
    });
  }, [idNoiDung, laChu]);

  useEffect(() => {
    let daHuy = false;
    thietBi.current = doanThietBi();

    async function dungTrinhPhat() {
      const yt = await napThuVien();
      if (daHuy || !oChua.current) return;

      // Cho ô ghi chú hỏi giờ và tua — hai nửa của việc gắn mốc thời gian
      dangKyNguonViTri(
        () => trinhPhat.current?.getCurrentTime() ?? 0,
        (giay) => {
          trinhPhat.current?.seekTo(giay, true);
          trinhPhat.current?.playVideo();
        },
      );

      trinhPhat.current = new yt.Player(oChua.current, {
        videoId: maVideo,
        host: "https://www.youtube-nocookie.com",
        playerVars: {
          start: Math.floor(viTriDangDo),
          rel: 0,
          modestbranding: 1,
        },
        events: {
          onStateChange: (e) => {
            const may = e.target;
            const viTri = may.getCurrentTime();

            if (e.data === yt.PlayerState.PLAYING) {
              dangPhat.current = true;
              void baoDamCoPhien().then(() => {
                if (idPhien.current) {
                  void ghiSuKien(
                    idPhien.current,
                    idNoiDung,
                    "play",
                    viTri,
                    thietBi.current,
                  );
                }
              });
            } else if (e.data === yt.PlayerState.PAUSED) {
              dangPhat.current = false;
              if (idPhien.current) {
                void ghiSuKien(
                  idPhien.current,
                  idNoiDung,
                  "pause",
                  viTri,
                  thietBi.current,
                );
              }
              ghiTienDo();
            } else if (e.data === yt.PlayerState.ENDED) {
              dangPhat.current = false;
              setXemXong(true);
              if (idPhien.current) {
                void ghiSuKien(
                  idPhien.current,
                  idNoiDung,
                  "complete",
                  viTri,
                  thietBi.current,
                );
                void dongPhien(idPhien.current, true);
              }
              ghiTienDo();
            }
          },
        },
      });
    }

    void dungTrinhPhat();

    // Nhịp ghi — chỉ đếm thời gian thật sự đang phát
    const nhip = window.setInterval(() => {
      if (!dangPhat.current) return;
      giayDaXem.current += NHIP_GHI_MS / 1000;
      ghiTienDo();
    }, NHIP_GHI_MS);

    // Bắn phát cuối lúc đóng tab. `pagehide` đáng tin hơn `beforeunload` trên
    // điện thoại, nơi trình duyệt hay treo tab thay vì đóng hẳn.
    const luocRoiTrang = () => {
      const may = trinhPhat.current;
      if (!may || !laChu) return;
      navigator.sendBeacon(
        "/api/tieu-thu/roi-trang",
        new Blob(
          [
            JSON.stringify({
              idPhien: idPhien.current,
              idNoiDung,
              viTriGiay: may.getCurrentTime(),
              giayDaXem: giayDaXem.current,
              thietBi: thietBi.current,
            }),
          ],
          { type: "application/json" },
        ),
      );
    };
    window.addEventListener("pagehide", luocRoiTrang);

    return () => {
      daHuy = true;
      window.clearInterval(nhip);
      window.removeEventListener("pagehide", luocRoiTrang);
      luocRoiTrang();
      dangKyNguonViTri(null);
      trinhPhat.current?.destroy();
      trinhPhat.current = null;
    };
  }, [maVideo, idNoiDung, laChu, viTriDangDo, ghiTienDo, baoDamCoPhien]);

  return (
    <div>
      <div className="aspect-video overflow-hidden rounded-xl bg-black">
        <div ref={oChua} className="size-full" title={tieuDe} />
      </div>

      {laChu && viTriDangDo > 0 && !xemXong ? (
        <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
          Đang tiếp tục từ {docPhutGiay(viTriDangDo)} — chỗ bạn dừng lần trước.
        </p>
      ) : null}

      {laChu && soLanDaXem > 0 ? (
        <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
          Bạn đã xem xong cái này {soLanDaXem} lần trước đó.
        </p>
      ) : null}

      {!laChu ? (
        <p className="mt-2 text-xs text-neutral-400 dark:text-neutral-500">
          Đăng nhập để máy nhớ chỗ đang xem dở và hiểu dần gu của bạn.
        </p>
      ) : null}
    </div>
  );
}
