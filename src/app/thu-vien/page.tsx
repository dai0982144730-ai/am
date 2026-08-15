import Link from "next/link";

import { auth } from "@/auth";
import { KhungTrang } from "@/components/KhungTrang";
import { MucThuVien } from "@/components/MucThuVien";
import { prisma } from "@/lib/db/prisma";
import { TRANG_THAI_DOC } from "@/lib/thuVien/trangThai";

export const dynamic = "force-dynamic";

export default async function TrangThuVien({
  searchParams,
}: {
  searchParams: Promise<{ thuMuc?: string; trangThai?: string }>;
}) {
  const [phien, loc] = await Promise.all([auth(), searchParams]);
  const laChu = Boolean(phien?.user?.email);

  // Thư viện là của riêng chủ nhà — khách không có gì để xem ở đây
  if (!laChu) {
    return (
      <KhungTrang emailNguoiDung={null}>
        <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
          <h1 className="text-xl font-semibold tracking-tight">Thư viện</h1>
          <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
            Đây là chỗ chủ nhà cất riêng những thứ muốn quay lại xem. Cần đăng
            nhập mới mở được.
          </p>
          <Link
            href="/dang-nhap"
            className="mt-6 inline-block rounded-lg bg-cam-600 px-4 py-2 text-sm font-medium text-white dark:bg-cam-500 dark:text-white"
          >
            Đăng nhập
          </Link>
        </div>
      </KhungTrang>
    );
  }

  const cacMuc = await prisma.libraryItem.findMany({
    where: {
      ...(loc.thuMuc ? { folder: loc.thuMuc } : {}),
      ...(loc.trangThai ? { readStatus: loc.trangThai } : {}),
    },
    orderBy: { savedAt: "desc" },
    select: {
      folder: true,
      readStatus: true,
      personalNote: true,
      savedAt: true,
      contentItem: {
        select: {
          id: true,
          title: true,
          thumbnailUrl: true,
          source: { select: { title: true } },
          score: { select: { compositeScore: true } },
        },
      },
    },
  });

  // Danh sách thư mục đã dùng, để làm chip lọc và gợi ý khi gõ
  const nhomThuMuc = await prisma.libraryItem.groupBy({
    by: ["folder"],
    _count: { _all: true },
    where: { folder: { not: null } },
    orderBy: { _count: { folder: "desc" } },
  });
  const cacThuMuc = nhomThuMuc
    .map((n) => n.folder)
    .filter((t): t is string => Boolean(t));

  const tong = await prisma.libraryItem.count();

  function duongDanLoc(thay: { thuMuc?: string; trangThai?: string }): string {
    const ts = new URLSearchParams();
    const thuMuc = thay.thuMuc ?? loc.thuMuc;
    const trangThai = thay.trangThai ?? loc.trangThai;
    if (thuMuc) ts.set("thuMuc", thuMuc);
    if (trangThai) ts.set("trangThai", trangThai);
    const chuoi = ts.toString();
    return chuoi ? `/thu-vien?${chuoi}` : "/thu-vien";
  }

  const kieuChip =
    "rounded-full border px-3 py-1 text-xs transition-colors";
  const kieuChonRoi =
    "border-cam-600 bg-cam-600 text-white dark:border-cam-500 dark:bg-cam-500 dark:text-white";
  const kieuChuaChon =
    "border-neutral-300 text-neutral-600 hover:border-neutral-500 dark:border-neutral-700 dark:text-neutral-300";

  return (
    <KhungTrang emailNguoiDung={phien?.user?.email}>
      <div className="w-full px-4 py-6 sm:px-6 lg:px-8">
        <h1 className="text-xl font-semibold tracking-tight">Thư viện</h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          {tong} nội dung bạn tự tay cất lại. Khác với &ldquo;đang xem
          dở&rdquo; — chỗ đó là máy tự ghi, chỗ này là bạn chọn.
        </p>

        {/* Lọc theo trạng thái */}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Link
            href={duongDanLoc({ trangThai: "" })}
            className={`${kieuChip} ${!loc.trangThai ? kieuChonRoi : kieuChuaChon}`}
          >
            Mọi trạng thái
          </Link>
          {Object.entries(TRANG_THAI_DOC).map(([ma, ten]) => (
            <Link
              key={ma}
              href={duongDanLoc({ trangThai: ma })}
              className={`${kieuChip} ${loc.trangThai === ma ? kieuChonRoi : kieuChuaChon}`}
            >
              {ten}
            </Link>
          ))}
        </div>

        {/* Lọc theo thư mục */}
        {cacThuMuc.length > 0 ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Link
              href={duongDanLoc({ thuMuc: "" })}
              className={`${kieuChip} ${!loc.thuMuc ? kieuChonRoi : kieuChuaChon}`}
            >
              Mọi thư mục
            </Link>
            {nhomThuMuc.map((n) =>
              n.folder ? (
                <Link
                  key={n.folder}
                  href={duongDanLoc({ thuMuc: n.folder })}
                  className={`${kieuChip} ${loc.thuMuc === n.folder ? kieuChonRoi : kieuChuaChon}`}
                >
                  {n.folder} ({n._count._all})
                </Link>
              ) : null,
            )}
          </div>
        ) : null}

        {cacMuc.length === 0 ? (
          <div className="mt-10 rounded-xl border border-dashed border-neutral-300 p-10 text-center dark:border-neutral-700">
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              {tong === 0
                ? "Thư viện còn trống."
                : "Không có mục nào khớp bộ lọc."}
            </p>
            {tong === 0 ? (
              <p className="mt-2 text-xs text-neutral-400 dark:text-neutral-500">
                Mở một video bất kỳ rồi bấm &ldquo;Cất vào thư viện&rdquo;.
              </p>
            ) : null}
          </div>
        ) : (
          // Lưới thẻ như trang Danh sách phát của YouTube, thay cho danh sách
          // dọc — màn rộng mà xếp một cột thì hai bên trống hoác
          <ul className="mt-6 grid items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {cacMuc.map((m) => (
              <MucThuVien
                key={m.contentItem.id}
                cacThuMuc={cacThuMuc}
                muc={{
                  id: m.contentItem.id,
                  tieuDe: m.contentItem.title,
                  nguon: m.contentItem.source.title,
                  anh: m.contentItem.thumbnailUrl,
                  diem: m.contentItem.score?.compositeScore ?? null,
                  thuMuc: m.folder,
                  trangThai: m.readStatus,
                  ghiChuRieng: m.personalNote,
                  luocLuc: m.savedAt,
                }}
              />
            ))}
          </ul>
        )}
      </div>
    </KhungTrang>
  );
}
