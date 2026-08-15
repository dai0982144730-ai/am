import Link from "next/link";

import { KhungTrang } from "@/components/KhungTrang";
import { ThanhTrongSo } from "@/components/ThanhTrongSo";
import { ThanhTyLeNguonMoi } from "@/components/ThanhTyLeNguonMoi";
import { prisma } from "@/lib/db/prisma";
import { emailChuDuAn, laChuDuAn } from "@/lib/quyen";
import { CHUYEN_MUC_CHINH_DUOC, docTyLeNguonMoi } from "@/lib/nguonMoi/tyLe";
import { DEFAULT_WEIGHTS } from "@/lib/scoring/normalize";

export const dynamic = "force-dynamic";

const TEN_LOAI_NGUON: Record<string, string> = {
  youtube_channel: "Kênh YouTube",
  blog_feed: "Blog",
  forum_community: "Diễn đàn",
  podcast_rss: "Podcast",
  soundcloud_channel: "SoundCloud",
};

export default async function TrangCaiDat() {
  const [email, laChu, tyLeNguonMoi] = await Promise.all([
    emailChuDuAn(),
    laChuDuAn(),
    docTyLeNguonMoi(),
  ]);

  // Khách vẫn xem được trang này để biết hệ thống chấm điểm thế nào — chỉ không
  // sửa được. Minh bạch thì tốt hơn là giấu đi.
  const cacBoTrongSo = await prisma.sourceQualityProfile.findMany({
    orderBy: { sourceType: "asc" },
  });

  return (
    <KhungTrang emailNguoiDung={email}>
      <div className="w-full px-4 py-6 sm:px-6 lg:px-8">
        <h1 className="text-xl font-semibold tracking-tight">Cài đặt</h1>

        {!laChu ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950">
            <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
              Bạn đang xem với tư cách khách
            </p>
            <p className="mt-1 text-sm leading-relaxed text-amber-800 dark:text-amber-300">
              Xem thì thoải mái, nhưng sửa cấu hình và chạy các việc cần Claude
              thì phải đăng nhập — vì chúng đổi cách cả hệ thống hoạt động và
              tiêu hạn mức của gói Claude Pro.
            </p>
            <Link
              href="/dang-nhap"
              className="mt-3 inline-block rounded-lg bg-amber-900 px-3.5 py-1.5 text-xs font-medium text-white dark:bg-amber-200 dark:text-amber-950"
            >
              Đăng nhập
            </Link>
          </div>
        ) : null}

        <section className="mt-8">
          <h2 className="text-base font-semibold">
            Tiêu chí chất lượng theo nguồn
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
            Mỗi loại nguồn có bộ chỉ số khác nhau, nên chấm bằng một công thức
            chung là vô nghĩa — 500.000 lượt xem YouTube và 300 điểm Hacker News
            không cùng thang đo. Mọi tín hiệu đều được xếp hạng phần trăm{" "}
            <strong>trong cùng loại nguồn</strong> trước khi vào công thức.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
            Đây là <strong>trọng số xếp hạng, không phải ngưỡng loại bỏ</strong>:
            nội dung điểm thấp bị đẩy xuống cuối chứ không biến mất, để kênh nhỏ
            mà hay vẫn có cơ hội lọt vào tầm mắt.
          </p>

          {cacBoTrongSo.length === 0 ? (
            <div className="mt-6 rounded-xl border border-dashed border-neutral-300 p-8 text-center dark:border-neutral-700">
              <p className="text-sm text-neutral-500">
                Chưa dựng bộ trọng số nào.
              </p>
              <p className="mt-2 text-xs text-neutral-400">
                Chạy <code>npx tsx scripts/cham-diem.ts</code> để dựng bộ mặc
                định.
              </p>
            </div>
          ) : (
            // Hai cột trên màn rộng: sáu loại nguồn xếp dọc một cột thì
            // phải cuộn mãi mới hết, mà mỗi khối lại ngắn.
            <div className="mt-6 grid gap-4 xl:grid-cols-2">
              {cacBoTrongSo.map((bo) => {
                const macDinh = DEFAULT_WEIGHTS[bo.sourceType];
                return (
                  <ThanhTrongSo
                    key={bo.id}
                    loaiNguon={bo.sourceType}
                    tenHienThi={
                      TEN_LOAI_NGUON[bo.sourceType] ?? bo.sourceType
                    }
                    banDau={{
                      popularity: bo.weightPopularity,
                      engagementDepth: bo.weightEngagementDepth,
                      discussion: bo.weightDiscussion,
                      authority: bo.weightAuthority,
                      contentQuality: bo.weightContentQuality,
                    }}
                    macDinh={macDinh ?? null}
                    choSua={laChu}
                  />
                );
              })}
            </div>
          )}
        </section>

        <ThanhTyLeNguonMoi
          laChu={laChu}
          cacMuc={CHUYEN_MUC_CHINH_DUOC.map((m) => ({
            ...m,
            tyLe: tyLeNguonMoi[m.ma] ?? 30,
          }))}
        />

        <section className="mt-10">
          <h2 className="text-base font-semibold">Việc cần đăng nhập</h2>
          <p className="mt-2 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
            Hai nhóm việc dưới đây chỉ chủ dự án làm được. Hiện chúng chạy bằng
            lệnh trong terminal; nút bấm trên web là việc của các phase sau.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
              <p className="text-sm font-medium">Cấu hình</p>
              <p className="mt-1 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
                Chỉnh trọng số chấm điểm, thêm nguồn tin, duyệt tác giả vào
                whitelist. Những việc này đổi cách cả hệ thống hoạt động.
              </p>
            </div>
            <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
              <p className="text-sm font-medium">Việc có gọi Claude</p>
              <p className="mt-1 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
                Phân loại nội dung, thuật lại bài viết, đọc bình luận. Những việc
                này tiêu hạn mức của gói Claude Pro.
              </p>
            </div>
          </div>
        </section>
      </div>
    </KhungTrang>
  );
}
