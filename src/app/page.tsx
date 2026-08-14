import { auth } from "@/auth";
import { KhungTrang } from "@/components/KhungTrang";
import { TheNoiDungCard } from "@/components/TheNoiDung";
import {
  layNoiDungTrangChu,
  layTinhHinhKho,
} from "@/lib/nghiepVu/layNoiDungTrangChu";

/** Không lưu bản dựng sẵn — kho thay đổi mỗi lần quét. */
export const dynamic = "force-dynamic";

function docThoiDiem(luc: Date | null): string {
  if (!luc) return "chưa quét lần nào";
  const soPhut = Math.floor((Date.now() - luc.getTime()) / 60_000);
  if (soPhut < 60) return `${soPhut} phút trước`;
  const soGio = Math.floor(soPhut / 60);
  if (soGio < 24) return `${soGio} giờ trước`;
  return `${Math.floor(soGio / 24)} ngày trước`;
}

export default async function TrangChu() {
  const [phien, cacMuc, tinhHinh] = await Promise.all([
    auth(),
    layNoiDungTrangChu(4),
    layTinhHinhKho(),
  ]);

  return (
    <KhungTrang emailNguoiDung={phien?.user?.email}>
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        {/* Dải thông tin về lần quét gần nhất — thay cho bản tin của trợ lý,
            vốn là việc của Phase 10 */}
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            Kho nội dung
          </p>
          <p className="mt-2 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
            Đang theo dõi <strong>{tinhHinh.soNguon}</strong> kênh YouTube, đã
            quét về <strong>{tinhHinh.tongNoiDung}</strong> video (
            {docThoiDiem(tinhHinh.quetGanNhat)}).{" "}
            <strong>{tinhHinh.daPhanLoai}</strong> video đã được Claude đọc và
            xếp vào chuyên mục
            {tinhHinh.choPhanLoai > 0 ? (
              <>
                , còn <strong>{tinhHinh.choPhanLoai}</strong> đang chờ
              </>
            ) : null}
            .
          </p>
          <p className="mt-2 text-xs text-neutral-400 dark:text-neutral-500">
            Bản tin trò chuyện hằng sáng và phần audio là việc của Phase 10.
          </p>
        </div>

        {cacMuc.length === 0 ? (
          <div className="mt-10 rounded-xl border border-dashed border-neutral-300 p-10 text-center dark:border-neutral-700">
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Chưa có nội dung nào được phân loại.
            </p>
            <p className="mt-2 text-xs text-neutral-400 dark:text-neutral-500">
              Chạy <code>npx tsx scripts/phan-loai.ts --so 20</code> để Claude
              đọc và xếp nhóm.
            </p>
          </div>
        ) : null}

        {cacMuc.map((muc) => (
          <section key={muc.ma} className="mt-10">
            <div className="mb-4 flex items-baseline justify-between gap-4">
              <h2 className="text-lg font-semibold tracking-tight">
                {muc.ten}
              </h2>
              <span className="text-xs text-neutral-400 dark:text-neutral-500">
                {muc.tongSo} mục
              </span>
            </div>

            <div className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
              {muc.cacThe.map((the) => (
                <TheNoiDungCard key={the.id} muc={the} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </KhungTrang>
  );
}
