"use client";

/**
 * Tìm và thêm kênh podcast, ngay trong Cài đặt.
 *
 * ## Vì sao là ô tìm theo TÊN, không phải ô dán đường dẫn
 *
 * Bản đầu tôi định làm ô "dán đường dẫn RSS vào đây" — và đó là một yêu cầu vô
 * lý với người không phải lập trình viên. Đường dẫn RSS gần như không bao giờ
 * hiện ra chỗ nào cho người dùng thường nhìn thấy; muốn lấy được phải mở mã
 * nguồn trang hoặc biết mẹo riêng.
 *
 * Apple có API tra cứu podcast miễn phí và không cần khoá, trả thẳng ra đường
 * dẫn feed. Nên chủ nhà chỉ cần gõ cái tên mình nghe được ở đâu đó, còn việc đi
 * tìm là của máy.
 *
 * Ô dán đường dẫn vẫn giữ, nằm dưới, cho podcast không có trên Apple.
 */

import { useState, useTransition } from "react";

import { boPodcast, themPodcast, timPodcastTheoTen } from "@/app/cai-dat/actions";
import type { KetQuaTim } from "@/lib/nguon/podcast";

export interface KenhDaThem {
  id: string;
  ten: string;
  soTap: number;
  duongDanFeed: string;
}

