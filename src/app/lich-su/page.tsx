import Link from "next/link";

import { auth } from "@/auth";
import { KhungTrang } from "@/components/KhungTrang";
import { MucLichSu, NutXoaSachLichSu } from "@/components/MucLichSu";
import { docLichSuMotTuan } from "@/lib/lichSu/loc";

export const dynamic = "force-dynamic";

const TEN_NHOM: Record<string, string> = {
  ai: "AI",
  triet_hoc: "Triết học",
  truyen: "Truyện",
  music: "Music",
  khoa_hoc: "Khoa học",
  new_search: "Ngẫu hứng",
  other: "Ngẫu hứng",
};

export default async function TrangLichSu() {
  const phien = await auth();

  if (!phien?.user?.email) {
    return (
      <KhungTrang emailNguoiDung={null}>
        <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
          <h1 className="text-xl font-semibold tracking-tight">Lịch sử xem</h1>
          <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
            Lịch sử là của riêng chủ nhà. Cần đăng nhập mới mở được.
          </p>
          <Link
            href="/dang-nhap"
            className="mt-6 inline-block rounded-lg bg-cam-600 px-4 py-2 text-sm font-medium text-white"
          >
            Đăng nhập
          </Link>
        </div>
      </KhungTrang>
    );
  }

  /**
   * Lịch sử chỉ giữ MỘT TUẦN — chủ dự án chốt 2026-08-15.
   *
   * Nó không phải kho lưu trữ, mà là bộ nhớ ngắn hạn trả lời đúng một câu:
   * "cái mình vừa xem hôm nọ là cái gì nhỉ". Quá một tuần thì không ai hỏi câu
   * đó nữa. Muốn giữ lâu thì đã có Thư viện.
   *
   * Phần đọc và tách nhóm nằm trong `lib/lichSu/loc.ts`, không viết ở đây: nó
   * phụ thuộc vào "bây giờ là mấy giờ", mà thứ đó không được nằm trong phần vẽ
   * trang. Việc xoá thật thì nằm trong lượt quét đêm.
   */
  const { tatCa: cacMuc, homNay, truocDo } = await docLichSuMotTuan();

  return (
    <KhungTrang emailNguoiDung={phien.user.email}>
      <div className="w-full px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h1 className="text-xl font-semibold tracking-tight">Lịch sử xem</h1>
          {cacMuc.length > 0 ? <NutXoaSachLichSu /> : null}
        </div>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Mở ra xem là nội dung chuyển sang đây và biến khỏi Trang chủ, Khám
          phá, New — nên lần sau lướt là toàn thứ mới. Trừ thứ bạn đã cất vào
          thư viện, chúng vẫn ở lại luồng chính.
        </p>
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          Chỉ giữ một tuần. Quá bảy ngày thì mục tự xoá khỏi đây và nội dung
          quay lại luồng chính — muốn giữ lâu thì cất vào Thư viện.
        </p>

        {cacMuc.length === 0 ? (
          <div className="mt-10 rounded-xl border border-dashed border-neutral-300 p-10 text-center dark:border-neutral-700">
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Chưa mở nội dung nào.
            </p>
          </div>
        ) : (
          /* HAI CỘT: HÔM NAY BÊN TRÁI, PHẦN CÒN LẠI CỦA TUẦN BÊN PHẢI.
             Chủ dự án chốt 2026-08-15.

             Chia theo NGÀY chứ không chia đôi số mục, vì câu hỏi thật lúc mở
             trang này là "hôm nay mình đã xem gì rồi" — thứ đó phải nằm gọn
             một chỗ, không lẫn với hôm kia. */
          <div className="mt-6 grid gap-x-10 lg:grid-cols-2">
            <div>
              <h2 className="mb-1 text-sm font-semibold text-cam-700 dark:text-cam-400">
                Hôm nay
                <span className="ml-2 font-normal text-neutral-500 dark:text-neutral-400">
                  {homNay.length}
                </span>
              </h2>
              {homNay.length === 0 ? (
                <p className="py-3 text-sm text-neutral-500 dark:text-neutral-400">
                  Hôm nay chưa mở gì.
                </p>
              ) : (
                <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
                  {homNay.map((m) => (
                    <MucLichSu
                      key={m.contentItem.id}
                      id={m.contentItem.id}
                      tieuDe={m.contentItem.title}
                      anh={m.contentItem.thumbnailUrl}
                      nguon={m.contentItem.source.title}
                      chuyenMuc={
                        TEN_NHOM[m.contentItem.contentGroup] ??
                        m.contentItem.contentGroup
                      }
                      diem={m.contentItem.score?.compositeScore ?? null}
                      daCatThuVien={Boolean(m.contentItem.libraryItem)}
                      moLuc={m.lastOpenedAt}
                      soLanMo={m.openCount}
                    />
                  ))}
                </ul>
              )}
            </div>

            <div className="mt-8 lg:mt-0">
              <h2 className="mb-1 text-sm font-semibold text-neutral-600 dark:text-neutral-300">
                Sáu ngày trước đó
                <span className="ml-2 font-normal text-neutral-500 dark:text-neutral-400">
                  {truocDo.length}
                </span>
              </h2>
              {truocDo.length === 0 ? (
                <p className="py-3 text-sm text-neutral-500 dark:text-neutral-400">
                  Không có gì trong sáu ngày trước.
                </p>
              ) : (
                <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
                  {truocDo.map((m) => (
                    <MucLichSu
                      key={m.contentItem.id}
                      id={m.contentItem.id}
                      tieuDe={m.contentItem.title}
                      anh={m.contentItem.thumbnailUrl}
                      nguon={m.contentItem.source.title}
                      chuyenMuc={
                        TEN_NHOM[m.contentItem.contentGroup] ??
                        m.contentItem.contentGroup
                      }
                      diem={m.contentItem.score?.compositeScore ?? null}
                      daCatThuVien={Boolean(m.contentItem.libraryItem)}
                      moLuc={m.lastOpenedAt}
                      soLanMo={m.openCount}
                    />
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </KhungTrang>
  );
}
