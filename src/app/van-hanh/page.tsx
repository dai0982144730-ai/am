/**
 * Trang Vận hành — hạn mức, chi phí, lịch chạy.
 *
 * Trang duy nhất trong app không nói về nội dung mà nói về **chính app**. Mọi
 * con số ở đây đã nằm sẵn trong database từ lâu; việc của trang này chỉ là bày
 * ra, và bày sao cho câu "có ổn không" trả lời được trong ba giây đầu — nên
 * bốn ô tóm tắt lên trên cùng, chi tiết đẩy xuống dưới.
 */

import { AlertTriangle, CheckCircle2, Download, XCircle } from "lucide-react";

import { KhoiCuongDoVaSuat } from "@/components/KhoiCuongDoVaSuat";
import { KhungTrang } from "@/components/KhungTrang";
import { emailChuDuAn, laChuDuAn } from "@/lib/quyen";
import { docCuongDo } from "@/lib/vanHanh/cuongDo";
import { docCaiDatSuat } from "@/lib/vanHanh/suatPhanLoai";
import { prisma } from "@/lib/db/prisma";
import {
  docTinhHinhVanHanh,
  type LanChay,
  type TinhHinhVanHanh,
} from "@/lib/vanHanh/tinhHinh";
import type { ContentStatus } from "@/generated/prisma/enums";
import type { TenLenh } from "@/lib/youtube/giaLenh";

export const dynamic = "force-dynamic";

/**
 * Tên người-đọc-được cho từng lệnh YouTube.
 *
 * Kiểu là `Record<TenLenh, string>` chứ không phải `Record<string, string>`:
 * thêm một lệnh vào bảng giá mà quên đặt tên tiếng Việt thì TypeScript báo lỗi
 * ngay, thay vì để màn hình lòi ra chữ "commentThreads.list" giữa một trang
 * toàn tiếng Việt.
 */
const TEN_LENH: Record<TenLenh, string> = {
  "search.list": "Tìm kiếm",
  "videos.list": "Đọc thông tin video",
  "playlistItems.list": "Đọc danh sách phát",
  "channels.list": "Đọc thông tin kênh",
  "subscriptions.list": "Đọc kênh đã đăng ký",
  "playlists.list": "Đọc playlist",
  "commentThreads.list": "Đọc bình luận",
  "playlists.insert": "Tạo playlist",
  "playlistItems.insert": "Thêm vào playlist",
  "playlistItems.delete": "Xoá khỏi playlist",
};

/**
 * Tên lệnh đọc từ database là chuỗi tự do, nên vẫn phải chừa đường lui: một
 * dòng cũ ghi lệnh nay đã bỏ thì hiện nguyên tên gốc chứ không hiện "undefined".
 */
function tenLenh(lenh: string): string {
  return TEN_LENH[lenh as TenLenh] ?? lenh;
}

const TEN_TRANG_THAI: Record<string, string> = {
  running: "Đang chạy",
  success: "Xong",
  failed: "Hỏng",
  partial: "Xong một phần",
};

function so(n: number): string {
  return n.toLocaleString("vi-VN");
}

