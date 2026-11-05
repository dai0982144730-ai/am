"use client";

/**
 * Thẻ "Ghép app Android" của trang Vận hành.
 *
 * Bấm một nút ra một mã ngắn (dùng một lần, sống 5 phút). Gõ mã vào app Android
 * thì máy chủ cấp cho app một thẻ thiết bị, nên app không phải gõ `TOKEN_TRO_LY`.
 * Chỉ người đã đăng nhập Google đúng email chủ dự án mới tạo được mã.
 */

import { Smartphone } from "lucide-react";
import { useEffect, useState } from "react";

import { taoMaGhepApp } from "@/app/van-hanh/actions";

export function TheGhepApp({ choPhepSua }: { choPhepSua: boolean }) {
  const [ma, setMa] = useState<string | null>(null);
  const [hetHanLuc, setHetHanLuc] = useState(0);
  const [conLai, setConLai] = useState(0);
  const [dangTao, setDangTao] = useState(false);
  const [loi, setLoi] = useState<string | null>(null);

  // Đếm ngược; hết giờ thì ẩn mã đi cho khỏi nhầm là còn dùng được
  useEffect(() => {
    if (!ma) return;
    const dem = setInterval(() => {
      const s = Math.max(0, Math.round((hetHanLuc - Date.now()) / 1000));
      setConLai(s);
      if (s === 0) {
        setMa(null);
        clearInterval(dem);
      }
    }, 500);
    return () => clearInterval(dem);
  }, [ma, hetHanLuc]);

  async function tao() {
    setDangTao(true);
    setLoi(null);
    try {
      const r = await taoMaGhepApp();
      if (!r.ok || !r.ma || !r.hetHanLuc) {
        setLoi(r.message || "Không tạo được mã.");
        return;
      }
      setMa(r.ma);
      setHetHanLuc(r.hetHanLuc);
      setConLai(Math.round((r.hetHanLuc - Date.now()) / 1000));
    } catch (e) {
      setLoi(e instanceof Error ? e.message : String(e));
    } finally {
      setDangTao(false);
    }
  }

  return (
    <section>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
        Ghép app Android
      </h2>
      <p className="mt-1.5 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
        Tạo một mã rồi gõ vào app trên điện thoại (Cài đặt, mục Ghép với máy chủ).
        Ghép xong app không phải nhập token, và dùng được mục Tài khoản Claude.
      </p>

      {!choPhepSua ? (
        <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
          Cần đăng nhập Am mới tạo được mã.
        </p>
      ) : (
        <div className="mt-3">
          {ma ? (
            <div className="rounded-xl border border-cam-500/40 p-4">
              <p
                className="select-all font-mono text-3xl font-semibold tracking-widest"
                aria-label={`Mã ghép ${ma}`}
              >
                {ma}
              </p>
              <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
                Dùng một lần. Còn {Math.floor(conLai / 60)}:{String(conLai % 60).padStart(2, "0")}.
              </p>
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => void tao()}
            disabled={dangTao}
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-neutral-100 px-3.5 py-2 text-xs font-semibold text-neutral-700 transition-colors hover:bg-neutral-200 disabled:opacity-40 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
          >
            <Smartphone size={14} />
            {dangTao ? "Đang tạo…" : ma ? "Tạo mã mới" : "Tạo mã ghép app"}
          </button>
          {loi ? <p className="mt-2 text-xs text-red-600">{loi}</p> : null}
        </div>
      )}
    </section>
  );
}
