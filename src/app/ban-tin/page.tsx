import Link from "next/link";

import { KhungTrang } from "@/components/KhungTrang";
import { TrinhPhatAmThanh } from "@/components/TrinhPhatAmThanh";
import { prisma } from "@/lib/db/prisma";
import { emailChuDuAn } from "@/lib/quyen";

export const dynamic = "force-dynamic";

interface MucGon {
  id: string;
  tieuDe: string;
  nguon: string;
  thoiLuongGiay?: number | null;
  diem?: number | null;
  daThuatLai?: boolean;
  nhanXet?: string | null;
  chuyenMuc?: string;
}

interface NoiDungGon {
  topPicks?: {
    chuyenMuc: string;
    tenChuyenMuc: string;
    cacMuc: MucGon[];
  }[];
  moreIfInterested?: MucGon[];
}

function docThoiLuong(giay: number | null | undefined): string | null {
  if (!giay) return null;
  const phut = Math.round(giay / 60);
  return phut >= 60
    ? `${Math.floor(phut / 60)} giờ ${phut % 60} phút`
    : `${phut} phút`;
}

/**
 * Một mục trong bản tin: ảnh bên trái, chữ bên phải.
 *
 * MỌI THẺ CÙNG CHIỀU CAO, đúng yêu cầu của chủ dự án. Làm bằng `h-full` trên
 * thẻ cộng `items-stretch` ở lưới, rồi đẩy dòng chân xuống đáy bằng `mt-auto`.
 * Nhận xét bị cắt còn ba dòng — một thẻ có nhận xét dài hơn hẳn là thứ khiến
 * cả hàng trông so le lộn xộn.
 */
