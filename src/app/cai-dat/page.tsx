import Link from "next/link";

import { CauHinhChuDeCon } from "@/components/CauHinhChuDeCon";
import { KhungTrang } from "@/components/KhungTrang";
import { ChonTongMau } from "@/components/ChonTongMau";
import { ThanhTrongSo } from "@/components/ThanhTrongSo";
import { ThemPodcast } from "@/components/ThemPodcast";
import { ThemSoundCloud } from "@/components/ThemSoundCloud";
import { DatHangNgauHung } from "@/components/DatHangNgauHung";
import { ThanhTyLeNguonMoi } from "@/components/ThanhTyLeNguonMoi";
import { TinhHinhGiongDoc } from "@/components/TinhHinhGiongDoc";
import { prisma } from "@/lib/db/prisma";
import { emailChuDuAn, laChuDuAn } from "@/lib/quyen";
import {
  CHUYEN_MUC_CO_CHU_DE,
  layChuDeConMoiMuc,
  TEN_HANG_CHU_DE,
} from "@/lib/nghiepVu/chuDeCon";
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

  // Chủ đề con của cả năm chuyên mục, lấy CẢ cái đang tắt — trang cấu hình
  // phải thấy chúng thì mới bật lại được.
  const chuDeTheoMuc = await layChuDeConMoiMuc(true);
  const TEN_CHUYEN_MUC: Record<string, string> = {
    ai: "AI",
    triet_hoc: "Triết học",
    truyen: "Truyện",
    music: "Music",
    khoa_hoc: "Khoa học",
  };
  const nhomChuDe = CHUYEN_MUC_CO_CHU_DE.map((m) => ({
    chuyenMuc: m as string,
    tenChuyenMuc: TEN_CHUYEN_MUC[m] ?? m,
    tenHang: TEN_HANG_CHU_DE[m],
    cac: chuDeTheoMuc[m].map((c) => ({
      id: c.id,
      ma: c.ma,
      ten: c.ten,
      moTa: c.moTa,
      bat: c.bat,
    })),
  }));

  const caiDatTroLy = await prisma.userAssistantSettings.findUnique({
    where: { id: "singleton" },
    select: { ttsVoice: true, ttsSpeed: true },
  });

  // Khách vẫn xem được trang này để biết hệ thống chấm điểm thế nào — chỉ không
  // sửa được. Minh bạch thì tốt hơn là giấu đi.
  const cacBoTrongSo = await prisma.sourceQualityProfile.findMany({
    orderBy: { sourceType: "asc" },
  });

  const donNgauHung = await prisma.adHocInterest.findFirst({
    where: { active: true },
    orderBy: { createdAt: "desc" },
    select: {
      yeuCau: true,
      chuDeCon: true,
      lastScannedAt: true,
      resultCount: true,
    },
  });

  const kenhSoundCloud = await prisma.source.findMany({
    where: { type: "soundcloud_channel" },
    select: {
      id: true,
      title: true,
      url: true,
      _count: { select: { contentItems: true } },
    },
    orderBy: { title: "asc" },
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

      {/* HAI CỘT KIỂU CỘT BÁO, KHÔNG PHẢI LƯỚI.

          Bản trước tôi dùng lưới (`grid grid-cols-2`) và SAI hẳn. Lưới bắt các
          ô cùng một hàng phải bắt đầu thẳng hàng nhau, nên khối "Tông màu" cao
          chừng 200px nằm cạnh khối "Tiêu chí chất lượng" cao hơn 1500px thì
          bên dưới Tông màu hở ra một mảng trống hơn nghìn pixel. Chủ dự án gửi
          ảnh khoanh đúng chỗ đó.

          `columns-2` thì các khối **chảy tự do**: hết khối này là khối sau lấp
          lên ngay, không chờ cho thẳng hàng. Trình duyệt tự cân hai cột cho
          đều. Đây mới là thứ chủ dự án muốn.

          `break-inside-avoid` trên từng khối là bắt buộc — thiếu nó thì một
          khối có thể bị cắt đôi, nửa nằm cuối cột trái nửa nằm đầu cột phải.

          Chỉ chia cột từ `xl` trở lên: dưới mức đó, thanh trượt trọng số và ô
          tìm podcast bị bóp quá hẹp, khó bấm hơn là phải cuộn. */}
      <div className="mt-8 xl:columns-2 xl:[column-gap:2.5rem]">
        {/* Đặt ô đầu tiên có chủ đích: đây là thứ thấy ngay bằng mắt và đổi
            thường xuyên nhất, khác với trọng số chấm điểm vốn đặt một lần
            rồi thôi. */}
        <div className="mb-10 break-inside-avoid">
          <ChonTongMau />
        </div>

        <div className="mb-10 break-inside-avoid">
          <section>
            <h2 className="text-base font-semibold">Chủ đề con của từng chuyên mục</h2>
            <div className="mt-2">
              <CauHinhChuDeCon cacNhom={nhomChuDe} />
            </div>
          </section>
        </div>

        <div className="mb-10 break-inside-avoid">
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
            // cột của bố cục hai cột bên ngoài; chia đôi lần nữa thì mỗi thanh
            // trượt chỉ còn chừng 200px — kéo không nổi.
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
        </div>

        <div className="mb-10 break-inside-avoid">
        <ThanhTyLeNguonMoi
          laChu={laChu}
          cacMuc={CHUYEN_MUC_CHINH_DUOC.map((m) => ({
            ...m,
            tyLe: tyLeNguonMoi[m.ma] ?? 30,
          }))}
        />
        </div>

        <div className="mb-10 break-inside-avoid">
        <ThemPodcast
          laChu={laChu}
          daThem={kenhPodcast.map((k) => ({
            id: k.id,
            ten: k.title,
            soTap: k._count.contentItems,
            duongDanFeed: k.externalId,
          }))}
        />
        </div>

        <div className="mb-10 break-inside-avoid">
        <DatHangNgauHung
          laChu={laChu}
          banDau={
            donNgauHung
              ? {
                  yeuCau: donNgauHung.yeuCau ?? "",
                  chuDeCon: donNgauHung.chuDeCon,
                  quetLanCuoi:
                    donNgauHung.lastScannedAt?.toLocaleString("vi-VN", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    }) ?? null,
                  soBaiTimDuoc: donNgauHung.resultCount,
                }
              : null
          }
        />
        </div>

        <div className="mb-10 break-inside-avoid">
        <ThemSoundCloud
          laChu={laChu}
          daThem={kenhSoundCloud.map((k) => ({
            id: k.id,
            ten: k.title,
            soBai: k._count.contentItems,
            trangChu: k.url,
          }))}
        />
        </div>

        <div className="mb-10 break-inside-avoid">
        <TinhHinhGiongDoc
          tinhHinh={tinhHinhTts}
          daCoKhoa={daCauHinh()}
          giongDangChon={caiDatTroLy?.ttsVoice ?? GIONG_MAC_DINH}
          tocDoDangDung={caiDatTroLy?.ttsSpeed ?? 1}
          laChu={laChu}
        />
        </div>

        <div className="mb-10 break-inside-avoid">
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
      </div>
    </KhungTrang>
  );
}
