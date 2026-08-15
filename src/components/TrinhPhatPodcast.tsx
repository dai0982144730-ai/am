"use client";

/**
 * Trình phát tập podcast — phát thẳng file tiếng gốc của tác giả.
 *
 * ## Khác gì `TrinhPhatAmThanh`
 *
 * `TrinhPhatAmThanh` phát bản do máy đọc: file ngắn, nghe một lần, không cần
 * nhớ chỗ. Còn một tập podcast dài hai ba chục phút — nghe dở giữa chừng là
 * chuyện thường, nên trình phát này phải làm đủ những việc mà trình phát
 * YouTube làm: mở phiên, ghi tiến độ, nhớ chỗ dừng, đóng phiên khi nghe hết.
 *
 * ## Vì sao dùng thẻ `<audio>` chứ không tự vẽ
 *
 * Thẻ sẵn có của trình duyệt hiện được lên **màn hình khoá điện thoại** — nghe
 * podcast lúc đi đường mà phải mở máy ra mới tạm dừng được thì hỏng. Tự dựng
 * lại thì mất thứ đó.
 *
 * ## Không tốn một ký tự TTS nào
 *
 * Đây là giọng người thật do chính tác giả thu. Podcast tiếng Việt đã sẵn là
 * âm thanh tiếng Việt — không dịch, không đọc lại, không đụng tới hạn mức.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { CAC_MUC_TOC_DO, docTocDo } from "@/components/TrinhPhatAmThanh";
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

export function TrinhPhatPodcast({
  duongDanAmThanh,
  idNoiDung,
  tieuDe,
  anhBia,
  tenKenh,
  laChu,
  viTriDangDo,
  soLanDaXem,
  tocDoMacDinh = 1,
}: {
  duongDanAmThanh: string;
  idNoiDung: string;
  tieuDe: string;
  anhBia: string | null;
  tenKenh: string;
  laChu: boolean;
  viTriDangDo: number;
  soLanDaXem: number;
  tocDoMacDinh?: number;
}) {
  const may = useRef<HTMLAudioElement>(null);
  const idPhien = useRef<string | null>(null);
  const giayDaNghe = useRef(0);
  const dangPhat = useRef(false);
  const thietBi = useRef<DeviceType>("desktop");
  const daNhayToiChoDo = useRef(false);

  const [tocDo, setTocDo] = useState(tocDoMacDinh);
  const [ngheXong, setNgheXong] = useState(false);

  /**
   * Mở phiên đúng lần bấm phát đầu tiên.
   *
   * Cờ riêng chứ không kiểm `idPhien.current`: lời gọi tạo phiên mất vài trăm
   * mili giây, bấm phát rồi tạm dừng ngay trong khoảng đó sẽ tạo hai phiên cho
   * cùng một lần nghe. Đúng cái bẫy đã gặp ở trình phát YouTube.
   */
  const dangMoPhien = useRef(false);
  const baoDamCoPhien = useCallback(async () => {
    if (!laChu || idPhien.current || dangMoPhien.current) return;
    dangMoPhien.current = true;
    idPhien.current = await moPhien(idNoiDung, thietBi.current);
  }, [idNoiDung, laChu]);

  const ghiTienDo = useCallback(() => {
    const m = may.current;
    const phien = idPhien.current;
    if (!m || !phien || !laChu) return;

    void capNhatTienDo({
      idPhien: phien,
      idNoiDung,
      viTriGiay: m.currentTime,
      giayDaXem: giayDaNghe.current,
      // File chưa nạp xong thì `duration` là NaN — gửi 0 thay vì gửi rác
      thoiLuongGiay: Number.isFinite(m.duration) ? m.duration : 0,
      thietBi: thietBi.current,
    });
  }, [idNoiDung, laChu]);

  useEffect(() => {
    thietBi.current = doanThietBi();

    // Cho ô ghi chú hỏi giờ và tua — ghi chú gắn mốc thời gian trên một tập
    // podcast nửa tiếng còn đáng giá hơn trên video ngắn
    dangKyNguonViTri(
      () => may.current?.currentTime ?? 0,
      (giay) => {
        if (!may.current) return;
        may.current.currentTime = giay;
        void may.current.play();
      },
    );

    const nhip = window.setInterval(() => {
      if (!dangPhat.current) return;
      giayDaNghe.current += NHIP_GHI_MS / 1000;
      ghiTienDo();
    }, NHIP_GHI_MS);

    // Bắn phát cuối lúc đóng tab. `pagehide` đáng tin hơn `beforeunload` trên
    // điện thoại, nơi trình duyệt hay treo tab thay vì đóng hẳn.
    const luocRoiTrang = () => {
      const m = may.current;
      if (!m || !laChu) return;
      navigator.sendBeacon(
        "/api/tieu-thu/roi-trang",
        new Blob(
          [
            JSON.stringify({
              idPhien: idPhien.current,
              idNoiDung,
              viTriGiay: m.currentTime,
              giayDaXem: giayDaNghe.current,
              thietBi: thietBi.current,
            }),
          ],
          { type: "application/json" },
        ),
      );
    };
    window.addEventListener("pagehide", luocRoiTrang);

    return () => {
      window.clearInterval(nhip);
      window.removeEventListener("pagehide", luocRoiTrang);
      luocRoiTrang();
      dangKyNguonViTri(null);
    };
  }, [idNoiDung, laChu, ghiTienDo]);

  return (
    <div className="overflow-hidden rounded-xl border border-cam-300 bg-cam-50/60 dark:border-cam-700/50 dark:bg-neutral-900">
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
        {anhBia ? (
          // Ảnh bìa lấy từ máy chủ của podcast nên dùng thẻ `img` thường — cấu
          // hình `next/image` phải khai trước từng tên miền, mà mỗi kênh
          // podcast lại nằm trên một CDN khác nhau, không liệt kê hết được.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={anhBia}
            alt=""
            className="size-28 shrink-0 rounded-lg object-cover shadow-sm"
          />
        ) : null}

        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-cam-700 dark:text-cam-400">
            Tập podcast · giọng người thật
          </p>
          <p className="mt-1 truncate text-sm font-medium">{tieuDe}</p>
          <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">
            {tenKenh}
          </p>
        </div>
      </div>

      <div className="px-4 pb-4">
        {/* `preload="metadata"`: đủ để hiện tổng thời lượng mà chưa tải file
            nặng vài chục MB về. Mở trang không có nghĩa là sẽ nghe. */}
        <audio
          ref={may}
          controls
          preload="metadata"
          src={duongDanAmThanh}
          className="w-full"
          onLoadedMetadata={() => {
            const m = may.current;
            if (!m) return;
            // Chrome trả `playbackRate` về 1 mỗi lần nạp nguồn mới
            m.playbackRate = tocDo;
            // Nhảy tới chỗ nghe dở đúng MỘT lần. Không có cờ này thì mỗi lần
            // trình duyệt nạp lại metadata là bị kéo ngược về chỗ cũ, kể cả
            // khi người nghe vừa tự tua đi chỗ khác.
            if (!daNhayToiChoDo.current && viTriDangDo > 0) {
              daNhayToiChoDo.current = true;
              m.currentTime = viTriDangDo;
            }
          }}
          onPlay={() => {
            dangPhat.current = true;
            void baoDamCoPhien().then(() => {
              if (idPhien.current) {
                void ghiSuKien(
                  idPhien.current,
                  idNoiDung,
                  "play",
                  may.current?.currentTime ?? 0,
                  thietBi.current,
                );
              }
            });
          }}
          onPause={() => {
            dangPhat.current = false;
            if (idPhien.current) {
              void ghiSuKien(
                idPhien.current,
                idNoiDung,
                "pause",
                may.current?.currentTime ?? 0,
                thietBi.current,
              );
            }
            ghiTienDo();
          }}
          onEnded={() => {
            dangPhat.current = false;
            setNgheXong(true);
            if (idPhien.current) {
              void ghiSuKien(
                idPhien.current,
                idNoiDung,
                "complete",
                may.current?.currentTime ?? 0,
                thietBi.current,
              );
              void dongPhien(idPhien.current, true);
            }
            ghiTienDo();
          }}
        >
          Trình duyệt này không phát được âm thanh.
        </audio>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-neutral-500 dark:text-neutral-400">
            Tốc độ
          </span>
          {CAC_MUC_TOC_DO.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setTocDo(m);
                if (may.current) may.current.playbackRate = m;
              }}
              className={`rounded-md px-2 py-0.5 text-xs tabular-nums transition-colors ${
                Math.abs(m - tocDo) < 0.001
                  ? "bg-cam-600 font-medium text-white"
                  : "text-neutral-600 hover:bg-cam-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
              }`}
            >
              {docTocDo(m)}
            </button>
          ))}
        </div>

        {laChu && viTriDangDo > 0 && !ngheXong ? (
          <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
            Đang tiếp tục từ {docPhutGiay(viTriDangDo)} — chỗ bạn dừng lần trước.
          </p>
        ) : null}

        {laChu && soLanDaXem > 0 ? (
          <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
            Bạn đã nghe xong tập này {soLanDaXem} lần trước đó.
          </p>
        ) : null}

        {!laChu ? (
          <p className="mt-2 text-xs text-neutral-400 dark:text-neutral-500">
            Đăng nhập để máy nhớ chỗ đang nghe dở.
          </p>
        ) : null}
      </div>
    </div>
  );
}
