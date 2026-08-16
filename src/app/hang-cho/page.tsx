/**
 * Trang Hàng chờ — "tôi có 20 phút" thì xếp cho vừa khít 20 phút.
 *
 * Mọi lựa chọn nằm trong địa chỉ trang (`?phut=30&nhom=triet_hoc`), nên mỗi
 * nhóm đúng một tham số và "chỉ chọn được một" là chuyện tự nhiên — cùng cách
 * làm với trang Khám phá, và cũng nhờ vậy mà gửi được đường dẫn của một hàng
 * chờ cho chính mình ở máy khác.
 */

import { Headphones, Timer } from "lucide-react";
import Link from "next/link";

import { KhungTrang } from "@/components/KhungTrang";
import { TrinhPhatHangCho } from "@/components/TrinhPhatHangCho";
import { prisma } from "@/lib/db/prisma";
import {
  CAC_DAI_NHIP,
  CAC_MOC_PHUT,
  xepHangTheoNhip,
  xepHangTheoThoiGian,
  type CheDoNghe,
  type HangCho,
  type MucHangCho,
} from "@/lib/hangCho/xepHang";
import { emailChuDuAn } from "@/lib/quyen";

export const dynamic = "force-dynamic";

const TEN_NHOM: Record<string, string> = {
  ai: "AI",
  triet_hoc: "Triết học",
  truyen: "Truyện",
  music: "Nhạc",
  khoa_hoc: "Khoa học",
};

const PHUT_MAC_DINH = 30;

function docPhut(x: string | undefined): number {
  const n = Number(x);
  return CAC_MOC_PHUT.includes(n as never) ? n : PHUT_MAC_DINH;
}

function docThoiLuong(giay: number): string {
  const phut = Math.round(giay / 60);
  if (phut < 60) return `${phut} phút`;
  const gio = Math.floor(phut / 60);
  const le = phut % 60;
  // "1 giờ 0 phút" là câu không ai nói
  return le === 0 ? `${gio} giờ` : `${gio} giờ ${le} phút`;
}

