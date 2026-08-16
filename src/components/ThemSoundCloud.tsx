"use client";

/**
 * Thêm kênh SoundCloud, ngay trong Cài đặt.
 *
 * ## Vì sao ô nhập là ĐƯỜNG DẪN TRANG chứ không phải RSS
 *
 * Địa chỉ RSS của một tài khoản SoundCloud có dạng
 * `feeds.soundcloud.com/users/soundcloud:users:311488968/sounds.rss` — cái mã
 * số ở giữa không hiện ở bất cứ đâu người dùng nhìn thấy được. Còn thứ ai cũng
 * sao chép được là đường dẫn trên thanh địa chỉ. Nên ô này nhận đường dẫn
 * trang, còn việc tra mã và dựng địa chỉ RSS là của máy.
 *
 * ## Vì sao phải nói trước chuyện kênh nhạc
 *
 * SoundCloud chỉ đưa vào RSS công khai những bài tác giả bật phân phối
 * podcast, mà kênh nhạc gần như không bật. Người dùng dán một kênh nhạc vào
 * đây rồi bị từ chối sẽ tưởng app hỏng — nên đoạn giải thích nằm sẵn trên ô
 * nhập, trước khi họ bấm.
 */

import { useState, useTransition } from "react";

import { boPodcast, themSoundCloud } from "@/app/cai-dat/actions";

export interface KenhSoundCloudDaThem {
  id: string;
  ten: string;
  soBai: number;
  trangChu: string | null;
}

export function ThemSoundCloud({
  daThem,
  laChu,
}: {
  daThem: KenhSoundCloudDaThem[];
  laChu: boolean;
}) {
  const [duongDan, setDuongDan] = useState("");
  const [thongDiep, setThongDiep] = useState<string | null>(null);
  const [hong, setHong] = useState(false);
  const [canhBao, setCanhBao] = useState<string | null>(null);
  const [dangChay, batDau] = useTransition();

  function them() {
    if (!duongDan.trim()) return;
    setThongDiep(null);
    setCanhBao(null);
    batDau(async () => {
      const kq = await themSoundCloud(duongDan);
      setThongDiep(kq.thongDiep);
      setHong(!kq.ok);
      setCanhBao(kq.canhBao ?? null);
      if (kq.ok) setDuongDan("");
    });
  }

  return (
    <section>
      <h2 className="text-base font-semibold">SoundCloud</h2>
      <p className="mt-2 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
        Lấy qua địa chỉ RSS công khai của SoundCloud, không qua API riêng của
        họ — API đó đã đóng cửa đăng ký từ lâu, và cách duy nhất để lách là moi
        khoá ra khỏi mã trang web, thứ vừa sai nguyên tắc vừa hỏng bất cứ lúc
        nào họ đổi khoá.
      </p>
      <p className="mt-2 rounded-lg bg-neutral-50 px-3 py-2 text-xs leading-relaxed text-neutral-600 dark:bg-neutral-900 dark:text-neutral-300">
        Đổi lại, RSS chỉ có những bài tác giả bật phân phối podcast — nên chỗ
        này <strong>hợp với kênh nói</strong> (radio, kể chuyện, trò chuyện) hơn
        là kênh nhạc. Dán một kênh nhạc vào đây thì phần lớn sẽ báo &ldquo;feed
        không có bài nào&rdquo;; đó là giới hạn của SoundCloud, không phải lỗi.
      </p>

      <div className="mt-4 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
        <label htmlFor="them-soundcloud" className="text-sm font-medium">
          Dán đường dẫn trang SoundCloud
        </label>
        <div className="mt-2 flex gap-2">
          <input
            id="them-soundcloud"
            type="text"
            value={duongDan}
            disabled={!laChu || dangChay}
            onChange={(e) => setDuongDan(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                them();
              }
            }}
            placeholder="https://soundcloud.com/ten-tai-khoan"
            className="min-w-0 flex-1 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-cam-500 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900"
          />
          <button
            type="button"
            onClick={them}
            disabled={!laChu || dangChay || !duongDan.trim()}
            className="shrink-0 rounded-lg bg-cam-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-cam-700 disabled:opacity-50"
          >
            {dangChay ? "Đang thêm…" : "Thêm"}
          </button>
        </div>

        {thongDiep ? (
          <p
            className={`mt-3 text-xs leading-relaxed ${
              hong
                ? "text-neutral-600 dark:text-neutral-300"
                : "text-cam-700 dark:text-cam-300"
            }`}
          >
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
            Đăng nhập để thêm kênh SoundCloud.
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
                    {k.soBai} bài trong kho
                  </p>
                </div>
                <button
                  type="button"
                  disabled={!laChu || dangChay}
                  onClick={() => {
                    batDau(async () => {
                      const kq = await boPodcast(k.id);
                      setThongDiep(kq.thongDiep);
                      setHong(!kq.ok);
                    });
                  }}
                  className="shrink-0 rounded-lg border border-neutral-300 px-2.5 py-1 text-xs transition-colors hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
                >
                  Bỏ
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
