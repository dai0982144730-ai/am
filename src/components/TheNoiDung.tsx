/**
 * Thẻ một nội dung trên trang chủ — bám theo bản demo `docs/demo-ui.html`:
 * ảnh 16:9, thời lượng ở góc, tiêu đề tối đa hai dòng, dòng dưới là nguồn và
 * mấy thông tin phụ.
 *
 * Nhãn góc trái thay đổi theo chuyên mục: truyện hiện thể loại, nhạc hiện số
 * nhịp. Đó là thứ giúp liếc qua là biết ngay, không phải đọc tiêu đề.
 */

import Link from "next/link";

import { MenuBaCham } from "@/components/MenuBaCham";
import { NutDoiViTri } from "@/components/NutDoiViTri";
import type { TheNoiDung } from "@/lib/nghiepVu/layNoiDungTrangChu";
import { ngheDuocBangTiengViet } from "@/lib/tiengViet/loc";

/** Đổi giây thành dạng "12:04" hoặc "1:02:40". */
function docThoiLuong(giay: number | null): string | null {
  if (!giay) return null;
  const gio = Math.floor(giay / 3600);
  const phut = Math.floor((giay % 3600) / 60);
  const du = giay % 60;
  const haiSo = (n: number) => String(n).padStart(2, "0");
  return gio > 0
    ? `${gio}:${haiSo(phut)}:${haiSo(du)}`
    : `${phut}:${haiSo(du)}`;
}

/** Đổi 890000 thành "890 N", 1400000 thành "1,4 Tr" cho dễ liếc. */
function docLuotXem(so: number | null): string | null {
  if (so === null) return null;
  if (so >= 1_000_000) return `${(so / 1_000_000).toFixed(1).replace(".", ",")} Tr`;
  if (so >= 1_000) return `${Math.round(so / 1_000)} N`;
  return String(so);
}

/** "hôm nay", "hôm qua", "3 ngày trước"… */
function docThoiGian(luc: Date | null): string | null {
  if (!luc) return null;
  const soNgay = Math.floor((Date.now() - luc.getTime()) / 86_400_000);
  if (soNgay <= 0) return "hôm nay";
  if (soNgay === 1) return "hôm qua";
  if (soNgay < 7) return `${soNgay} ngày trước`;
  if (soNgay < 30) return `${Math.floor(soNgay / 7)} tuần trước`;
  return `${Math.floor(soNgay / 30)} tháng trước`;
}

const TEN_THE_LOAI_TRUYEN: Record<string, string> = {
  kinh_di: "KINH DỊ",
  vien_tuong: "VIỄN TƯỞNG",
  phieu_luu_mao_hiem: "PHIÊU LƯU",
};

const TEN_THE_LOAI_NHAC: Record<string, string> = {
  workout_bpm: "TẬP LUYỆN",
  dance: "DANCE",
  piano: "PIANO",
  guitar_rock: "GUITAR ROCK",
  nhac_vang: "NHẠC VÀNG",
};

const TEN_DANG_TRINH_BAY: Record<string, string> = {
  giang_phap: "giảng pháp",
  van_dap: "vấn đáp",
  ung_dung_thuc_hanh: "ứng dụng thực hành",
  phan_tich_hoc_thuat: "phân tích học thuật",
};

const TEN_CHU_DE_AI: Record<string, string> = {
  claude_news: "tin Claude",
  ai_news_general: "tin AI",
  ai_agent_enterprise: "AI cho doanh nghiệp",
  coding_experience_howto: "kinh nghiệm viết code",
  claude_usage_guide: "hướng dẫn dùng Claude",
};

/**
 * Nhãn LOẠI NGUỒN ở góc phải ảnh — mỗi loại một màu riêng.
 *
 * Chủ dự án yêu cầu 2026-08-15. Liếc một cái là biết thứ này đến từ đâu mà
 * không phải đọc tên kênh: video YouTube, bài blog, bài diễn đàn, tập podcast
 * hay bản nhạc SoundCloud — mỗi loại xử sự một kiểu khi bấm vào, nên biết
 * trước thì đỡ bị hụt.
 *
 * Năm màu chọn cách xa nhau trên vòng màu để phân biệt được cả khi nhìn lướt,
 * và đều là màu đậm chữ trắng để nổi trên ảnh nền bất kể ảnh sáng hay tối.
 */
