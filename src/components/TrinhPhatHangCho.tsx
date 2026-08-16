"use client";

/**
 * Trình phát hàng chờ — nghe liền mạch, hết bài tự sang bài sau.
 *
 * ## Vì sao không dùng lại `TrinhPhatAmThanh`
 *
 * Trình phát kia phát **một** file và không biết gì về bài tiếp theo. Ở đây thứ
 * quan trọng nhất lại chính là cái nối giữa hai bài: hết bài phải tự sang bài
 * sau, không hỏi, không bấm. Người đang chạy bộ hay đang lái xe không rảnh tay
 * — hàng chờ mà phải bấm giữa mỗi bài thì không còn là hàng chờ.
 *
 * ## Một thẻ `<audio>` duy nhất, đổi `src`
 *
 * Không dựng mỗi bài một thẻ. Trình duyệt chỉ cho phát tiếp không cần bấm nếu
 * lần phát đầu tiên do người dùng bấm — và quyền đó bám vào **thẻ đã được bấm**.
 * Đổi sang thẻ khác là mất quyền, nhạc dừng giữa hàng chờ. Giữ nguyên một thẻ
 * và chỉ đổi `src` thì quyền còn nguyên tới hết hàng.
 */

import { Pause, Play, SkipBack, SkipForward } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import {
  CAC_MUC_TOC_DO,
  docTocDo,
} from "@/components/TrinhPhatAmThanh";
import type { MucHangCho } from "@/lib/hangCho/xepHang";

export function TrinhPhatHangCho({
  cacMuc,
  tocDoMacDinh = 1,
}: {
  cacMuc: MucHangCho[];
  tocDoMacDinh?: number;
}) {
  const may = useRef<HTMLAudioElement>(null);
  const [viTri, setViTri] = useState(0);
  const [dangPhat, setDangPhat] = useState(false);
  const [tocDo, setTocDo] = useState(tocDoMacDinh);

  const coAmThanh = cacMuc.filter((m) => m.amThanh);
  // Kẹp lại vào trong danh sách: đổi bộ lọc thì hàng chờ ngắn đi mà `viTri` vẫn
  // giữ số cũ, và đọc quá cuối mảng là trắng trang
  const dangNghe = coAmThanh[Math.min(viTri, coAmThanh.length - 1)];

  // Đổi bài thì đặt lại tốc độ — `playbackRate` không đi theo `src` mới
  useEffect(() => {
    if (may.current) may.current.playbackRate = tocDo;
  }, [tocDo, viTri]);

  // Sang bài mới thì phát tiếp ngay, không đợi bấm.
  //
  // Phải làm bằng effect chứ không gọi thẳng trong `sang()`: lúc `sang()` chạy,
  // React chưa gắn `src` mới vào thẻ, nên `play()` gọi ở đó là phát lại đúng
  // file vừa hết. Effect chạy SAU khi React đã cập nhật thẻ.
  //
  // `viTri === 0` thì không phát: đó là lúc trang vừa mở, chưa ai bấm gì —
  // trình duyệt cũng sẽ chặn, và tự dưng phát nhạc lúc mở trang là thô lỗ.
  useEffect(() => {
    if (viTri > 0) void may.current?.play();
  }, [viTri]);

  // Đặt SAU mọi hook. React đòi số hook mỗi lần vẽ phải như nhau, nên thoát
  // sớm ở trên chỗ này là hỏng ngay khi hàng chờ đổi từ rỗng sang có bài.
  if (coAmThanh.length === 0) return null;

  function sang(buoc: number) {
    const moi = viTri + buoc;
    if (moi < 0 || moi >= coAmThanh.length) {
      setDangPhat(false);
      return;
    }
    setViTri(moi);
  }

  return (
    <div className="sticky top-2 z-10 rounded-xl border border-neutral-200 bg-white/95 p-3 backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/95">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{dangNghe.tieuDe}</p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Bài {viTri + 1} / {coAmThanh.length} · {dangNghe.tenNguon}
            {dangNghe.laBanDoc ? " · bản đọc tiếng Việt" : ""}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => sang(-1)}
            disabled={viTri === 0}
            aria-label="Bài trước"
            className="rounded-lg p-2 text-neutral-600 hover:bg-neutral-100 disabled:opacity-30 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            <SkipBack size={16} />
          </button>
          <button
            type="button"
            onClick={() => {
              if (dangPhat) may.current?.pause();
              else void may.current?.play();
            }}
            aria-label={dangPhat ? "Tạm dừng" : "Phát"}
            className="rounded-full bg-cam-600 p-2.5 text-white dark:bg-cam-500 dark:text-neutral-950"
          >
            {dangPhat ? <Pause size={16} /> : <Play size={16} />}
          </button>
          <button
            type="button"
            onClick={() => sang(1)}
            disabled={viTri >= coAmThanh.length - 1}
            aria-label="Bài sau"
            className="rounded-lg p-2 text-neutral-600 hover:bg-neutral-100 disabled:opacity-30 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            <SkipForward size={16} />
          </button>
        </div>
      </div>

      <audio
        ref={may}
        // KHÔNG đặt `key` ở đây. Đặt `key` theo id bài thì mỗi lần sang bài
        // React thay hẳn thẻ `<audio>` — và quyền "được phát không cần bấm"
        // chết theo thẻ cũ, đúng thứ mà cả thiết kế này sinh ra để giữ.
        src={dangNghe.amThanh ?? undefined}
        controls
        preload="metadata"
        onPlay={() => setDangPhat(true)}
        onPause={() => setDangPhat(false)}
        onEnded={() => sang(1)}
        className="mt-2 w-full"
      >
        <track kind="captions" />
      </audio>

      <div className="mt-2 flex items-center justify-between gap-3">
        <Link
          href={`/xem/${dangNghe.id}`}
          className="text-xs text-neutral-500 underline-offset-2 hover:underline dark:text-neutral-400"
        >
          Mở trang nội dung
        </Link>
        <label className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
          Tốc độ
          <select
            value={tocDo}
            onChange={(e) => setTocDo(Number(e.target.value))}
            className="rounded-md border border-neutral-200 bg-transparent px-1.5 py-1 text-xs dark:border-neutral-700"
          >
            {CAC_MUC_TOC_DO.map((x) => (
              <option key={x} value={x}>
                {docTocDo(x)}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