function TheBanTin({ muc, anh }: { muc: MucGon; anh: string | null }) {
  const phu = [muc.nguon, docThoiLuong(muc.thoiLuongGiay)]
    .filter(Boolean)
    .join(" · ");

  return (
    <Link
      href={`/xem/${muc.id}`}
      className="flex h-full gap-4 rounded-xl border border-neutral-200 p-3 transition-colors hover:border-cam-300 hover:bg-cam-50/40 dark:border-neutral-800 dark:hover:bg-neutral-900"
    >
      <div className="w-40 shrink-0 overflow-hidden rounded-lg bg-neutral-100 dark:bg-neutral-800">
        {anh ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={anh} alt="" className="aspect-video w-full object-cover" />
        ) : (
          <div className="aspect-video" />
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-3">
          <h3 className="line-clamp-2 text-sm font-medium leading-snug">
            {muc.tieuDe}
          </h3>
          {muc.diem != null ? (
            <span className="shrink-0 rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-semibold tabular-nums dark:bg-neutral-800">
              {muc.diem.toFixed(1)}
            </span>
          ) : null}
        </div>

        {muc.nhanXet ? (
          <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-neutral-600 dark:text-neutral-300">
            {muc.nhanXet}
          </p>
        ) : null}

        <p className="mt-auto pt-2 text-xs text-neutral-500 dark:text-neutral-400">
          {phu}
          {muc.daThuatLai ? " · đã thuật lại tiếng Việt" : ""}
        </p>
      </div>
    </Link>
  );
}

export default async function TrangBanTin() {
  const [email, banTin, caiDat] = await Promise.all([
    emailChuDuAn(),
    prisma.assistantBriefing.findFirst({
      orderBy: { deliveredAt: "desc" },
      include: { digestRun: true },
    }),
    prisma.userAssistantSettings.findUnique({
      where: { id: "singleton" },
      select: { ttsSpeed: true },
    }),
  ]);

  const noiDung = (banTin?.pickedItemsTiered ?? {}) as NoiDungGon;

  // Ảnh không nằm trong bản tin đã lưu — tra từ kho theo mã nội dung. Cách này
  // chạy được với cả bản tin cũ, khỏi phải tạo lại, và ảnh luôn là bản mới nhất.
  const moiId = [
    ...(noiDung.topPicks ?? []).flatMap((m) => m.cacMuc.map((x) => x.id)),
    ...(noiDung.moreIfInterested ?? []).map((x) => x.id),
  ];
  const cacAnh = moiId.length
    ? await prisma.contentItem.findMany({
        where: { id: { in: moiId } },
        select: { id: true, thumbnailUrl: true },
      })
    : [];
  const anhTheoId = new Map(cacAnh.map((a) => [a.id, a.thumbnailUrl]));

  return (
    <KhungTrang emailNguoiDung={email}>
      <div className="w-full px-4 py-6 sm:px-6 lg:px-8">
        <h1 className="text-xl font-semibold tracking-tight">Am nói với bạn</h1>

        {!banTin ? (
          <div className="mt-6 rounded-xl border border-dashed border-neutral-300 p-10 text-center dark:border-neutral-700">
            <p className="text-sm text-neutral-500">Chưa có bản tin nào.</p>
            <p className="mt-2 text-xs text-neutral-400">
              Bản tin được viết mỗi đêm sau khi quét xong. Tạo tay bằng{" "}
              <code>npx tsx scripts/tao-ban-tin.ts</code>
            </p>
          </div>
        ) : (
          <>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              {banTin.deliveredAt.toLocaleString("vi-VN", {
                weekday: "long",
                day: "numeric",
                month: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>

            {/* Bản tin trò chuyện — thứ chính của trang này.

                CHIA CỘT BÁO, không bó hẹp một cột. Bản trước dùng `max-w-3xl`
                cho dòng chữ khỏi dài quá — đúng về mặt đọc, nhưng để lại một
                mảng trống rất to bên phải, và chủ dự án chỉ ra đúng chỗ đó.

                Chia cột giải được cả hai: dòng vẫn ngắn vừa tầm mắt, mà bề
                ngang thì dùng hết. Màn hẹp vẫn một cột như cũ. */}
            <div className="mt-5 rounded-2xl border border-neutral-200 bg-neutral-50 p-6 dark:border-neutral-800 dark:bg-neutral-900">
              <div className="whitespace-pre-wrap text-[15px] leading-relaxed text-neutral-800 lg:columns-2 lg:[column-gap:3rem] 2xl:columns-3 dark:text-neutral-200">
                {banTin.conversationalScript}
              </div>
              <div className="mt-4 border-t border-neutral-200 pt-4 dark:border-neutral-800">
                {banTin.audioBriefingUrl ? (
                  <TrinhPhatAmThanh
                    duongDan={banTin.audioBriefingUrl}
                    nhan="Nghe bản tin"
                    tocDoMacDinh={caiDat?.ttsSpeed ?? 1}
                    ghiChu="Nghe trong lúc pha cà phê — không cần nhìn màn hình."
                  />
                ) : (
                  <p className="text-xs text-neutral-400 dark:text-neutral-500">
                    Chưa có giọng đọc cho bản tin này. Chạy{" "}
                    <code>npx tsx scripts/tao-am-thanh.ts</code>.
                  </p>
                )}
              </div>
            </div>

            {noiDung.topPicks?.map((muc) => (
              <section key={muc.chuyenMuc} className="mt-8">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                  {muc.tenChuyenMuc}
                </h2>
                <div className="grid items-stretch gap-3 lg:grid-cols-2 2xl:grid-cols-3">
                  {muc.cacMuc.map((m) => (
                    <TheBanTin
                      key={m.id}
                      muc={m}
                      anh={anhTheoId.get(m.id) ?? null}
                    />
                  ))}
                </div>
              </section>
            ))}

            {noiDung.moreIfInterested && noiDung.moreIfInterested.length > 0 ? (
              <section className="mt-8">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                  Xem thêm nếu rảnh
                </h2>
                <div className="grid items-stretch gap-3 lg:grid-cols-2 2xl:grid-cols-3">
                  {noiDung.moreIfInterested.map((m) => (
                    <TheBanTin
                      key={m.id}
                      muc={m}
                      anh={anhTheoId.get(m.id) ?? null}
                    />
                  ))}
                </div>
              </section>
            ) : null}

            <p className="mt-8 text-xs text-neutral-400 dark:text-neutral-500">
              Chắt từ {banTin.digestRun.newItemsFound} nội dung quét về.
            </p>
          </>
        )}
      </div>
    </KhungTrang>
  );
}