const NHAN_NGUON: Record<string, { ten: string; mau: string }> = {
  youtube_channel: { ten: "YOUTUBE", mau: "bg-red-600/90" },
  blog_feed: { ten: "BLOG", mau: "bg-sky-600/90" },
  forum_community: { ten: "DIỄN ĐÀN", mau: "bg-violet-600/90" },
  podcast_rss: { ten: "PODCAST", mau: "bg-emerald-600/90" },
  soundcloud_channel: { ten: "SOUNDCLOUD", mau: "bg-amber-600/90" },
};

/** Nhãn nổi ở góc trái ảnh — mỗi chuyên mục một kiểu thông tin. */
function nhanGoc(muc: NonNullable<TheNoiDung>): string | null {
  // NGHE ĐƯỢC hay CHƯA là thông tin quan trọng nhất với chủ nhà, nên nó đứng
  // trước mọi nhãn khác.
  //
  // ĐIỀU KIỆN LÀ **CÓ TIẾNG**, KHÔNG PHẢI CÓ CHỮ. Bản trước chỉ hỏi
  // `muc.narrationAsset` nên dán "ĐÃ THUẬT LẠI" cả lên bài mới dịch xong phần
  // chữ mà chưa đọc thành tiếng. Nhãn đó nói dối: chủ nhà thấy vậy tưởng bấm
  // vào là nghe được, mở ra thì chỉ có một bức tường chữ — đúng thứ app này
  // sinh ra để tránh.
  if (muc.narrationAsset?.ttsAudioUrl) return "ĐÃ THUẬT LẠI";

  // Tiếng nước ngoài mà chưa có tiếng Việt thì nói thẳng, đừng để lẫn vào như
  // thể nghe được. Đây KHÔNG phải để chê nội dung — nó đang xếp hàng lồng
  // tiếng. Xem lib/tiengViet/loc.ts.
  if (!ngheDuocBangTiengViet(muc)) return "CHỜ LỒNG TIẾNG";

  const pl = muc.classification;
  if (!pl) return null;

  if (muc.contentGroup === "truyen" && pl.storyGenre) {
    return TEN_THE_LOAI_TRUYEN[pl.storyGenre] ?? null;
  }
  if (muc.contentGroup === "music") {
    if (pl.bpm) return `${pl.bpm} BPM`;
    if (pl.musicGenre) return TEN_THE_LOAI_NHAC[pl.musicGenre] ?? null;
  }
  if (muc.contentGroup === "ai" && pl.aiSubtopic) {
    return (TEN_CHU_DE_AI[pl.aiSubtopic] ?? "").toUpperCase() || null;
  }
  return null;
}

/** Dòng phụ dưới tên nguồn — thông tin riêng của từng chuyên mục. */
function thongTinPhu(muc: NonNullable<TheNoiDung>): string[] {
  const pl = muc.classification;
  const phan: string[] = [];
  if (!pl) return phan;

  if (pl.extractedAuthorNameRaw) phan.push(pl.extractedAuthorNameRaw);

  if (muc.contentGroup === "triet_hoc") {
    if (pl.philosophyContentForm) {
      phan.push(TEN_DANG_TRINH_BAY[pl.philosophyContentForm] ?? "");
    }
    if (pl.listenerLevel) {
      phan.push(pl.listenerLevel === "chuyen_sau" ? "chuyên sâu" : "mới bắt đầu");
    }
  }

  if (muc.contentGroup === "truyen" && pl.storyIntensity) {
    const doCang: Record<string, string> = {
      nhe_nhang: "nhẹ nhàng",
      cang_thang: "căng thẳng",
      kinh_khung: "kinh khủng",
    };
    phan.push(doCang[pl.storyIntensity] ?? "");
  }

  if (muc.narrationType === "ai_tts") phan.push("giọng máy");

  return phan.filter(Boolean);
}

