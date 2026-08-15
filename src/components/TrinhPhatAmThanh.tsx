/**
 * Trình phát bản tiếng Việt.
 *
 * Dùng thẻ `<audio>` sẵn có của trình duyệt chứ không tự dựng nút bấm. Lý do:
 * thẻ đó đã có sẵn tua, chỉnh tốc độ, và quan trọng nhất là **hiện lên màn
 * hình khoá điện thoại** — nghe lúc đi đường không phải mở máy ra bấm. Tự dựng
 * lại thì mất hết những thứ đó mà chẳng được gì hơn.
 */

export function TrinhPhatAmThanh({
  duongDan,
  giong,
  nhan = "Nghe bản tiếng Việt",
  ghiChu,
}: {
  duongDan: string;
  giong?: string | null;
  nhan?: string;
  ghiChu?: string;
}) {
  return (
    <div className="rounded-xl border border-cam-300 bg-cam-50/60 p-4 dark:border-cam-700/50 dark:bg-neutral-900">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-cam-800 dark:text-cam-300">
          {nhan}
        </p>
        {giong ? (
          <span className="text-xs text-neutral-500 dark:text-neutral-400">
            {giong}
          </span>
        ) : null}
      </div>

      {/* `preload="none"` có chủ đích: file thuật lại nặng vài MB. Tải sẵn thì
          mỗi lần mở trang là tốn băng thông cho thứ có thể chẳng ai bấm nghe. */}
      <audio
        controls
        preload="none"
        src={duongDan}
        className="mt-2 w-full"
      >
        Trình duyệt này không phát được âm thanh.
      </audio>

      {ghiChu ? (
        <p className="mt-2 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
          {ghiChu}
        </p>
      ) : null}
    </div>
  );
}
