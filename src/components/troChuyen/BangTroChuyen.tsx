"use client";

/**
 * Phần ruột của khung trò chuyện: danh sách lượt nói, ô nhập, danh sách nguồn.
 *
 * Tách khỏi `KhungTroChuyen` có chủ đích: file kia lo chuyện hình học — kéo,
 * thả, neo, đổi kích thước — còn file này lo chuyện trò chuyện. Gộp lại thì một
 * file hai nghìn dòng, sửa chỗ nào cũng sợ đụng chỗ khác.
 *
 * ## Vì sao câu trả lời luôn kèm danh sách nguồn
 *
 * Trợ lý chỉ được phép dựa vào kho của chủ nhà, không trả lời bằng kiến thức
 * chung. Hiện thẳng ra nó đã đọc những gì thì chủ nhà kiểm được ngay, và bấm
 * vào là mở đúng nội dung đó ra nghe — trả lời xong mà không nghe được thì mới
 * đi được nửa đường.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUp, Loader2 } from "lucide-react";

import type { NguonDanRa } from "@/lib/troChuyen/traLoi";

interface Luot {
  vaiTro: "nguoi" | "may";
  chu: string;
  nguon?: NguonDanRa[];
  loi?: boolean;
}

/** Câu gợi ý lúc chưa có gì, để không phải nghĩ xem hỏi gì trước. */
const GOI_Y = [
  "Hôm nay có gì đáng nghe?",
  "Tóm tắt mấy bài AI mới nhất",
  "Có podcast nào hay không?",
  "Thứ gì điểm cao nhất trong kho?",
];

export function BangTroChuyen({ laChu }: { laChu: boolean }) {
  const [cacLuot, datCacLuot] = useState<Luot[]>([]);
  const [chu, datChu] = useState("");
  const [dangHoi, datDangHoi] = useState(false);
  const oCuon = useRef<HTMLDivElement>(null);
  const oNhap = useRef<HTMLTextAreaElement>(null);

  // Luôn cuộn xuống lượt mới nhất
  useEffect(() => {
    oCuon.current?.scrollTo({ top: oCuon.current.scrollHeight, behavior: "smooth" });
  }, [cacLuot, dangHoi]);

  async function gui(cauHoi: string) {
    const cau = cauHoi.trim();
    if (!cau || dangHoi) return;

    // Chụp lại mạch cũ TRƯỚC khi thêm lượt mới — gửi kèm câu vừa hỏi thì
    // Claude thấy nó hai lần
    const machCu = cacLuot.map((l) => ({ vaiTro: l.vaiTro, chu: l.chu }));

    datCacLuot((truoc) => [...truoc, { vaiTro: "nguoi", chu: cau }]);
    datChu("");
    datDangHoi(true);

    try {
      const ph = await fetch("/api/tro-chuyen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cauHoi: cau, lichSu: machCu }),
      });
      const du = await ph.json();

      if (!ph.ok) {
        datCacLuot((truoc) => [
          ...truoc,
          { vaiTro: "may", chu: du.loi ?? "Trợ lý gặp trục trặc.", loi: true },
        ]);
      } else {
        datCacLuot((truoc) => [
          ...truoc,
          { vaiTro: "may", chu: du.traLoi, nguon: du.nguon ?? [] },
        ]);
      }
    } catch (e) {
      datCacLuot((truoc) => [
        ...truoc,
        {
          vaiTro: "may",
          chu: `Không gọi được trợ lý: ${e instanceof Error ? e.message : e}`,
          loi: true,
        },
      ]);
    } finally {
      datDangHoi(false);
      oNhap.current?.focus();
    }
  }

  return (
    <>
      <div ref={oCuon} className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
        {cacLuot.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-2 text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-cam-100 text-lg font-semibold text-cam-700 dark:text-cam-300">
              Am
            </div>
            <p className="text-sm font-medium leading-relaxed">
              Hỏi tôi về những gì có trong kho của bạn
            </p>
            <p className="text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
              Tôi chỉ trả lời dựa trên nội dung đã quét về. Hỏi kiến thức chung
              thì bạn dùng Google nhanh hơn.
            </p>

            <div className="mt-1 flex flex-wrap justify-center gap-1.5">
              {GOI_Y.map((g) => (
                <button
                  key={g}
                  type="button"
                  disabled={!laChu}
                  onClick={() => gui(g)}
                  className="rounded-full border border-neutral-200 px-3 py-1.5 text-xs transition-colors hover:border-cam-500 hover:text-cam-700 disabled:opacity-40 dark:border-neutral-800 dark:hover:text-cam-300"
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {cacLuot.map((l, i) => (
              <div
                key={i}
                className={l.vaiTro === "nguoi" ? "flex justify-end" : ""}
              >
                {l.vaiTro === "nguoi" ? (
                  <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-cam-600 px-3 py-2 text-sm leading-relaxed text-white">
                    {l.chu}
                  </p>
                ) : (
                  <div>
                    <p
                      className={`whitespace-pre-wrap text-sm leading-relaxed ${
                        l.loi
                          ? "text-red-600 dark:text-red-400"
                          : "text-neutral-800 dark:text-neutral-200"
                      }`}
                    >
                      {l.chu}
                    </p>

                    {l.nguon && l.nguon.length > 0 ? (
                      <div className="mt-2.5">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                          Tôi đã đọc
                        </p>
                        <div className="mt-1.5 flex flex-col gap-1">
                          {l.nguon.map((n) => (
                            <Link
                              key={n.id}
                              href={`/xem/${n.id}`}
                              className="group rounded-lg border border-neutral-200 px-2.5 py-1.5 transition-colors hover:border-cam-500 dark:border-neutral-800"
                            >
                              <span className="block truncate text-xs font-medium group-hover:text-cam-700 dark:group-hover:text-cam-300">
                                {n.tieuDe}
                              </span>
                              <span className="block truncate text-[11px] text-neutral-500 dark:text-neutral-400">
                                {n.kenh}
                                {n.diem != null
                                  ? ` · ${n.diem.toFixed(1)} điểm`
                                  : ""}
                              </span>
                            </Link>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            ))}

            {dangHoi ? (
              <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                <Loader2 size={14} className="animate-spin" />
                Đang đọc trong kho…
              </div>
            ) : null}
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-neutral-200 p-3 dark:border-neutral-800">
        <div className="flex items-end gap-2 rounded-2xl border border-neutral-200 bg-background px-3 py-2 focus-within:border-cam-500 dark:border-neutral-800">
          <textarea
            ref={oNhap}
            rows={1}
            value={chu}
            disabled={!laChu || dangHoi}
            placeholder={laChu ? "Nhắn cho trợ lý…" : "Đăng nhập để trò chuyện"}
            onChange={(e) => {
              datChu(e.target.value);
              // Ô nhập cao dần theo nội dung, trần 6 dòng
              e.target.style.height = "auto";
              e.target.style.height = `${Math.min(e.target.scrollHeight, 132)}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                gui(chu);
              }
            }}
            className="max-h-[132px] min-w-0 flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-neutral-400 disabled:opacity-60"
          />
          <button
            type="button"
            onClick={() => gui(chu)}
            disabled={!laChu || dangHoi || !chu.trim()}
            aria-label="Gửi"
            className="mb-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-cam-600 text-white transition-colors hover:bg-cam-500 disabled:opacity-30"
          >
            <ArrowUp size={15} />
          </button>
        </div>
        <p className="mt-1.5 text-center text-[11px] text-neutral-400 dark:text-neutral-500">
          Enter gửi · Shift+Enter xuống dòng · Ctrl+K bật/tắt
        </p>
      </div>
    </>
  );
}
