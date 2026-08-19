import Link from "next/link";

import { KhungTrang } from "@/components/KhungTrang";
import { NutDuyetTacGia } from "@/components/NutDuyetTacGia";
import { NutTheoDoiTacGia } from "@/components/NutTheoDoiTacGia";
import { docTuSach, TEN_LINH_VUC } from "@/lib/tacGia/tuSach";
import { emailChuDuAn } from "@/lib/quyen";

export const dynamic = "force-dynamic";

function docThoiLuong(giay: number | null): string | null {
  if (!giay) return null;
  const gio = Math.floor(giay / 3600);
  const phut = Math.floor((giay % 3600) / 60);
  return gio > 0 ? `${gio} giờ ${phut} phút` : `${phut} phút`;
}

export default async function TrangTuSach() {
  const [email, cacTacGia] = await Promise.all([emailChuDuAn(), docTuSach()]);

  const trongTu = cacTacGia.filter((t) => t.theoDoi);
  // Ba khối, không phải hai: người đã bác tách hẳn ra cuối trang. Để lẫn vào
  // "chưa trong tủ" thì lần nào mở Tủ sách cũng phải lướt qua đúng những cái
  // tên vừa nói là sai — mà đó chính là việc nút bác sinh ra để khỏi phải làm.
  const chuaTrongTu = cacTacGia.filter((t) => !t.theoDoi && !t.biTuChoi);
  const daBac = cacTacGia.filter((t) => t.biTuChoi);
  const choDuyet = chuaTrongTu.filter((t) => t.choDuyet).length;

  return (
    <KhungTrang emailNguoiDung={email}>
      <div className="w-full px-4 py-6 sm:px-6 lg:px-8">
        <h1 className="text-xl font-semibold tracking-tight">Tủ sách</h1>
        <p className="mt-1.5 max-w-2xl text-sm text-neutral-500 dark:text-neutral-400">
          Theo dõi một người, không phải một kênh. Cùng một giảng sư có thể xuất
          hiện trên nhiều kênh khác nhau — theo dõi kênh thì phải theo hết từng
          kênh và vẫn sót, theo dõi người thì bắt được cả.
        </p>

        {cacTacGia.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-neutral-300 p-10 text-center dark:border-neutral-700">
            <p className="text-sm text-neutral-500">
              Chưa rút được tên tác giả nào. Chạy{" "}
              <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs dark:bg-neutral-800">
                npx tsx scripts/gom-tac-gia.ts --ghi
              </code>
            </p>
          </div>
        ) : null}

        {trongTu.length > 0 ? (
          <section className="mt-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-cam-600 dark:text-cam-300">
              Đang theo dõi · {trongTu.length}
            </h2>
            <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {trongTu.map((t) => (
                <TheTacGia key={t.id} tacGia={t} />
              ))}
            </div>
          </section>
        ) : null}

        {chuaTrongTu.length > 0 ? (
          <section className="mt-8">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
              {trongTu.length > 0 ? "Chưa trong tủ" : "Chọn người muốn theo dõi"}{" "}
              · {chuaTrongTu.length}
            </h2>
            {choDuyet > 0 ? (
              <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
                {choDuyet} cái tên do Claude tự rút ra từ nội dung, chưa ai nhìn
                tới. Rút nhầm là chuyện thường — tên chương trình, tên người dẫn,
                một cụm chữ trong tiêu đề đều có thể thành &ldquo;tác giả&rdquo;.
                Bấm <strong>Không phải tác giả</strong> để dẹp hẳn khỏi đây.
              </p>
            ) : null}
            <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {chuaTrongTu.map((t) => (
                <TheTacGia key={t.id} tacGia={t} />
              ))}
            </div>
          </section>
        ) : null}
        {daBac.length > 0 ? (
          <details className="mt-8">
            <summary className="cursor-pointer text-sm font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
              Đã bác · {daBac.length}
            </summary>
            <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
              Vẫn giữ trong kho chứ không xoá: tên do Claude rút ra từ nội dung
              nên lượt phân loại sau sẽ rút đúng cái tên đó lần nữa. Đánh dấu thì
              không phải bác lại mỗi tuần.
            </p>
            <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {daBac.map((t) => (
                <TheTacGia key={t.id} tacGia={t} />
              ))}
            </div>
          </details>
        ) : null}
      </div>
    </KhungTrang>
  );
}

function TheTacGia({
  tacGia,
}: {
  tacGia: Awaited<ReturnType<typeof docTuSach>>[number];
}) {
  return (
    <article className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold">{tacGia.ten}</h3>
          <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
            {TEN_LINH_VUC[tacGia.linhVuc]} · {tacGia.soBai} nội dung ·{" "}
            {tacGia.cacNguon.length} nguồn
          </p>
          {/* Các cách viết khác của cùng tên — bằng chứng cho thấy việc gom
              tên đã làm gì, và giúp nhận ra nếu gom nhầm hai người */}
          {tacGia.bietDanh.length > 0 ? (
            <p className="mt-1 text-[11px] text-neutral-400 dark:text-neutral-500">
              cũng viết: {tacGia.bietDanh.join(" · ")}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {!tacGia.biTuChoi ? (
            <NutTheoDoiTacGia
              tacGiaId={tacGia.id}
              dangTheoDoi={tacGia.theoDoi}
            />
          ) : null}
          <NutDuyetTacGia tacGiaId={tacGia.id} biTuChoi={tacGia.biTuChoi} />
        </div>
      </div>

      {tacGia.cacNguon.length > 1 ? (
        <p className="mt-2 text-[11px] text-neutral-400 dark:text-neutral-500">
          Xuất hiện trên: {tacGia.cacNguon.slice(0, 4).join(" · ")}
          {tacGia.cacNguon.length > 4
            ? ` và ${tacGia.cacNguon.length - 4} nguồn nữa`
            : ""}
        </p>
      ) : null}

      <ul className="mt-3 space-y-2 border-t border-neutral-100 pt-3 dark:border-neutral-800">
        {tacGia.baiMoi.map((b) => (
          <li key={b.id}>
            <Link
              href={`/xem/${b.id}`}
              className="group flex items-start gap-2 text-sm"
            >
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-neutral-300 dark:bg-neutral-600" />
              <span className="min-w-0">
                <span className="line-clamp-1 group-hover:text-cam-600 dark:group-hover:text-cam-300">
                  {b.tieuDe}
                </span>
                <span className="text-[11px] text-neutral-400 dark:text-neutral-500">
                  {b.tenNguon}
                  {docThoiLuong(b.thoiLuong)
                    ? ` · ${docThoiLuong(b.thoiLuong)}`
                    : ""}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </article>
  );
}
