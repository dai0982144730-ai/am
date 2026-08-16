"use client";

/**
 * Hai hàng lọc ngang trên trang Khám phá.
 *
 *   Hàng trên — CHUNG, giống hệt nhau ở mọi chuyên mục
 *   Hàng dưới — RIÊNG, đổi theo chuyên mục đang mở
 *
 * ## Mỗi nhóm chỉ chọn được một giá trị, và điều đó rơi ra từ chính cách lưu
 *
 * Chủ dự án chốt 2026-08-16: "ấn một cái là lọc cái đó thôi". Cách làm ở đây là
 * **mỗi nhóm dùng đúng một tham số trên địa chỉ trang**. Nhờ vậy tính loại trừ
 * không phải viết bằng tay chỗ nào cả:
 *
 *   - "Mới nhất trước" và ba kiểu chất lượng cùng ghi vào `sap`, nên bật cái
 *     này thì cái kia tự tắt — chúng đều là cách sắp xếp, không thể cùng đúng.
 *   - "Kênh theo dõi" và "Kênh mới" cùng ghi vào `kenh`.
 *
 * Cách này còn vá một lỗi có thật của bản trước: hai nút "Dưới 10 phút" và
 * "Trên 20 phút" là hai tham số rời, bấm được cả hai, thành điều kiện
 * `≥ 20 phút VÀ ≤ 10 phút` — **luôn ra 0 kết quả mà không báo gì**.
 *
 * Mọi lựa chọn đều nằm trên địa chỉ trang, nên bấm quay lại là về đúng bộ lọc
 * cũ, và gửi đường dẫn cho người khác thì họ thấy đúng thứ mình thấy.
 */

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";

import {
  KhoiCauHinhNgauHung,
  type TuKhoaGon,
} from "@/components/KhoiCauHinhNgauHung";

interface LuaChon {
  ma: string;
  ten: string;
  /** Dòng giải thích nhỏ dưới tên, chỉ dùng khi tên chưa đủ rõ */
  ghi?: string;
}

interface NhomLoc {
  /** Tên tham số trên địa chỉ trang */
  khoa: string;
  ten: string;
  cac: LuaChon[];
}

// ==========================================================================
// CHUYÊN MỤC
// ==========================================================================

/**
 * KHÔNG CÓ "KHÁC".
 *
 * Am đi tìm năm mảng cụ thể, cộng thứ chủ nhà tự gọi ra ở mục Ngẫu hứng. Thứ
 * không thuộc mảng nào là thứ *lọt vào*, bị đánh dấu loại ngay ở bước phân
 * loại chứ không được bày ra thành một chuyên mục thứ sáu.
 */
const CHUYEN_MUC = [
  { ma: "", ten: "Tất cả" },
  { ma: "ai", ten: "AI" },
  { ma: "triet_hoc", ten: "Triết học" },
  { ma: "truyen", ten: "Truyện" },
  { ma: "music", ten: "Music" },
  { ma: "khoa_hoc", ten: "Khoa học" },
  { ma: "ngau_hung", ten: "Ngẫu hứng" },
];

// ==========================================================================
// HÀNG TRÊN — BỘ LỌC CHUNG
// ==========================================================================

const THOI_GIAN: LuaChon[] = [
  { ma: "duoi15", ten: "Dưới 15 phút" },
  { ma: "tren30", ten: "Trên 30 phút" },
  { ma: "tren45", ten: "Trên 45 phút" },
];

const CHAT_LUONG: NhomLoc = {
  khoa: "sap",
  ten: "Chất lượng",
  cac: [
    {
      ma: "diem_cao",
      ten: "Điểm cao trước",
      ghi: "Điểm do am quy đổi từ năm trụ tín hiệu, thang 0–10.",
    },
    {
      ma: "thich_cao",
      ten: "Tỷ lệ thích cao",
      ghi: "Lượt thích chia lượt xem, không phải số thích thô. Cần ít nhất 1.000 lượt xem.",
    },
    {
      ma: "binh_luan_cao",
      ten: "Tỷ lệ bình luận cao",
      ghi: "Nội dung khiến người ta muốn nói gì đó. Cần ít nhất 1.000 lượt xem.",
    },
  ],
};