function gioPhut(luc: Date): string {
  return luc.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function docKeoDai(giay: number | null): string {
  if (giay === null) return "…";
  if (giay < 60) return `${giay} giây`;
  const phut = Math.floor(giay / 60);
  return phut < 60 ? `${phut} phút` : `${Math.floor(phut / 60)} giờ ${phut % 60} phút`;
}

/**
 * Đếm hàng đang chờ phân loại theo ba nhóm nguồn.
 *
 * Dùng để nói thẳng chỗ nào hụt ngay dưới thanh trượt: đặt 45% podcast trong
 * khi cả kho chỉ có 4 kênh podcast thì con số ấy không bao giờ lấp được, và
 * người dùng phải nhìn thấy điều đó chứ không phải tự đoán.
 */
async function demHangCho() {
  const dk = {
    status: {
      in: ["pending_classification", "transcript_unavailable"] as ContentStatus[],
    },
    classification: null,
  };
  const [youtube, nghe, viet] = await Promise.all([
    prisma.contentItem.count({
      where: { ...dk, source: { type: "youtube_channel" } },
    }),
    prisma.contentItem.count({
      where: {
        ...dk,
        source: { type: { in: ["podcast_rss", "soundcloud_channel"] } },
      },
    }),
    prisma.contentItem.count({
      where: {
        ...dk,
        source: { type: { in: ["blog_feed", "forum_community"] } },
      },
    }),
  ]);
  return { youtube, nghe, viet };
}

export default async function TrangVanHanh() {
  const [email, laChu, tinhHinh, cuongDo, caiDatSuat, hangCon] =
    await Promise.all([
      emailChuDuAn(),
      laChuDuAn(),
      docTinhHinhVanHanh(),
      docCuongDo(),
      docCaiDatSuat(),
      demHangCho(),
    ]);

  const { youtube, tts, cacLanChay, troLyApi, cacPhienBanDiem } = tinhHinh;
  const lanChayCuoi = cacLanChay[0] ?? null;

  return (
    <KhungTrang emailNguoiDung={email}>
      <div className="w-full px-4 py-6 sm:px-6 lg:px-8">
        <h1 className="text-xl font-semibold tracking-tight">Vận hành</h1>
        <p className="mt-1.5 max-w-2xl text-sm text-neutral-500 dark:text-neutral-400">
          App tiêu hạn mức của Google mỗi ngày, và hết hạn mức thì mọi việc dừng
          tới hôm sau. Trang này để biết trước khi điều đó xảy ra.
        </p>

        {/* Bốn ô tóm tắt — trả lời "có ổn không" mà không phải đọc gì thêm */}
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <OTomTat
            nhan="Hạn mức YouTube hôm nay"
            giaTri={`${so(youtube.daDung)} / ${so(youtube.nganSach)}`}
            phuDe={
              youtube.daChamMocNgat
                ? `Đã quá mốc ${so(youtube.mocNgat)} — phần tìm kiếm đang tạm ngừng`
                : `Còn ${so(youtube.conLai)} đơn vị`
            }
            tyLe={youtube.daDung / youtube.nganSach}
            mucBao={youtube.daChamMocNgat ? "canh_bao" : "on"}
          />
          <OTomTat
            nhan={`Đọc thành tiếng · tháng ${tts.thang}`}
            giaTri={`${Math.round(tts.phanTram * 100)}%`}
            phuDe={`${so(tts.daDung)} / ${so(tts.tran)} ký tự miễn phí`}
            tyLe={tts.phanTram}
            mucBao={tts.daKhoa ? "hong" : tts.sapHet ? "canh_bao" : "on"}
          />
          <OTomTat
            nhan="Lần chạy gần nhất"
            giaTri={lanChayCuoi ? gioPhut(lanChayCuoi.batDau) : "Chưa có"}
            phuDe={
              lanChayCuoi
                ? `${lanChayCuoi.loai} · ${TEN_TRANG_THAI[lanChayCuoi.trangThai] ?? lanChayCuoi.trangThai}`
                : "Chưa lần nào chạy tự động"
            }
            mucBao={
              !lanChayCuoi
                ? "on"
                : lanChayCuoi.trangThai === "failed"
                  ? "hong"
                  : "on"
            }
          />
          <OTomTat
            nhan="Cổng API trợ lý · 30 ngày"
            giaTri={so(troLyApi.soLanGoi)}
            phuDe={
              troLyApi.soLanGoi === 0
                ? "Chưa ai gọi"
                : `${troLyApi.soLanLoi} lỗi · trung bình ${so(troLyApi.trungBinhMs)}ms`
            }
            mucBao={troLyApi.soLanLoi > 0 ? "canh_bao" : "on"}
          />
        </div>

        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-2">
          <BangHanMucYouTube tinhHinh={tinhHinh} />
          <div className="space-y-8">
            <KhoiCuongDoVaSuat
              cuongDoBanDau={cuongDo}
              suatBanDau={caiDatSuat}
              hangCon={hangCon}
              choPhepSua={laChu}
            />
            <BangLichChay cacLanChay={cacLanChay} />
            <BangPhienBanDiem
              cacPhienBanDiem={cacPhienBanDiem}
              phienBanHoSoGu={tinhHinh.phienBanHoSoGu}
            />
            {laChu ? <KhoiXuatDuLieu /> : null}
          </div>
        </div>
      </div>
    </KhungTrang>
  );
}

function OTomTat({
  nhan,
  giaTri,
  phuDe,
  tyLe,
  mucBao,
}: {
  nhan: string;
  giaTri: string;
  phuDe: string;
  /** 0–1. Có thì vẽ thêm thanh mức; không có thì thôi */
  tyLe?: number;
  mucBao: "on" | "canh_bao" | "hong";
}) {
  const mau =
    mucBao === "hong"
      ? "text-red-600 dark:text-red-400"
      : mucBao === "canh_bao"
        ? "text-amber-600 dark:text-amber-400"
        : "text-neutral-900 dark:text-neutral-100";
  const mauThanh =
    mucBao === "hong"
      ? "bg-red-500"
      : mucBao === "canh_bao"
        ? "bg-amber-500"
        : "bg-cam-500";

  return (
    <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
        {nhan}
      </p>
      <p
        className={`mt-1.5 text-2xl font-semibold tabular-nums tracking-tight ${mau}`}
      >
        {giaTri}
      </p>
      {tyLe !== undefined ? (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
          <div
            className={`h-full rounded-full ${mauThanh}`}
            style={{ width: `${Math.min(100, Math.round(tyLe * 100))}%` }}
          />
        </div>
      ) : null}
      <p className="mt-2 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
        {phuDe}
      </p>
    </div>
  );
}

function BangHanMucYouTube({ tinhHinh }: { tinhHinh: TinhHinhVanHanh }) {
  const { lichSu, nganSach } = tinhHinh.youtube;
  const caoNhat = Math.max(nganSach, ...lichSu.map((n) => n.daDung));

  return (
    <section>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
        Hạn mức YouTube · 14 ngày
      </h2>
      <p className="mt-1.5 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
        Google cấp lại 10.000 đơn vị mỗi ngày lúc 0h giờ Thái Bình Dương —
        khoảng 14–15h giờ Việt Nam. Một lần tìm kiếm tốn 100 đơn vị, đọc danh
        sách video của một kênh quen chỉ tốn 1. Đó là lý do app quét kênh quen
        thay vì tìm kiếm.
      </p>

      {lichSu.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-500 dark:border-neutral-700">
          Hai tuần qua chưa gọi YouTube lần nào.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {lichSu.map((ngay) => (
            <li key={ngay.ngay.toISOString()}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-medium">
                  {ngay.ngay.toLocaleDateString("vi-VN", {
                    day: "2-digit",
                    month: "2-digit",
                    timeZone: "UTC",
                  })}
                </span>
                <span className="tabular-nums text-neutral-500 dark:text-neutral-400">
                  {so(ngay.daDung)} đơn vị
                </span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
                <div
                  className="h-full rounded-full bg-cam-500"
                  style={{ width: `${Math.round((ngay.daDung / caoNhat) * 100)}%` }}
                />
              </div>
              <p className="mt-1 text-[11px] text-neutral-400 dark:text-neutral-500">
                {ngay.theoLenh
                  .map(
                    (l) => `${tenLenh(l.lenh)} ×${l.soLan} = ${so(l.donVi)}`,
                  )
                  .join(" · ")}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function BangLichChay({ cacLanChay }: { cacLanChay: LanChay[] }) {
  return (
    <section>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
        Các lần chạy gần nhất
      </h2>

      {cacLanChay.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-500 dark:border-neutral-700">
          Chưa có lần chạy nào được ghi lại.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-neutral-100 dark:divide-neutral-800">
          {cacLanChay.map((lan) => (
            <li key={lan.id} className="flex items-start gap-3 py-2.5">
              <BieuTuongTrangThai trangThai={lan.trangThai} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{lan.loai}</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  {gioPhut(lan.batDau)} · {docKeoDai(lan.keoDai)}
                  {lan.soLanThu > 1 ? ` · thử ${lan.soLanThu} lần` : ""}
                  {lan.soNoiDungMoi !== undefined
                    ? ` · ${lan.soNoiDungMoi} nội dung mới`
                    : ""}
                </p>
                {lan.loi ? (
                  <p className="mt-1 line-clamp-2 text-xs text-red-600 dark:text-red-400">
                    {lan.loi}
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function BieuTuongTrangThai({ trangThai }: { trangThai: string }) {
  if (trangThai === "failed") {
    return (
      <XCircle
        size={16}
        className="mt-0.5 shrink-0 text-red-500 dark:text-red-400"
      />
    );
  }
  if (trangThai === "running" || trangThai === "partial") {
    return (
      <AlertTriangle
        size={16}
        className="mt-0.5 shrink-0 text-amber-500 dark:text-amber-400"
      />
    );
  }
  return (
    <CheckCircle2
      size={16}
      className="mt-0.5 shrink-0 text-emerald-500 dark:text-emerald-400"
    />
  );
}

function BangPhienBanDiem({
  cacPhienBanDiem,
  phienBanHoSoGu,
}: {
  cacPhienBanDiem: TinhHinhVanHanh["cacPhienBanDiem"];
  phienBanHoSoGu: TinhHinhVanHanh["phienBanHoSoGu"];
}) {
  const tronPhienBan = cacPhienBanDiem.length > 1;

  return (
    <section>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
        Phiên bản chấm điểm
      </h2>
      <p className="mt-1.5 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
        Đổi công thức chấm thì điểm cũ và điểm mới không còn so được với nhau.
        Chừng nào còn hai phiên bản cùng tồn tại, bảng xếp hạng đang trộn hai
        thước đo.
      </p>

      {cacPhienBanDiem.length === 0 ? (
        <p className="mt-3 text-sm text-neutral-500">Chưa chấm điểm nội dung nào.</p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {cacPhienBanDiem.map((p) => (
            <li
              key={p.phienBan}
              className="flex items-baseline justify-between gap-3 text-sm"
            >
              <span className="font-medium">{p.phienBan}</span>
              <span className="tabular-nums text-neutral-500 dark:text-neutral-400">
                {so(p.soNoiDung)} nội dung
                {p.tinhLanCuoi ? ` · mới nhất ${gioPhut(p.tinhLanCuoi)}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}

      {tronPhienBan ? (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-300">
          Đang trộn {cacPhienBanDiem.length} phiên bản — chấm lại phần cũ để bảng
          xếp hạng nói cùng một thứ tiếng.
        </p>
      ) : null}

      <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
        Hồ sơ gu cá nhân:{" "}
        {phienBanHoSoGu
          ? `bản ${phienBanHoSoGu.phienBan}, dựng ${gioPhut(phienBanHoSoGu.taoLuc)}`
          : "chưa dựng lần nào"}
      </p>
    </section>
  );
}

function KhoiXuatDuLieu() {
  return (
    <section>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
        Xuất dữ liệu cá nhân
      </h2>
      <p className="mt-1.5 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
        Lịch sử nghe, ghi chú, hồ sơ gu, tác giả đang theo dõi — tất cả nằm
        trong một database trên máy nhà. Ổ cứng hỏng là mất, và một năm lịch sử
        nghe thì không mua lại được. File tải về không chứa token đăng nhập
        Google và không chứa nội dung gốc (quét lại được).
      </p>
      <a
        href="/van-hanh/xuat"
        download
        className="mt-3 inline-flex items-center gap-2 rounded-lg bg-neutral-100 px-3.5 py-2 text-xs font-semibold text-neutral-700 transition-colors hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
      >
        <Download size={14} />
        Tải file JSON
      </a>
    </section>
  );
}