export function TheNoiDungCard({
  muc,
  trongPlaylistId,
  viTri,
}: {
  muc: NonNullable<TheNoiDung>;
  /** Có giá trị khi thẻ này hiện trong trang chi tiết một playlist */
  trongPlaylistId?: string;
  /** Vị trí trong danh sách playlist — để biết có phải đầu/cuối, ẩn nút tương ứng */
  viTri?: { laDau: boolean; laCuoi: boolean };
}) {
  const thoiLuong = docThoiLuong(muc.durationSeconds);
  const luotXem = docLuotXem(muc.viewOrPlayCount);
  const khiNao = docThoiGian(muc.publishedAt);
  const nhan = nhanGoc(muc);
  const nhanNguon = NHAN_NGUON[muc.source.type];
  const phu = thongTinPhu(muc);

  // Đã lưu vào playlist nào chưa — bỏ qua playlist đang xem dở (trang chi
  // tiết playlist), vì tự nói lại tên chính nó thì thừa. Còn nhiều hơn một
  // cái thì thêm "+N", không liệt kê hết cho chật nút.
  const cacPlaylistKhac = muc.playlistItems
    .map((p) => p.playlist)
    .filter((p) => p.id !== trongPlaylistId);
  const nhanPlaylist =
    cacPlaylistKhac.length > 0
      ? cacPlaylistKhac[0].title +
        (cacPlaylistKhac.length > 1 ? ` +${cacPlaylistKhac.length - 1}` : "")
      : null;

  return (
    <Link href={`/xem/${muc.id}`} className="group flex flex-col gap-2">
      <div className="relative aspect-video overflow-hidden rounded-xl bg-neutral-200 dark:bg-neutral-800">
        {muc.thumbnailUrl ? (
          // Ảnh từ YouTube, dùng thẻ img thường cho khỏi phải khai miền ảnh
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={muc.thumbnailUrl}
            alt=""
            loading="lazy"
            className="size-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
          />
        ) : null}

        {nhan ? (
          <span className="absolute left-2 top-2 rounded-md bg-black/75 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-white">
            {nhan}
          </span>
        ) : null}

        {/* Loại nguồn — góc phải TRÊN, để không đụng nhãn chuyên mục bên trái
            và không đụng thời lượng ở góc phải dưới */}
        {nhanNguon ? (
          <span
            className={`absolute right-2 top-2 rounded-md px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-white ${nhanNguon.mau}`}
          >
            {nhanNguon.ten}
          </span>
        ) : null}

        {thoiLuong ? (
          <span className="absolute bottom-2 right-2 rounded-md bg-black/80 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-white">
            {thoiLuong}
          </span>
        ) : null}

        <MenuBaCham
          contentItemId={muc.id}
          trongPlaylistId={trongPlaylistId}
          nhanPlaylist={nhanPlaylist}
        />

        {/* Điểm chất lượng — bốn trụ tín hiệu đã chuẩn hoá trong cùng loại nguồn */}
        {muc.score?.compositeScore != null ? (
          <span
            title="Điểm chất lượng trên thang 10, tính theo bốn trụ tín hiệu"
            className="absolute bottom-2 left-2 rounded-md bg-white/90 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-neutral-900"
          >
            {muc.score.compositeScore.toFixed(1)}
          </span>
        ) : null}
      </div>

      <div>
        {trongPlaylistId && viTri ? (
          <div className="mb-1">
            <NutDoiViTri
              playlistId={trongPlaylistId}
              contentItemId={muc.id}
              laDau={viTri.laDau}
              laCuoi={viTri.laCuoi}
            />
          </div>
        ) : null}
        <h3 className="line-clamp-2 text-sm font-medium leading-snug text-neutral-900 group-hover:text-neutral-600 dark:text-neutral-100 dark:group-hover:text-neutral-300">
          {/* Tiêu đề tiếng Việt nếu Claude đã dịch, không thì dùng gốc.
              Phần lớn nguồn khoa học và AI hay là báo tiếng Anh — lướt trang
              chủ mà gặp cả hàng tiêu đề tiếng Anh thì khó quyết mở cái nào. */}
          {muc.classification?.titleVi || muc.title}
        </h3>
        <p className="mt-1 line-clamp-1 text-xs text-neutral-500 dark:text-neutral-400">
          {/* Nói rõ đây là nguồn chưa theo dõi, để liếc một cái là biết nên
              soi kỹ hay tin ngay — đúng thứ chủ nhà cần khi bật tỉ lệ nguồn
              mới lên cao */}
          {muc.source.subscriptionStatus !== "subscribed" ? (
            <span className="mr-1.5 rounded bg-cam-100 px-1.5 py-0.5 text-[10px] font-medium text-cam-700 dark:bg-cam-700/30 dark:text-cam-300">
              nguồn mới
            </span>
          ) : null}
          {muc.source.title}
          {phu.length > 0 ? ` · ${phu.join(" · ")}` : ""}
        </p>
        <p className="mt-0.5 text-xs text-neutral-400 dark:text-neutral-500">
          {[luotXem ? `${luotXem} lượt xem` : null, khiNao]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
    </Link>
  );
}
