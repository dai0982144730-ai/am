"use client";

/**
 * Thẻ "Tài khoản Claude" của trang Vận hành: đăng nhập Claude ngay trên web,
 * không cần mở terminal của máy chủ.
 *
 * Ba bước, mỗi bước một cú bấm hoặc một lần dán:
 *   ① Bấm "Đăng nhập Claude" → hiện link.
 *   ② Mở link, đăng nhập Claude trên máy hoặc điện thoại → trang Claude hiện mã.
 *   ③ Dán mã vào ô → dán xong là tự gửi, không có nút xác nhận thừa.
 *
 * MẸO QUAN TRỌNG: tab mới phải mở NGAY trong cú bấm (`about:blank`), rồi mới gán
 * link vào khi máy chủ trả về. Đợi có link mới mở tab thì trình duyệt coi là
 * popup không do người dùng bấm và chặn mất.
 */

import { AlertTriangle, CheckCircle2, LogOut, Zap } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import {
  dangXuatClaude,
  docTrangThaiClaude,
  huyDangNhapClaude,
  moDangNhapClaude,
  nhapMaDangNhapClaude,
  thuTroLyClaude,
  type KetQuaClaude,
} from "@/app/van-hanh/actions";
import type { TrangThaiClaude } from "@/lib/llm/dangNhapClaude";

