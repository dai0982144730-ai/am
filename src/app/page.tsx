import { auth, signOut } from "@/auth";

const PHASES = [
  { id: 0, label: "Nền tảng — khung dự án, cấu trúc dữ liệu", done: true },
  { id: 1, label: "Quét YouTube + lấy lời thoại + phân loại", done: false },
  { id: 2, label: "Blog & diễn đàn AI, thuật lại tiếng Việt + giọng đọc", done: false },
  { id: 3, label: "Nhạc — nhận diện BPM và thể loại", done: false },
  { id: 4, label: "Chấm chất lượng theo từng nguồn + bộ lọc", done: false },
  { id: 5, label: "Trình phát + theo dõi thói quen xem", done: false },
];

export default async function Home() {
  const phien = await auth();

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-16">
      <h1 className="text-3xl font-bold tracking-tight">Am</h1>
      <p className="mt-2 text-neutral-500 dark:text-neutral-400">
        Trợ lý cá nhân tuyển chọn nội dung đáng xem
      </p>

      <div className="mt-6 flex items-center gap-3 text-sm">
        {phien?.user ? (
          <>
            <span className="text-neutral-500 dark:text-neutral-400">
              Đang đăng nhập: {phien.user.email}
            </span>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            >
              <button
                type="submit"
                className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
              >
                Đăng xuất
              </button>
            </form>
          </>
        ) : (
          <a
            href="/dang-nhap"
            className="rounded-lg bg-neutral-900 px-4 py-2 text-xs font-medium text-white transition-opacity hover:opacity-90 dark:bg-neutral-100 dark:text-neutral-900"
          >
            Đăng nhập bằng Google
          </a>
        )}
      </div>

      <div className="mt-10 rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
        <h2 className="text-sm font-semibold">Tiến độ</h2>
        <ul className="mt-4 space-y-3">
          {PHASES.map((phase) => (
            <li key={phase.id} className="flex items-start gap-3 text-sm">
              <span
                aria-hidden
                className={
                  phase.done
                    ? "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-xs text-white dark:bg-neutral-100 dark:text-neutral-900"
                    : "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-neutral-300 text-xs text-neutral-400 dark:border-neutral-700"
                }
              >
                {phase.done ? "✓" : phase.id}
              </span>
              <span
                className={
                  phase.done
                    ? "text-neutral-900 dark:text-neutral-100"
                    : "text-neutral-400 dark:text-neutral-500"
                }
              >
                {phase.label}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <p className="mt-8 text-xs leading-relaxed text-neutral-400 dark:text-neutral-500">
        Bản thiết kế đầy đủ nằm trong <code>docs/plan.md</code>, tiến độ chi tiết
        trong <code>docs/PROGRESS.md</code>. Demo giao diện: mở{" "}
        <code>docs/demo-ui.html</code> bằng trình duyệt.
      </p>
    </main>
  );
}