const NGUON: NhomLoc = {
  khoa: "nguon",
  ten: "Nguồn",
  cac: [
    { ma: "youtube", ten: "YouTube" },
    { ma: "podcast", ten: "Podcast & SoundCloud" },
    { ma: "blog", ten: "Blog & Diễn đàn" },
  ],
};

const TIENG_VIET: NhomLoc = {
  khoa: "tv",
  ten: "Tiếng Việt",
  cac: [
    { ma: "goc", ten: "Giọng Việt gốc" },
    {
      ma: "thuyet_minh",
      ten: "Thuyết minh lại",
      ghi: "Nguồn tiếng Anh — am đã dịch và làm xong âm thanh tiếng Việt.",
    },
  ],
};

// ==========================================================================
// HÀNG DƯỚI — BỘ LỌC RIÊNG TỪNG CHUYÊN MỤC
// ==========================================================================

const DAI_BPM: LuaChon[] = [
  "140-145",
  "145-150",
  "150-155",
  "155-160",
  "160-165",
  "165-170",
  "170-175",
  "175-180",
].map((d) => ({ ma: d, ten: d.replace("-", "–") }));

const RIENG: Record<string, NhomLoc[]> = {
  ai: [
    {
      khoa: "ai_chu_de",
      ten: "Chủ đề con",
      cac: [
        { ma: "claude_news", ten: "Tin Claude" },
        { ma: "ai_news_general", ten: "Tin AI chung" },
        { ma: "ai_agent_enterprise", ten: "AI doanh nghiệp" },
        { ma: "coding_experience_howto", ten: "Kinh nghiệm viết code" },
        { ma: "claude_usage_guide", ten: "Hướng dẫn dùng Claude" },
      ],
    },
    {
      khoa: "ai_hang",
      ten: "Hạng nguồn",
      cac: [
        {
          ma: "official_vendor",
          ten: "Hãng chính thức",
          ghi: "Anthropic, OpenAI, Google tự công bố.",
        },
        { ma: "expert_individual", ten: "Chuyên gia cá nhân" },
        { ma: "community_forum", ten: "Diễn đàn cộng đồng" },
      ],
    },
  ],

  triet_hoc: [
    {
      khoa: "th_truong_phai",
      ten: "Trường phái",
      cac: [
        { ma: "stoic", ten: "Khắc kỷ" },
        { ma: "hien_sinh", ten: "Hiện sinh" },
        { ma: "tam_ly_hoc_hien_dai", ten: "Tâm lý học hiện đại" },
        { ma: "phat_giao_nguyen_thuy", ten: "Phật giáo Nguyên thuỷ" },
      ],
    },
    {
      khoa: "th_dang",
      ten: "Dạng trình bày",
      cac: [
        { ma: "giang_phap", ten: "Giảng pháp" },
        { ma: "ung_dung_thuc_hanh", ten: "Ứng dụng thực hành" },
        { ma: "phan_tich_hoc_thuat", ten: "Phân tích học thuật" },
      ],
    },
  ],

  truyen: [
    {
      khoa: "tr_the_loai",
      ten: "Thể loại",
      cac: [
        { ma: "kinh_di", ten: "Kinh dị" },
        { ma: "vien_tuong", ten: "Viễn tưởng" },
        { ma: "phieu_luu_mao_hiem", ten: "Phiêu lưu mạo hiểm" },
      ],
    },
    {
      khoa: "tr_xuat_xu",
      ten: "Xuất xứ",
      cac: [
        { ma: "viet_nam_sang_tac", ten: "VN sáng tác" },
        { ma: "dich_trung_quoc", ten: "Dịch Trung Quốc" },
        { ma: "dich_au_my", ten: "Dịch Âu Mỹ" },
        { ma: "khac", ten: "Khác" },
      ],
    },
    {
      khoa: "tr_do_cang",
      ten: "Độ căng",
      cac: [
        { ma: "nhe_nhang", ten: "Nhẹ nhàng" },
        { ma: "cang_thang", ten: "Căng thẳng" },
        { ma: "kinh_khung", ten: "Kinh khủng" },
      ],
    },
  ],

  music: [
    {
      khoa: "ms_the_loai",
      ten: "Thể loại nhạc",
      cac: [
        { ma: "workout_bpm", ten: "Tập thể thao (BPM)" },
        { ma: "dance", ten: "Dance" },
        { ma: "piano", ten: "Piano" },
        { ma: "guitar_rock", ten: "Guitar rock" },
        { ma: "nhac_vang", ten: "Nhạc vàng" },
      ],
    },
    {
      khoa: "ms_do_dai",
      ten: "Độ dài mix",
      cac: [
        { ma: ">20ph", ten: "Trên 20 phút" },
        { ma: ">40ph", ten: "Trên 40 phút" },
        { ma: ">1h", ten: "Trên 1 giờ" },
      ],
    },
  ],

  khoa_hoc: [
    {
      khoa: "kh_linh_vuc",
      ten: "Lĩnh vực",
      cac: [
        { ma: "y_hoc_suc_khoe", ten: "Y học & sức khoẻ" },
        { ma: "vat_ly_vu_tru", ten: "Vật lý & vũ trụ" },
        { ma: "sinh_hoc", ten: "Sinh học" },
        { ma: "vat_lieu_nang_luong", ten: "Vật liệu & năng lượng" },
        { ma: "ky_thuat", ten: "Kỹ thuật" },
      ],
    },
  ],
};