export default async function TrangHangCho({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const tham = await searchParams;

  const phut = docPhut(tham.phut);
  const nhom = tham.nhom && TEN_NHOM[tham.nhom] ? tham.nhom : undefined;
  const cheDo: CheDoNghe = tham.che_do === "chi_nghe" ? "chi_nghe" : "tat_ca";
  const daiNhip = CAC_DAI_NHIP.find((d) => d.ma === tham.nhip);

  const [email, caiDat, hangCho] = await Promise.all([
    emailChuDuAn(),
    prisma.userAssistantSettings.findUnique({
      where: { id: "singleton" },
      select: { ttsSpeed: true },
    }),
    daiNhip
      ? xepHangTheoNhip(phut, daiNhip.tu, daiNhip.den)
      : xepHangTheoThoiGian(phut, nhom, cheDo),
  ]);

  /** Giữ nguyên các lựa chọn khác, chỉ đổi một tham số. */
  function duongDan(khoa: string, giaTri: string | undefined): string {
    const moi = new URLSearchParams();
    for (const [k, v] of Object.entries(tham)) {
      if (v && k !== khoa) moi.set(k, v);
    }
    if (giaTri) moi.set(khoa, giaTri);
    const q = moi.toString();
    return q ? `/hang-cho?${q}` : "/hang-cho";
  }

  return (
    <KhungTrang emailNguoiDung={email}>
      {/* `pb-24`: nút trò chuyện tròn nằm cố định ở góc phải dưới, và trên màn
          hình điện thoại nó đè lên đúng hàng chọn tốc độ của trình phát. Chừa
          khoảng trống đáy thì không thứ gì rơi vào vùng bị che */}
      <div className="w-full px-4 py-6 pb-24 sm:px-6 lg:px-8">
        <h1 className="text-xl font-semibold tracking-tight">Hàng chờ</h1>
        <p className="mt-1.5 max-w-2xl text-sm text-neutral-500 dark:text-neutral-400">
          Danh sách xếp theo điểm trả lời câu &ldquo;cái nào hay nhất&rdquo;.
          Người đang lái xe về nhà hỏi câu khác: từ giờ tới lúc về, nghe hết
          được cái gì. Trang này trả lời câu đó.
        </p>

        {/* ---- Hàng chọn: có bao nhiêu phút ---- */}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
            <Timer size={14} /> Tôi có
          </span>
          {CAC_MOC_PHUT.map((m) => (
            <Nut
              key={m}
              href={duongDan("phut", String(m))}
              dangChon={phut === m}
            >
              {m} phút
            </Nut>
          ))}
        </div>

        {/* ---- Hàng chọn: chuyên mục ---- */}
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
            Chuyên mục
          </span>
          <Nut href={duongDan("nhom", undefined)} dangChon={!nhom && !daiNhip}>
            Tất cả
          </Nut>
          {Object.entries(TEN_NHOM).map(([ma, ten]) => (
            <Nut
              key={ma}
              href={duongDan("nhom", ma)}
              dangChon={nhom === ma && !daiNhip}
            >
              {ten}
            </Nut>
          ))}
        </div>

        {/* ---- Hàng chọn: chế độ nghe ---- */}
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
            <Headphones size={14} /> Chế độ
          </span>
          <Nut href={duongDan("che_do", undefined)} dangChon={cheDo === "tat_ca"}>
            Xem hoặc nghe
          </Nut>
          <Nut
            href={duongDan("che_do", "chi_nghe")}
            dangChon={cheDo === "chi_nghe"}
          >
            Chỉ nghe
          </Nut>
        </div>

        {/* ---- Hàng chọn: nhịp tập ---- */}
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
            Nhạc theo nhịp
          </span>
          <Nut href={duongDan("nhip", undefined)} dangChon={!daiNhip}>
            Không dùng
          </Nut>
          {CAC_DAI_NHIP.map((d) => (
            <Nut
              key={d.ma}
              href={duongDan("nhip", d.ma)}
              dangChon={daiNhip?.ma === d.ma}
            >
              {d.nhan}
            </Nut>
          ))}
        </div>

        {daiNhip ? (
          <p className="mt-3 rounded-lg bg-neutral-50 px-3 py-2 text-xs leading-relaxed text-neutral-600 dark:bg-neutral-900 dark:text-neutral-300">
            Xếp theo đường cong khởi động → cao trào → giãn cơ, vì buổi tập
            không kết thúc ở lúc mệt nhất. Bài không ghi rõ số nhịp thì không
            lọt vào đây — thà thiếu bài còn hơn gắn nhịp đoán mò làm lệch cả
            buổi.
          </p>
        ) : null}

        <TomTat hangCho={hangCho} />

        {hangCho.cacMuc.length > 0 ? (
          <div className="mt-4 max-w-3xl">
            <TrinhPhatHangCho
              cacMuc={hangCho.cacMuc}
              tocDoMacDinh={caiDat?.ttsSpeed ?? 1}
            />
            <ol className="mt-4 space-y-1">
              {hangCho.cacMuc.map((m, i) => (
                <MucTrongHang key={m.id} muc={m} thuTu={i + 1} />
              ))}
            </ol>
          </div>
        ) : (
          <div className="mt-6 max-w-3xl rounded-xl border border-dashed border-neutral-300 p-10 text-center dark:border-neutral-700">
            <p className="text-sm text-neutral-500">
              {daiNhip
                ? "Chưa có bài nhạc nào ghi rõ số nhịp trong dải này."
                : cheDo === "chi_nghe"
                  ? "Chưa có nội dung nào nghe được bằng tai trong chuyên mục này. Podcast và bài đã có bản đọc tiếng Việt mới vào được chế độ chỉ nghe."
                  : "Không còn nội dung chưa lướt qua nào để xếp."}
            </p>
          </div>
        )}
      </div>
    </KhungTrang>
  );
}

function TomTat({ hangCho }: { hangCho: HangCho }) {
  if (hangCho.cacMuc.length === 0) return null;

  const soNgheDuoc = hangCho.cacMuc.filter((m) => m.amThanh).length;
  const thieu = hangCho.thieuGiay;

  return (
    <p className="mt-5 text-sm text-neutral-600 dark:text-neutral-300">
      <span className="font-semibold">
        {hangCho.cacMuc.length} bài · {docThoiLuong(hangCho.tongGiay)}
      </span>{" "}
      <span className="text-neutral-500 dark:text-neutral-400">
        so với {docThoiLuong(hangCho.nganSachGiay)} bạn có
        {Math.abs(thieu) >= 60
          ? thieu > 0
            ? ` · còn dư ${docThoiLuong(thieu)}`
            : ` · tràn ${docThoiLuong(-thieu)}`
          : " · khít"}
        {soNgheDuoc > 0
          ? ` · ${soNgheDuoc} bài nghe thẳng được`
          : " · chưa bài nào nghe thẳng được"}
      </span>
    </p>
  );
}

function MucTrongHang({ muc, thuTu }: { muc: MucHangCho; thuTu: number }) {
  return (
    <li>
      <Link
        href={`/xem/${muc.id}`}
        className="group flex items-start gap-3 rounded-lg px-2 py-2 hover:bg-neutral-50 dark:hover:bg-neutral-900"
      >
        <span className="mt-0.5 w-5 shrink-0 text-right text-xs tabular-nums text-neutral-400 dark:text-neutral-500">
          {thuTu}
        </span>
        <span className="min-w-0 flex-1">
          <span className="line-clamp-1 text-sm group-hover:text-cam-600 dark:group-hover:text-cam-300">
            {muc.tieuDe}
          </span>
          <span className="text-xs text-neutral-500 dark:text-neutral-400">
            {muc.tenNguon} · {docThoiLuong(muc.thoiLuong)}
            {muc.bpm ? ` · ${muc.bpm} nhịp` : ""}
            {muc.laBanDoc ? " · bản đọc tiếng Việt" : ""}
            {!muc.amThanh ? " · mở trang để xem" : ""}
          </span>
        </span>
      </Link>
    </li>
  );
}

function Nut({
  href,
  dangChon,
  children,
}: {
  href: string;
  dangChon: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
        dangChon
          ? "bg-cam-600 text-white dark:bg-cam-500 dark:text-neutral-950"
          : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
      }`}
    >
      {children}
    </Link>
  );
}
