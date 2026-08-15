import Link from "next/link";

import { KhungTrang } from "@/components/KhungTrang";
import { ChonTongMau } from "@/components/ChonTongMau";
import { ThanhTrongSo } from "@/components/ThanhTrongSo";
import { ThemPodcast } from "@/components/ThemPodcast";
import { ThanhTyLeNguonMoi } from "@/components/ThanhTyLeNguonMoi";
import { TinhHinhGiongDoc } from "@/components/TinhHinhGiongDoc";
import { prisma } from "@/lib/db/prisma";
import { emailChuDuAn, laChuDuAn } from "@/lib/quyen";
import { CHUYEN_MUC_CHINH_DUOC, docTyLeNguonMoi } from "@/lib/nguonMoi/tyLe";
import { DEFAULT_WEIGHTS } from "@/lib/scoring/normalize";
import { daCauHinh } from "@/lib/tts/doc";
import { GIONG_MAC_DINH } from "@/lib/tts/giong";
import { xemTinhHinh as xemTinhHinhTts } from "@/lib/tts/hanMuc";

export const dynamic = "force-dynamic";

const TEN_LOAI_NGUON: Record<string, string> = {
  youtube_channel: "Kênh YouTube",
  blog_feed: "Blog",
  forum_community: "Diễn đàn",
  podcast_rss: "Podcast",
  soundcloud_channel: "SoundCloud",
};

export default async function TrangCaiDat() {
  const [email, laChu, tyLeNguonMoi, tinhHinhTts] = await Promise.all([
    emailChuDuAn(),
    laChuDuAn(),
    docTyLeNguonMoi(),
    xemTinhHinhTts(),
  ]);

  const caiDatTroLy = await prisma.userAssistantSettings.findUnique({
    where: { id: "singleton" },
    select: { ttsVoice: true, ttsSpeed: true },
  });

  // Khách vẫn xem được trang này để biết hệ thống chấm điểm thế nào — chỉ không
  // sửa được. Minh bạch thì tốt hơn là giấu đi.
  const cacBoTrongSo = await prisma.sourceQualityProfile.findMany({
    orderBy: { sourceType: "asc" },
  });

  const kenhPodcast = await prisma.source.findMany({
    where: { type: "podcast_rss" },
    select: {
      id: true,
      title: true,
      externalId: true,
      _count: { select: { contentItems: true } },
    },
    orderBy: { title: "asc" },
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

      {/* SÁU KHỐI XẾP THÀNH LƯỚI 3 HÀNG 2 CỘT, đúng yêu cầu chủ dự án.

          Xếp dọc một cột thì phải cuộn rất lâu mới hết trang, mà mỗi khối lại
          ngắn — nửa màn hình bên phải bỏ trống. Hai cột lấp chỗ đó.

          `items-start` là chi tiết dễ quên: không có nó thì mọi ô trong cùng
          một hàng bị kéo cao bằng ô cao nhất, khối ngắn thừa ra một mảng trống
          phía dưới. Đúng cái "khoảng trắng thừa" cần tránh.

          Chỉ chia cột từ `xl` trở lên: dưới mức đó, thanh trượt trọng số và ô
          tìm podcast bị bóp quá hẹp, khó bấm hơn là phải cuộn. */}
      <div className="mt-8 grid items-start gap-x-10 gap-y-10 xl:grid-cols-2">
        {/* Đặt ô đầu tiên có chủ đích: đây là thứ thấy ngay bằng mắt và đổi
            thường xuyên nhất, khác với trọng số chấm điểm vốn đặt một lần
            rồi thôi. */}
        <ChonTongMau />

        <section>
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
            // MỘT cột ở đây, không phải hai. Cả khối này giờ đã nằm trong một
            // ô của lưới 2 cột ngoài, chia đôi lần nữa thì mỗi thanh trượt chỉ
            // còn chừng 200px — kéo không nổi.
            <div className="mt-6 grid gap-4">
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

        <ThemPodcast
          laChu={laChu}
          daThem={kenhPodcast.map((k) => ({
            id: k.id,
            ten: k.title,
            soTap: k._count.contentItems,
            duongDanFeed: k.externalId,
          }))}
        />

        <TinhHinhGiongDoc
          tinhHinh={tinhHinhTts}
          daCoKhoa={daCauHinh()}
          giongDangChon={caiDatTroLy?.ttsVoice ?? GIONG_MAC_DINH}
          tocDoDangDung={caiDatTroLy?.ttsSpeed ?? 1}
          laChu={laChu}
        />

        <section>
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
      </div>
    </KhungTrang>
  );
}