/** Tên gọi của ô lọc tác giả, khác nhau theo chuyên mục. */
const TEN_O_TAC_GIA: Record<string, string> = {
  triet_hoc: "Giảng sư",
  truyen: "Tác giả",
};

// ==========================================================================

const KIEU_NUT =
  "shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors";
const KIEU_BAT = "bg-cam-600 text-white dark:bg-cam-500 dark:text-neutral-950";
const KIEU_TAT =
  "bg-neutral-100 text-neutral-700 hover:bg-neutral-200 " +
  "dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700";

/**
 * Nút xổ ra danh sách.
 *
 * Danh sách được vẽ THẲNG VÀO `document.body` chứ không nằm trong nút. Lý do
 * bắt buộc: hàng lọc cuộn ngang bằng `overflow-x-auto`, mà theo chuẩn CSS khi
 * một trục không phải `visible` thì trục kia cũng bị ép thành `auto` — danh
 * sách đặt bên trong sẽ bị cắt cụt theo chiều dọc. Đã thử `overflow-y-visible`,
 * không cứu được.
 */
function NutXo({
  nhom,
  dangChon,
  doi,
}: {
  nhom: NhomLoc;
  dangChon: string | null;
  doi: (giaTri: string | null) => void;
}) {
  const [mo, datMo] = useState(false);
  const [oNut, datONut] = useState<DOMRect | null>(null);
  const nutRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!mo) return;
    const dong = () => datMo(false);
    // `true` để bắt cả cuộn bên trong hàng lọc, không chỉ cuộn cả trang —
    // danh sách neo theo toạ độ màn hình nên trang trượt là nó lạc chỗ.
    window.addEventListener("scroll", dong, true);
    window.addEventListener("resize", dong);
    return () => {
      window.removeEventListener("scroll", dong, true);
      window.removeEventListener("resize", dong);
    };
  }, [mo]);

  const daChon = nhom.cac.find((c) => c.ma === dangChon);

  return (
    <>
      <button
        ref={nutRef}
        type="button"
        onClick={() => {
          setTimeout(() => datONut(nutRef.current?.getBoundingClientRect() ?? null));
          datMo((cu) => !cu);
        }}
        className={`${KIEU_NUT} ${daChon ? KIEU_BAT : KIEU_TAT}`}
      >
        {daChon ? daChon.ten : nhom.ten} <span aria-hidden>▾</span>
      </button>

      {mo && oNut
        ? createPortal(
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => datMo(false)}
                aria-hidden
              />
              <div
                className="fixed z-50 max-h-[60vh] min-w-56 max-w-[calc(100vw-1.5rem)] overflow-y-auto rounded-xl border border-neutral-300 bg-background p-1.5 shadow-2xl dark:border-neutral-700"
                style={{
                  top: oNut.bottom + 6,
                  left: Math.max(
                    12,
                    Math.min(oNut.left, window.innerWidth - 236),
                  ),
                }}
              >
                {daChon ? (
                  <button
                    type="button"
                    onClick={() => {
                      doi(null);
                      datMo(false);
                    }}
                    className="mb-1 w-full rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold text-cam-600 hover:bg-neutral-100 dark:text-cam-300 dark:hover:bg-neutral-800"
                  >
                    Bỏ chọn
                  </button>
                ) : null}
                {nhom.cac.map((c) => {
                  const bat = c.ma === dangChon;
                  return (
                    <button
                      key={c.ma}
                      type="button"
                      onClick={() => {
                        doi(bat ? null : c.ma);
                        datMo(false);
                      }}
                      className={`w-full rounded-lg px-2.5 py-2 text-left text-xs hover:bg-neutral-100 dark:hover:bg-neutral-800 ${
                        bat
                          ? "font-bold text-cam-600 dark:text-cam-300"
                          : "text-neutral-700 dark:text-neutral-200"
                      }`}
                    >
                      {c.ten}
                      {c.ghi ? (
                        <span className="mt-0.5 block text-[10.5px] font-normal leading-snug text-neutral-500 dark:text-neutral-400">
                          {c.ghi}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </>,
            document.body,
          )
        : null}
    </>
  );
}

/**
 * Nút bật/tắt một giá trị.
 *
 * PHẢI nằm ngoài `ChipLoc`. Định nghĩa nó bên trong thì mỗi lần vẽ lại sinh ra
 * một hàm mới, React coi đó là một loại component khác và tháo cả cây con ra
 * dựng lại — mất trạng thái, nháy hình. ESLint bắt đúng chỗ này
 * (`react-hooks/static-components`).
 */
function NutDon({
  nhan,
  bat,
  bam,
}: {
  nhan: string;
  bat: boolean;
  bam: () => void;
}) {
  return (
    <button
      type="button"
      onClick={bam}
      className={`${KIEU_NUT} ${bat ? KIEU_BAT : KIEU_TAT}`}
    >
      {nhan}
    </button>
  );
}

function Vach() {
  return (
    <span
      aria-hidden
      className="h-5 w-px shrink-0 bg-neutral-200 dark:bg-neutral-700"
    />
  );
}

function NhanHang({ chu }: { chu: string }) {
  return (
    <span className="shrink-0 whitespace-nowrap border-r border-neutral-200 pr-2.5 text-[10px] font-bold uppercase tracking-wider text-cam-600 dark:border-neutral-700 dark:text-cam-300">
      {chu}
    </span>
  );
}

export function ChipLoc({
  demTheoNhom,
  cacTacGia,
  cacTuKhoaNgauHung,
  laChu,
  nganSachNgay,
}: {
  demTheoNhom: Record<string, number>;
  /** Giảng sư hoặc nhà văn của chuyên mục đang mở; rỗng ở các mục khác */
  cacTacGia: { id: string; ten: string; soBai: number; choDuyet: boolean }[];
  /** Mọi chủ đề Ngẫu hứng đang có — chỉ dùng khi đang mở đúng mục này */
  cacTuKhoaNgauHung: TuKhoaGon[];
  laChu: boolean;
  nganSachNgay: number;
}) {
  const duongDan = usePathname();
  const thamSo = useSearchParams();
  const dieuHuong = useRouter();
  const [dangChuyen, batDauChuyen] = useTransition();

  const nhomHienTai = thamSo.get("nhom") ?? "";

  function doiThamSo(khoa: string, giaTri: string | null) {
    const moi = new URLSearchParams(thamSo.toString());
    if (giaTri === null || giaTri === "") moi.delete(khoa);
    else moi.set(khoa, giaTri);
    // Đổi bộ lọc thì về trang đầu, chứ không giữ nguyên trang 5 của kết quả cũ
    moi.delete("trang");
    batDauChuyen(() => dieuHuong.push(`${duongDan}?${moi.toString()}`));
  }

  /**
   * Đổi chuyên mục thì XOÁ HẾT BỘ LỌC RIÊNG của mục cũ.
   *
   * Không xoá thì đang ở Truyện lọc "kinh dị" rồi bấm sang Music sẽ ra 0 kết
   * quả — vì `tr_the_loai=kinh_di` vẫn nằm trên địa chỉ trang, mà không còn nút
   * nào hiện ra để thấy mà tắt đi.
   */
  function doiChuyenMuc(ma: string) {
    const moi = new URLSearchParams(thamSo.toString());
    for (const nhomCu of Object.values(RIENG)) {
      for (const g of nhomCu) moi.delete(g.khoa);
    }
    moi.delete("bpm");
    moi.delete("tac_gia");
    moi.delete("nq");
    moi.delete("trang");
    if (ma) moi.set("nhom", ma);
    else moi.delete("nhom");
    batDauChuyen(() => dieuHuong.push(`${duongDan}?${moi.toString()}`));
  }

  /**
   * Dựng một nút bật/tắt.
   *
   * Là hàm thường trả về JSX, không phải component — nên gọi thẳng
   * `{nutDon(...)}` chứ đừng viết `<NutDon .../>` ở đây.
   */
  function nutDon(khoa: string, giaTri: string, nhan: string) {
    const bat = thamSo.get(khoa) === giaTri;
    return (
      <NutDon
        key={khoa + giaTri}
        nhan={nhan}
        bat={bat}
        bam={() => doiThamSo(khoa, bat ? null : giaTri)}
      />
    );
  }

  const cacRieng = RIENG[nhomHienTai] ?? [];
  const tenOTacGia = TEN_O_TAC_GIA[nhomHienTai];
  /**
   * Ô lọc tác giả dựng từ dữ liệu thật, không phải danh sách viết cứng.
   *
   * Kèm số bài sau tên vì nó nói ngay thứ người dùng cần biết: chọn vị này thì
   * còn lại bao nhiêu. Không có số thì phải bấm vào mới biết, mà phần lớn tác
   * giả chỉ có một hai bài.
   */
  const nhomTacGia: NhomLoc | null =
    tenOTacGia && cacTacGia.length > 0
      ? {
          khoa: "tac_gia",
          ten: tenOTacGia,
          cac: cacTacGia.map((t) => ({
            ma: t.id,
            ten: `${t.ten} · ${t.soBai}`,
          })),
        }
      : null;
  const hienBpm = nhomHienTai === "music" && thamSo.get("ms_the_loai") === "workout_bpm";
  const laNgauHung = nhomHienTai === "ngau_hung";
  const cacChuDeDangQuet = cacTuKhoaNgauHung.filter((t) => t.autoScan);

  return (
    <div className={dangChuyen ? "opacity-60 transition-opacity" : undefined}>
      {/* --- Hàng chuyên mục --- */}
      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {CHUYEN_MUC.map((m) => {
          const so = m.ma ? demTheoNhom[m.ma] : undefined;
          const dangO = nhomHienTai === m.ma;
          return (
            <button
              key={m.ma || "tat-ca"}
              type="button"
              onClick={() => doiChuyenMuc(m.ma)}
              className={`min-w-0 shrink-0 flex-1 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 ${
                dangO
                  ? "bg-cam-600 text-white shadow-lg shadow-cam-600/40 dark:bg-cam-500 dark:text-neutral-950 dark:shadow-cam-500/30"
                  : KIEU_TAT
              }`}
            >
              {m.ten}
              {so !== undefined ? (
                <span
                  className={`ml-1.5 tabular-nums ${dangO ? "opacity-80" : "opacity-55"}`}
                >
                  {so}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* --- Khối hai hàng lọc --- */}
      <div className="mt-3 rounded-xl border border-neutral-200 p-2.5 dark:border-neutral-800">
        {/* Hàng trên: chung */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
          <NhanHang chu="Chung" />
          {THOI_GIAN.map((t) => nutDon("tg", t.ma, t.ten))}
          <Vach />
          {nutDon("kenh", "theo_doi", "Kênh theo dõi")}
          {nutDon("kenh", "moi", "Kênh mới")}
          <Vach />
          {nutDon("sap", "moi_nhat", "Mới nhất trước")}
          <NutXo
            nhom={CHAT_LUONG}
            dangChon={
              thamSo.get("sap") === "moi_nhat" ? null : thamSo.get("sap")
            }
            doi={(v) => doiThamSo("sap", v)}
          />
          <Vach />
          <NutXo
            nhom={NGUON}
            dangChon={thamSo.get("nguon")}
            doi={(v) => doiThamSo("nguon", v)}
          />
          <NutXo
            nhom={TIENG_VIET}
            dangChon={thamSo.get("tv")}
            doi={(v) => doiThamSo("tv", v)}
          />
        </div>

        {/* Hàng dưới: riêng */}
        <div className="mt-2 flex items-center gap-1.5 overflow-x-auto border-t border-neutral-200 pt-2 dark:border-neutral-800">
          <NhanHang
            chu={
              nhomHienTai
                ? `Riêng ${CHUYEN_MUC.find((m) => m.ma === nhomHienTai)?.ten}`
                : "Riêng"
            }
          />
          {laNgauHung && cacChuDeDangQuet.length === 0 ? (
            <span className="shrink-0 text-xs italic text-neutral-400 dark:text-neutral-500">
              Chưa có chủ đề nào đang tự quét — mở Cấu hình bên dưới để thêm
            </span>
          ) : null}
          {laNgauHung
            ? cacChuDeDangQuet.map((t) => {
                const bat = thamSo.get("nq") === t.id;
                return (
                  <NutDon
                    key={t.id}
                    nhan={t.keyword}
                    bat={bat}
                    bam={() => doiThamSo("nq", bat ? null : t.id)}
                  />
                );
              })
            : null}
          {!laNgauHung && cacRieng.length === 0 && !tenOTacGia ? (
            <span className="shrink-0 text-xs italic text-neutral-400 dark:text-neutral-500">
              Chuyên mục này không có bộ lọc riêng
            </span>
          ) : null}
          {cacRieng.map((g) => (
            <NutXo
              key={g.khoa}
              nhom={g}
              dangChon={thamSo.get(g.khoa)}
              doi={(v) => doiThamSo(g.khoa, v)}
            />
          ))}
          {nhomHienTai === "truyen"
            ? nutDon("tr_that", "1", "Dựa trên chuyện có thật")
            : null}
          {nhomTacGia ? (
            <NutXo
              nhom={nhomTacGia}
              dangChon={thamSo.get("tac_gia")}
              doi={(v) => doiThamSo("tac_gia", v)}
            />
          ) : tenOTacGia ? (
            // Có ô nhưng chưa có ai để chọn — nói thẳng thay vì bày một ô rỗng
            <span className="shrink-0 text-xs italic text-neutral-400 dark:text-neutral-500">
              Chưa rút được tên {tenOTacGia.toLowerCase()} nào
            </span>
          ) : null}
        </div>

        {/* Cấu hình — chỉ hiện ở mục Ngẫu hứng, thu gọn mặc định */}
        {laNgauHung ? (
          <KhoiCauHinhNgauHung
            cacTuKhoa={cacTuKhoaNgauHung}
            laChu={laChu}
            nganSachNgay={nganSachNgay}
          />
        ) : null}

        {/* Dải BPM — chỉ bung ra khi đã chọn loại nhạc có nhịp */}
        {hienBpm ? (
          <div className="mt-2 flex items-center gap-1.5 overflow-x-auto border-t border-dashed border-neutral-300 pt-2 dark:border-neutral-700">
            <NhanHang chu="Dải BPM" />
            {DAI_BPM.map((d) => nutDon("bpm", d.ma, d.ten))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