/** Cùng bộ ký tự với `chuanHoaMa` ở máy chủ; dán chuỗi trông như mã thì tự gửi. */
const RE_MA = /^[A-Za-z0-9_\-.~#=%/+]{20,2000}$/;

const NUT =
  "inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors disabled:opacity-40";
const NUT_CHINH = `${NUT} bg-cam-600 text-white hover:opacity-90 dark:bg-cam-500`;
const NUT_PHU = `${NUT} bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700`;

type Ban = "" | "mo" | "ma" | "thu" | "kiem" | "xuat";

export function TheTaiKhoanClaude({ choPhepSua }: { choPhepSua: boolean }) {
  const [tt, setTt] = useState<TrangThaiClaude | null>(null);
  const [ban, setBan] = useState<Ban>("");
  const [link, setLink] = useState<string | null>(null);
  const [daMoTab, setDaMoTab] = useState(false);
  const [ma, setMa] = useState("");
  const [kq, setKq] = useState<{ ok: boolean; chu: string } | null>(null);

  const taiTrangThai = useCallback(async () => {
    try {
      setTt(await docTrangThaiClaude());
    } catch (e) {
      setKq({ ok: false, chu: loiChu(e) });
    }
  }, []);

  // Lần đầu mở trang: hỏi trạng thái. Việc đặt state nằm trong .then để không
  // gây vòng vẽ lại ngay trong effect.
  useEffect(() => {
    if (!choPhepSua) return;
    let huyBo = false;
    docTrangThaiClaude()
      .then((t) => {
        if (!huyBo) setTt(t);
      })
      .catch((e) => {
        if (!huyBo) setKq({ ok: false, chu: loiChu(e) });
      });
    return () => {
      huyBo = true;
    };
  }, [choPhepSua]);

  async function dangNhap() {
    setKq(null);
    const tab = window.open("about:blank", "_blank");
    setBan("mo");
    try {
      const r = await moDangNhapClaude();
      if (!r.ok || !r.url) {
        tab?.close();
        setKq({ ok: false, chu: r.message || "Không lấy được link đăng nhập." });
        return;
      }
      let moDuoc = false;
      if (tab) {
        try {
          tab.opener = null;
          tab.location.href = r.url;
          moDuoc = true;
        } catch {
          // Tab bị chặn: vẫn còn link bấm tay trong khung bên dưới
        }
      }
      setDaMoTab(moDuoc);
      setLink(r.url);
      setMa("");
    } catch (e) {
      tab?.close();
      setKq({ ok: false, chu: loiChu(e) });
    } finally {
      setBan("");
    }
  }

  async function nhapMa(giaTri: string) {
    if (!giaTri.trim() || ban) return;
    setBan("ma");
    setKq(null);
    try {
      const r = await nhapMaDangNhapClaude(giaTri);
      setKq({
        ok: r.ok,
        chu: r.message || (r.ok ? "Đã đăng nhập." : "Đăng nhập không thành công."),
      });
      // Thành công hay mã sai thì lượt trên máy chủ đều đã đóng → về nút Đăng nhập
      setLink(null);
      setMa("");
      if (r.ok) await taiTrangThai();
    } catch (e) {
      setKq({ ok: false, chu: loiChu(e) });
    } finally {
      setBan("");
    }
  }

  async function huy() {
    setLink(null);
    setMa("");
    try {
      await huyDangNhapClaude();
    } catch {
      // Lượt chờ tự tắt sau 15 phút
    }
  }

  async function lam(viec: "thu" | "kiem" | "xuat") {
    setBan(viec);
    setKq(null);
    try {
      if (viec === "kiem") {
        await taiTrangThai();
        setKq({
          ok: true,
          chu: "Đã kiểm tra lại. Lưu ý: kiểm nhanh chỉ nhìn file đăng nhập, không biết mã còn hiệu lực. Muốn chắc thì bấm Thử trợ lý.",
        });
      } else {
        const r: KetQuaClaude = viec === "thu" ? await thuTroLyClaude() : await dangXuatClaude();
        setKq({ ok: r.ok, chu: r.message });
        if (viec === "xuat") await taiTrangThai();
      }
    } catch (e) {
      setKq({ ok: false, chu: loiChu(e) });
    } finally {
      setBan("");
    }
  }

  if (!choPhepSua) {
    return (
      <section>
        <Tieu />
        <p className="mt-1.5 text-xs text-neutral-500 dark:text-neutral-400">
          Cần đăng nhập Am mới xem và đổi được tài khoản Claude.
        </p>
      </section>
    );
  }

  return (
    <section>
      <Tieu />
      <p className="mt-1.5 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
        Am gọi Claude qua gói đăng ký, không qua khoá API. Đăng nhập tại đây thì
        không phải mở terminal của máy chủ. Chưa đăng nhập riêng thì Am dùng tài
        khoản Claude mặc định của máy.
      </p>

      <div className="mt-3 rounded-xl border border-neutral-200 p-4 text-xs dark:border-neutral-800">
        {!tt ? (
          <p className="text-neutral-500">Đang kiểm tra…</p>
        ) : !tt.daCaiCli ? (
          <p>
            <b>Máy chủ chưa có Claude CLI.</b> Cài bằng{" "}
            <code>npm install -g @anthropic-ai/claude-code</code> rồi tải lại trang.
          </p>
        ) : tt.daDangNhap ? (
          <p className="flex items-start gap-2">
            <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-green-600" />
            <span>
              <b>Đã đăng nhập</b>
              {tt.email ? `: ${tt.email}` : ""}
              {tt.goi ? ` · gói ${tt.goi}` : ""}
              <br />
              <span className="text-neutral-500 dark:text-neutral-400">
                {tt.dungTaiKhoanRieng
                  ? "Đăng nhập riêng của Am."
                  : "Đang mượn tài khoản mặc định của máy. Đăng nhập riêng nếu muốn Am chạy độc lập."}
              </span>
            </span>
          </p>
        ) : (
          <p>
            <b>Chưa đăng nhập.</b> Bấm “Đăng nhập Claude” bên dưới. Mở được trên
            máy tính hoặc điện thoại.
          </p>
        )}
      </div>

      {link ? (
        <div className="mt-3 rounded-xl border border-cam-500/40 p-4 text-xs leading-relaxed">
          <p>
            <b>①</b> {daMoTab ? "Trang đăng nhập Claude đã mở ở tab mới." : "Bấm link để mở trang đăng nhập Claude."}{" "}
            {daMoTab ? "Không thấy tab? " : ""}
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-cam-600 underline dark:text-cam-500"
            >
              Mở trang đăng nhập Claude ↗
            </a>
          </p>
          <p className="mt-1.5">
            <b>②</b> Đăng nhập xong, trang Claude hiện một mã. Bấm chép mã (Copy
            Code) rồi dán vào ô dưới. Dán xong là tự gửi.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              id="ma-dang-nhap-claude"
              autoComplete="off"
              spellCheck={false}
              className="min-w-0 flex-1 rounded-lg border border-neutral-300 px-3 py-1.5 font-mono text-xs outline-none focus:border-cam-500 dark:border-neutral-700 dark:bg-neutral-900"
              placeholder="Dán mã trang Claude hiện ra"
              value={ma}
              disabled={ban === "ma"}
              onChange={(e) => setMa(e.target.value)}
              onPaste={(e) => {
                const dan = e.clipboardData.getData("text").replace(/\s+/g, "");
                if (RE_MA.test(dan)) {
                  e.preventDefault();
                  setMa(dan);
                  void nhapMa(dan);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") void nhapMa(ma);
              }}
              aria-label="Mã đăng nhập Claude"
            />
            <button
              type="button"
              className={NUT_CHINH}
              disabled={ban === "ma" || !ma.trim()}
              onClick={() => void nhapMa(ma)}
            >
              {ban === "ma" ? "Đang xác nhận…" : "Xong"}
            </button>
            <button type="button" className={NUT_PHU} disabled={ban === "ma"} onClick={() => void huy()}>
              Huỷ
            </button>
          </div>
          <p className="mt-1.5 text-neutral-500 dark:text-neutral-400">
            Link dùng được 15 phút; mỗi mã chỉ dùng một lần.
          </p>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {tt?.daCaiCli ? (
            <button type="button" className={NUT_CHINH} disabled={!!ban} onClick={() => void dangNhap()}>
              {ban === "mo"
                ? "Đang lấy link…"
                : tt.daDangNhap && tt.dungTaiKhoanRieng
                  ? "Đăng nhập lại"
                  : tt.daDangNhap
                    ? "Đăng nhập tài khoản riêng"
                    : "Đăng nhập Claude"}
            </button>
          ) : null}
          {tt?.daDangNhap ? (
            <>
              <button type="button" className={NUT_PHU} disabled={!!ban} onClick={() => void lam("thu")}>
                <Zap size={14} />
                {ban === "thu" ? "Đang hỏi thử…" : "Thử trợ lý"}
              </button>
              <button type="button" className={NUT_PHU} disabled={!!ban} onClick={() => void lam("kiem")}>
                {ban === "kiem" ? "Đang kiểm tra…" : "Kiểm nhanh"}
              </button>
            </>
          ) : null}
          {tt?.dungTaiKhoanRieng ? (
            <button type="button" className={NUT_PHU} disabled={!!ban} onClick={() => void lam("xuat")}>
              <LogOut size={14} />
              Đăng xuất
            </button>
          ) : null}
        </div>
      )}

      {kq ? (
        <p
          className={`mt-3 flex items-start gap-2 rounded-lg border px-3 py-2.5 text-xs ${
            kq.ok ? "border-green-600/40" : "border-red-600/40"
          }`}
        >
          {kq.ok ? (
            <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-green-600" />
          ) : (
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-red-600" />
          )}
          <span>{kq.chu}</span>
        </p>
      ) : null}
    </section>
  );
}

function Tieu() {
  return (
    <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
      Tài khoản Claude
    </h2>
  );
}

function loiChu(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