export function ThemPodcast({
  daThem,
  laChu,
}: {
  daThem: KenhDaThem[];
  laChu: boolean;
}) {
  const [tuKhoa, setTuKhoa] = useState("");
  const [ketQua, setKetQua] = useState<KetQuaTim[] | null>(null);
  const [duongDanTay, setDuongDanTay] = useState("");
  const [thongDiep, setThongDiep] = useState<string | null>(null);
  const [canhBao, setCanhBao] = useState<string | null>(null);
  const [dangChay, batDau] = useTransition();

  const daCo = new Set(daThem.map((k) => k.duongDanFeed));

  function tim() {
    if (tuKhoa.trim().length < 2) return;
    setThongDiep(null);
    setCanhBao(null);
    batDau(async () => {
      const kq = await timPodcastTheoTen(tuKhoa);
      setKetQua(kq.ketQua);
      if (kq.thongDiep) setThongDiep(kq.thongDiep);
    });
  }

  function them(duongDan: string) {
    setThongDiep(null);
    setCanhBao(null);
    batDau(async () => {
      const kq = await themPodcast(duongDan);
      setThongDiep(kq.thongDiep);
      setCanhBao(kq.canhBao ?? null);
      if (kq.ok) {
        setKetQua(null);
        setTuKhoa("");
        setDuongDanTay("");
      }
    });
  }

  return (
    <section className="mt-10">
      <h2 className="text-base font-semibold">Podcast</h2>
      <p className="mt-2 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
        Podcast tiếng Việt là loại nội dung <strong>rẻ nhất và hợp nhất</strong>{" "}
        với Am: đã sẵn là giọng người thật nói tiếng Việt nên nghe thẳng được
        trong app, không phải dịch, không phải nhờ máy đọc lại, không tiêu một ký
        tự nào trong hạn mức giọng đọc.
      </p>

      <div className="mt-4 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
        <label
          htmlFor="tim-podcast"
          className="text-sm font-medium"
        >
          Tìm kênh theo tên
        </label>
        <p className="mt-1 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
          Gõ tên podcast bạn nghe được ở đâu đó — Am tự đi tìm địa chỉ của nó.
        </p>

        <div className="mt-2 flex gap-2">
          <input
            id="tim-podcast"
            type="text"
            value={tuKhoa}
            disabled={!laChu || dangChay}
            onChange={(e) => setTuKhoa(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                tim();
              }
            }}
            placeholder="ví dụ: Have A Sip"
            className="min-w-0 flex-1 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-cam-500 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900"
          />
          <button
            type="button"
            onClick={tim}
            disabled={!laChu || dangChay || tuKhoa.trim().length < 2}
            className="shrink-0 rounded-lg bg-cam-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-cam-700 disabled:opacity-50"
          >
            {dangChay ? "Đang tìm…" : "Tìm"}
          </button>
        </div>

        {ketQua && ketQua.length > 0 ? (
          <ul className="mt-3 grid gap-2">
            {ketQua.map((k) => {
              const coRoi = daCo.has(k.duongDanFeed);
              return (
                <li
                  key={k.duongDanFeed}
                  className="flex items-center gap-3 rounded-lg border border-neutral-200 p-2.5 dark:border-neutral-800"
                >
                  {k.anhBia ? (
                    // Ảnh nằm trên CDN riêng của từng kênh, không khai trước
                    // được cho `next/image`
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={k.anhBia}
                      alt=""
                      className="size-12 shrink-0 rounded object-cover"
                    />
                  ) : null}

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{k.ten}</p>
                    <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">
                      {k.tacGia ?? "—"}
                      {k.soTap ? ` · ${k.soTap} tập` : ""}
                      {k.theLoai ? ` · ${k.theLoai}` : ""}
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={!laChu || dangChay || coRoi}
                    onClick={() => them(k.duongDanFeed)}
                    className="shrink-0 rounded-lg border border-cam-600 px-3 py-1.5 text-xs font-medium text-cam-700 transition-colors hover:bg-cam-50 disabled:opacity-40 dark:text-cam-400 dark:hover:bg-neutral-800"
                  >
                    {coRoi ? "Đã có" : "Thêm"}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}

        <details className="mt-4">
          <summary className="cursor-pointer text-xs text-neutral-500 dark:text-neutral-400">
            Không tìm thấy? Dán địa chỉ feed vào đây
          </summary>
          <div className="mt-2 flex gap-2">
            <input
              type="url"
              value={duongDanTay}
              disabled={!laChu || dangChay}
              onChange={(e) => setDuongDanTay(e.target.value)}
              placeholder="https://…/podcast/rss"
              className="min-w-0 flex-1 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-cam-500 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900"
            />
            <button
              type="button"
              onClick={() => them(duongDanTay)}
              disabled={!laChu || dangChay || !duongDanTay.trim()}
              className="shrink-0 rounded-lg border border-neutral-300 px-4 py-2 text-sm transition-colors hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
            >
              Thêm
            </button>
          </div>
        </details>

        {thongDiep ? (
          <p className="mt-3 text-xs leading-relaxed text-cam-700 dark:text-cam-300">
            {thongDiep}
          </p>
        ) : null}

        {canhBao ? (
          <p className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-xs leading-relaxed text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
            {canhBao}
          </p>
        ) : null}

        {!laChu ? (
          <p className="mt-2 text-xs text-neutral-400">
            Đăng nhập để thêm kênh podcast.
          </p>
        ) : null}
      </div>

      {daThem.length > 0 ? (
        <div className="mt-4">
          <p className="text-sm font-medium">
            Kênh đang theo dõi ({daThem.length})
          </p>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {daThem.map((k) => (
              <li
                key={k.id}
                className="flex items-center gap-3 rounded-lg border border-neutral-200 p-3 dark:border-neutral-800"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{k.ten}</p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    {k.soTap} tập trong kho
                  </p>
                </div>
                <button
                  type="button"
                  disabled={!laChu || dangChay}
                  onClick={() => {
                    batDau(async () => {
                      const kq = await boPodcast(k.id);
                      setThongDiep(kq.thongDiep);
                    });
                  }}
                  className="shrink-0 text-xs text-neutral-400 transition-colors hover:text-red-600 disabled:opacity-40"
                >
                  Bỏ
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
            Bỏ một kênh sẽ xoá luôn các tập của kênh đó khỏi kho, kể cả tập bạn
            đã nghe dở.
          </p>
        </div>
      ) : null}
    </section>
  );
}
