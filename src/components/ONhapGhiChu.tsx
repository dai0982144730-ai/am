"use client";

/**
 * Ô ghi chú đặt ngay dưới trình phát.
 *
 * HAI CÁCH NHẬP, ĐỀU CẦN THIẾT: gõ khi ngồi trước máy, **nói** khi đang nghe
 * kiểu audio hoặc tay đang bận. Bản thiết kế nói rõ chỗ này quan trọng — nghe
 * podcast lúc lái xe mà phải dừng lại gõ thì không ai ghi chú cả.
 *
 * Phần nhận giọng nói dùng thẳng bộ nhận dạng có sẵn trong trình duyệt: không
 * gửi âm thanh đi đâu, không tốn tiền, và không cần chỗ lưu file. Trình duyệt
 * nào không có thì nút đó tự ẩn, phần gõ vẫn chạy như thường.
 */

import { useEffect, useRef, useState, useTransition } from "react";

import { luuGhiChu } from "@/lib/ghiChu/actions";
import { hoiViTri } from "@/lib/tieuThu/viTriHienTai";

// Kiểu tối thiểu cho bộ nhận dạng giọng nói của trình duyệt — chỉ khai những
// gì thật sự dùng, vì TypeScript chưa có sẵn khai báo cho API này
interface BoNhanGiong {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: SuKienNhanGiong) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}

interface SuKienNhanGiong {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
  resultIndex: number;
}

type TaoBoNhanGiong = new () => BoNhanGiong;

function layBoNhanGiong(): TaoBoNhanGiong | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: TaoBoNhanGiong;
    webkitSpeechRecognition?: TaoBoNhanGiong;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function docPhutGiay(giay: number): string {
  const p = Math.floor(giay / 60);
  const s = Math.floor(giay % 60);
  return `${p}:${String(s).padStart(2, "0")}`;
}

export function ONhapGhiChu({
  idNoiDung,
  laChu,
}: {
  idNoiDung: string;
  laChu: boolean;
}) {
  const [chu, setChu] = useState("");
  const [dangNghe, setDangNghe] = useState(false);
  const [thongDiep, setThongDiep] = useState<string | null>(null);
  const [dangChay, batDau] = useTransition();

  const boNhan = useRef<BoNhanGiong | null>(null);
  const bangGiongNoi = useRef(false);

  // Tắt micro khi rời trang, kẻo nó nghe tiếp trong nền
  useEffect(() => () => boNhan.current?.stop(), []);

  if (!laChu) return null;

  function batTatNghe() {
    if (dangNghe) {
      boNhan.current?.stop();
      setDangNghe(false);
      return;
    }

    // Kiểm ngay lúc bấm chứ không lúc dựng trang: biết trình duyệt có nhận
    // giọng hay không thì phải chạy ở phía người dùng, mà trang này dựng sẵn
    // ở server trước. Hỏi sớm quá thì lần vẽ đầu và lần vẽ sau lệch nhau.
    const Tao = layBoNhanGiong();
    if (!Tao) {
      setThongDiep(
        "Trình duyệt này không nhận giọng nói. Dùng Chrome hoặc gõ tay.",
      );
      return;
    }

    const may = new Tao();
    may.lang = "vi-VN";
    may.continuous = true;
    may.interimResults = false;

    may.onresult = (e) => {
      let them = "";
      for (let i = e.resultIndex; i < e.results.length; i += 1) {
        them += e.results[i]?.[0]?.transcript ?? "";
      }
      if (them) {
        bangGiongNoi.current = true;
        setChu((truoc) => (truoc ? `${truoc} ${them}` : them));
      }
    };
    may.onerror = () => setDangNghe(false);
    may.onend = () => setDangNghe(false);

    boNhan.current = may;
    may.start();
    setDangNghe(true);
  }

  function ghi() {
    const giay = hoiViTri();
    boNhan.current?.stop();
    setDangNghe(false);

    batDau(async () => {
      const kq = await luuGhiChu(idNoiDung, chu, giay, bangGiongNoi.current);
      setThongDiep(kq.thongDiep);
      if (kq.ok) {
        setChu("");
        bangGiongNoi.current = false;
      }
    });
  }

  const viTri = typeof window !== "undefined" ? hoiViTri() : null;

  return (
    <section className="mt-6 rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-base font-semibold">Ghi chú</h2>
        {viTri !== null && viTri > 0 ? (
          <span className="text-xs text-neutral-400 dark:text-neutral-500">
            sẽ gắn vào khoảng {docPhutGiay(viTri)}
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
        Ghi chú được gắn đúng giây trong clip, sau này bấm vào là nhảy về đúng
        chỗ đó.
      </p>

      <textarea
        value={chu}
        onChange={(e) => setChu(e.target.value)}
        rows={3}
        placeholder={dangNghe ? "Đang nghe, cứ nói…" : "Nghĩ gì thì ghi lại…"}
        className="mt-3 w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-cam-500 dark:border-neutral-700 dark:focus:border-cam-500"
      />

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={ghi}
          disabled={dangChay || chu.trim().length < 2}
          className="rounded-lg bg-cam-600 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-40 dark:bg-cam-500 dark:text-white"
        >
          Ghi lại
        </button>

        <button
          type="button"
          onClick={batTatNghe}
          disabled={dangChay}
          className={`rounded-lg border px-3 py-1.5 text-sm transition-colors disabled:opacity-40 ${
            dangNghe
              ? "border-red-500 text-red-600 dark:text-red-400"
              : "border-neutral-300 hover:border-neutral-500 dark:border-neutral-700"
          }`}
        >
          {dangNghe ? "● Đang nghe — bấm để dừng" : "Nói thay vì gõ"}
        </button>

        {thongDiep ? (
          <span className="text-xs text-neutral-500 dark:text-neutral-400">
            {thongDiep}
          </span>
        ) : null}
      </div>
    </section>
  );
}
