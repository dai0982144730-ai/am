/**
 * Tìm kiếm và lọc nội dung cho trang Khám phá.
 *
 * NGUYÊN TẮC: **không gọi Claude trên đường đi của người dùng**. Người ta bấm
 * một nút lọc là muốn thấy kết quả ngay, không phải chờ mô hình nghĩ. Mọi thứ ở
 * đây đều là truy vấn database thuần.
 *
 * ## Bộ lọc chia hai tầng
 *
 * **Tầng chung** áp cho mọi chuyên mục: thời gian, kênh theo dõi hay kênh mới,
 * cách sắp xếp, nguồn, và nghe được bằng tiếng Việt kiểu nào.
 *
 * **Tầng riêng** chỉ có nghĩa bên trong một chuyên mục — không thể hỏi trường
 * phái triết học của một bản nhạc, cũng không hỏi được số nhịp của bài blog.
 *
 * ## Mỗi nhóm chỉ chọn được MỘT giá trị
 *
 * Chủ dự án chốt 2026-08-16: "ấn một cái là lọc cái đó thôi". Quyết định này
 * cũng vá luôn một lỗi có thật trong bản trước — hai nút "Dưới 10 phút" và
 * "Trên 20 phút" bật/tắt độc lập nên bấm được cả hai, thành điều kiện
 * `thời lượng ≥ 20 phút VÀ ≤ 10 phút`, **luôn ra 0 kết quả mà không báo gì**.
 */

import type {
  AiSubtopic,
  MusicGenre,
  PhilosophyContentForm,
  PhilosophySchool,
  ScienceField,
  SourceReputationTier,
  StoryGenre,
  StoryIntensity,
  StoryOrigin,
} from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { chuaLuotQua } from "@/lib/lichSu/loc";

/** Chuyên mục hiện trên hàng chip. KHÔNG có "Khác" — xem ghi chú ở `demTheoNhom`. */
export type MaChuyenMuc =
  | "ai"
  | "triet_hoc"
  | "truyen"
  | "music"
  | "khoa_hoc"
  | "ngau_hung";

export type MaThoiGian = "duoi15" | "tren30" | "tren45";
export type MaKenh = "theo_doi" | "moi";
export type MaSapXep = "moi_nhat" | "diem_cao" | "thich_cao" | "binh_luan_cao";
export type MaNguon = "youtube" | "podcast" | "blog";
export type MaTiengViet = "goc" | "thuyet_minh";

export interface BoLoc {
  /** Từ khoá tìm trong tiêu đề, mô tả, chủ đề và nhận xét của Claude */
  tuKhoa?: string;
  nhom?: MaChuyenMuc;

  // --- Tầng chung ---
  thoiGian?: MaThoiGian;
  kenh?: MaKenh;
  sapXep?: MaSapXep;
  nguon?: MaNguon;
  tiengViet?: MaTiengViet;

  // --- Tầng riêng ---
  aiChuDe?: AiSubtopic;
  aiHang?: SourceReputationTier;
  thTruongPhai?: PhilosophySchool;
  thDang?: PhilosophyContentForm;
  trTheLoai?: StoryGenre;
  trXuatXu?: StoryOrigin;
  trDoCang?: StoryIntensity;
  trChuyenThat?: boolean;
  msTheLoai?: MusicGenre;
  msDoDai?: string;
  msDaiBpm?: string;
  khLinhVuc?: ScienceField;

  trang?: number;
}

export const SO_MOI_TRANG = 24;

/**
 * Clip ngắn hơn ngần này bị loại thẳng, không hiện ra.
 *
 * Chủ dự án chốt 2026-08-16. Hai ngoại lệ, cả hai đều **tự đúng** mà không cần
 * viết thêm điều kiện nào:
 *
 *   1. **Bài blog và bài diễn đàn** không có thời lượng, nên `durationSeconds`
 *      để trống và chúng lọt qua nhánh `null` bên dưới.
 *   2. **Bản thuyết minh từ clip gốc dài hơn 5 phút mà file mp3 rút xuống dưới
 *      5 phút do cô đặc nội dung.** Cột này giữ thời lượng của clip GỐC, còn độ
 *      dài file mp3 nằm ở `NarrationAsset` — nên bản rút gọn vẫn được giữ.
 *      Đúng ý: mp3 ngắn đi vì cô đặc là dấu hiệu chất lượng, không phải clip vụn.
 */
const TOI_THIEU_GIAY = 300;

/**
 * Sắp theo tỷ lệ thì phải có đủ lượt xem, nếu không con số vô nghĩa.
 *
 * ĐÃ ĐO (2026-08-16): không đặt ngưỡng thì đứng đầu bảng "tỷ lệ thích cao" là
 * một clip **3 thích trên 8 lượt xem** — 37,5%, cao nhất kho, và chẳng nói lên
 * điều gì. Ngưỡng 1.000 giữ lại 717 trong 952 mục có đủ số liệu (75%) và đưa
 * lên đầu những thứ đọc được: 814/3.959, 932/5.099.
 */
const TOI_THIEU_LUOT_XEM_CHO_TY_LE = 1_000;

/** Các trường cần cho một thẻ nội dung. */
const TRUONG_THE = {
  id: true,
  title: true,
  url: true,
  thumbnailUrl: true,
  publishedAt: true,
  durationSeconds: true,
  viewOrPlayCount: true,
  contentGroup: true,
  narrationType: true,
  score: { select: { compositeScore: true } },
  source: {
    select: {
      id: true,
      type: true,
      title: true,
      reputationTier: true,
      subscriptionStatus: true,
    },
  },
  originalLanguage: true,
  narrationAsset: { select: { id: true, ttsAudioUrl: true } },
  classification: {
    select: {
      titleVi: true,
      contentQualityNotes: true,
      extractedTopics: true,
      extractedAuthorNameRaw: true,
      aiSubtopic: true,
      scienceField: true,
      philosophySchool: true,
      philosophyContentForm: true,
      listenerLevel: true,
      misleadingContentFlag: true,
      storyGenre: true,
      storyIntensity: true,
      aiGeneratedSuspicionScore: true,
      musicGenre: true,
      bpm: true,
      bpmBucket: true,
    },
  },
} as const;

/** Mỗi nút "Nguồn" gom vài loại nguồn xử sự giống nhau. */
const LOAI_THEO_NGUON = {
  youtube: ["youtube_channel"],
  podcast: ["podcast_rss", "soundcloud_channel"],
  blog: ["blog_feed", "forum_community"],
} as const;

/** Khoảng thời lượng, tính bằng giây. */
const KHOANG_THOI_GIAN: Record<MaThoiGian, { tu?: number; den?: number }> = {
  duoi15: { den: 900 },
  tren30: { tu: 1_800 },
  tren45: { tu: 2_700 },
};

/** Dựng điều kiện lọc từ những gì người dùng chọn. */
function dungDieuKien(loc: BoLoc): Prisma.ContentItemWhereInput {
  const laNgauHung = loc.nhom === "ngau_hung";
  const dieuKien: Prisma.ContentItemWhereInput = laNgauHung
    ? // Ngẫu hứng lấy CẢ thứ đã bị loại — đó là điểm khác biệt của nó.
      { status: { in: ["classified", "rejected"] } }
    : { status: "classified" };
  const va: Prisma.ContentItemWhereInput[] = [];
  const phanLoai: Prisma.ContentClassificationWhereInput = {};

  // --- Chuyên mục ---
  //
  // "Ngẫu hứng" KHÔNG phải chuyên mục thứ sáu. Nó là **kho chứa của mọi thứ
  // nằm ngoài năm mảng** — chỗ để lúc rảnh muốn xem hài, thể thao, ẩm thực.
  //
  // Chỗ hay của cách làm này: kho chứa ấy **đã có sẵn, không phải quét thêm gì**.
  // Nó gồm đúng hai nguồn, cả hai đều đang nằm im trong database:
  //
  //   1. Nội dung từ **145 kênh đã xếp là ngoài năm mảng** (`xepKenh.ts`) —
  //      chúng bị lượt quét đêm bỏ qua, nhưng thứ quét được từ trước vẫn còn
  //   2. Nội dung **đã bị loại** ở bước phân loại — 275 bài tính tới 2026-08-16
  //
  // Nhờ vậy bấm vào Ngẫu hứng là có kết quả ngay, không tốn một đơn vị hạn mức
  // nào. Chỉ khi tìm không ra mới cần gọi YouTube, và lúc đó giao diện phải nói
  // thẳng cái giá 100 đơn vị ra.
  //
  // Nội dung từ từ khoá chủ nhà tự gõ cũng gom vào đây: nó cũng là thứ "tự dưng
  // muốn xem" chứ không thuộc năm mảng cố định.
  if (laNgauHung) {
    va.push({
      OR: [
        { adHocInterestId: { not: null } },
        { source: { contentGroupHint: "other" } },
        { status: "rejected" },
      ],
    });
  } else if (loc.nhom && loc.nhom !== "ngau_hung") {
    // Nhánh này chỉ còn năm mảng cố định, và chúng trùng tên với `ContentGroup`
    // trong database. Phải so sánh lại tường minh vì `laNgauHung` là một biến
    // riêng nên TypeScript không tự thu hẹp kiểu giúp.
    dieuKien.contentGroup = loc.nhom;
  }

  // --- Luật 5 phút, luôn bật ---
  //
  // Đặt trước bộ lọc thời gian để nút "Dưới 15 phút" thật ra là "5–15 phút".
  const khoang = loc.thoiGian ? KHOANG_THOI_GIAN[loc.thoiGian] : null;
  if (khoang) {
    // Chọn lọc theo độ dài thì bài viết không có độ dài sẽ không khớp — đúng ý
    // "cho tôi xem thứ dài chừng này", chứ không phải "kèm luôn thứ không đo được".
    dieuKien.durationSeconds = {
      gte: Math.max(TOI_THIEU_GIAY, khoang.tu ?? 0),
      ...(khoang.den ? { lte: khoang.den } : {}),
    };
  } else {
    va.push({
      OR: [
        { durationSeconds: null },
        { durationSeconds: { gte: TOI_THIEU_GIAY } },
      ],
    });
  }

  // --- Kênh theo dõi / kênh mới ---
  if (loc.kenh === "theo_doi") {
    dieuKien.source = { subscriptionStatus: "subscribed" };
  } else if (loc.kenh === "moi") {
    dieuKien.source = { subscriptionStatus: { not: "subscribed" } };
  }

  // --- Nguồn ---
  if (loc.nguon) {
    dieuKien.source = {
      ...(dieuKien.source as Prisma.SourceWhereInput | undefined),
      type: { in: [...LOAI_THEO_NGUON[loc.nguon]] },
    };
  }

  // --- Nghe được bằng tiếng Việt kiểu nào ---
  if (loc.tiengViet === "goc") {
    dieuKien.originalLanguage = "vi";
  } else if (loc.tiengViet === "thuyet_minh") {
    // Gốc tiếng nước ngoài VÀ am đã làm xong bản tiếng Việt có tiếng.
    // Phải hỏi `ttsAudioUrl`, không phải chỉ hỏi có bản thuật lại hay chưa:
    // bản mới dịch xong phần chữ mà chưa đọc thành tiếng thì vẫn chưa nghe được.
    dieuKien.originalLanguage = { not: "vi" };
    dieuKien.narrationAsset = { ttsAudioUrl: { not: null } };
  }

  // --- Tầng riêng: AI ---
  if (loc.aiChuDe) phanLoai.aiSubtopic = loc.aiChuDe;
  if (loc.aiHang) dieuKien.source = {
    ...(dieuKien.source as Prisma.SourceWhereInput | undefined),
    reputationTier: loc.aiHang,
  };

  // --- Tầng riêng: Triết học ---
  if (loc.thTruongPhai) phanLoai.philosophySchool = loc.thTruongPhai;
  if (loc.thDang) phanLoai.philosophyContentForm = loc.thDang;

  // --- Tầng riêng: Truyện ---
  if (loc.trTheLoai) phanLoai.storyGenre = loc.trTheLoai;
  if (loc.trXuatXu) phanLoai.storyOrigin = loc.trXuatXu;
  if (loc.trDoCang) phanLoai.storyIntensity = loc.trDoCang;
  if (loc.trChuyenThat) phanLoai.basedOnTrueStory = true;

  // --- Tầng riêng: Music ---
  if (loc.msTheLoai) phanLoai.musicGenre = loc.msTheLoai;
  if (loc.msDoDai) phanLoai.mixLengthBucket = loc.msDoDai;
  if (loc.msDaiBpm) phanLoai.bpmBucket = loc.msDaiBpm;

  // --- Tầng riêng: Khoa học ---
  if (loc.khLinhVuc) phanLoai.scienceField = loc.khLinhVuc;

  // --- Hai bộ lọc chạy ngầm, không có nút, không tắt được ---
  //
  // Truyện nghi do AI sản xuất hàng loạt bị loại hẳn chứ không chỉ xếp cuối;
  // nội dung mê tín bị đẩy khỏi mục triết học. Cả hai đều theo bản thiết kế.
  if (loc.nhom === "truyen") {
    va.push({
      classification: {
        OR: [
          { aiGeneratedSuspicionScore: null },
          { aiGeneratedSuspicionScore: { lt: 0.6 } },
        ],
      },
    });
  }
  if (loc.nhom === "triet_hoc") phanLoai.misleadingContentFlag = false;

  // --- Sắp theo tỷ lệ thì bắt buộc đủ lượt xem ---
  if (loc.sapXep === "thich_cao" || loc.sapXep === "binh_luan_cao") {
    dieuKien.viewOrPlayCount = { gte: TOI_THIEU_LUOT_XEM_CHO_TY_LE };
  }

  if (Object.keys(phanLoai).length > 0) va.push({ classification: phanLoai });

  const tuKhoa = loc.tuKhoa?.trim();
  if (tuKhoa) {
    // Tìm trong nhiều chỗ, kể cả nhận xét và chủ đề Claude rút ra — nhờ vậy gõ
    // "khắc kỷ" vẫn tìm được video mà tiêu đề không hề có chữ đó
    va.push({
      OR: [
        { title: { contains: tuKhoa, mode: "insensitive" } },
        { description: { contains: tuKhoa, mode: "insensitive" } },
        { source: { title: { contains: tuKhoa, mode: "insensitive" } } },
        {
          classification: {
            contentQualityNotes: { contains: tuKhoa, mode: "insensitive" },
          },
        },
        { classification: { extractedTopics: { has: tuKhoa } } },
        {
          classification: {
            extractedAuthorNameRaw: { contains: tuKhoa, mode: "insensitive" },
          },
        },
      ],
    });
  }

  if (va.length > 0) dieuKien.AND = va;
  return dieuKien;
}

/** Dựng thứ tự sắp xếp. */
function dungThuTu(
  kieu: MaSapXep | undefined,
): Prisma.ContentItemOrderByWithRelationInput[] {
  const moiNhat = { publishedAt: { sort: "desc", nulls: "last" } } as const;

  switch (kieu) {
    case "moi_nhat":
      return [moiNhat];
    case "thich_cao":
      return [{ likeRatio: { sort: "desc", nulls: "last" } }, moiNhat];
    case "binh_luan_cao":
      return [{ commentRatio: { sort: "desc", nulls: "last" } }, moiNhat];
    case "diem_cao":
    default:
      // Mặc định cũng là điểm cao trước — thứ tự hợp lý nhất khi chưa chọn gì.
      return [
        { score: { compositeScore: { sort: "desc", nulls: "last" } } },
        moiNhat,
      ];
  }
}

export interface KetQuaTim {
  cacThe: Awaited<
    ReturnType<
      typeof prisma.contentItem.findMany<{ select: typeof TRUONG_THE }>
    >
  >;
  tongSo: number;
  trang: number;
  soTrang: number;
}

/** Tìm và lọc nội dung. */
export async function timNoiDung(loc: BoLoc): Promise<KetQuaTim> {
  const trang = Math.max(1, loc.trang ?? 1);
  // Đang tìm một thứ cụ thể thì KHÔNG giấu nội dung đã xem — người ta gõ vào ô
  // tìm kiếm thường là để lần lại đúng cái vừa xem hôm qua. Chỉ lúc lướt không
  // mục đích mới cần giấu.
  const dangTimCuThe = Boolean(loc.tuKhoa?.trim());
  const dieuKien = dangTimCuThe
    ? dungDieuKien(loc)
    : chuaLuotQua(dungDieuKien(loc));

  const [cacThe, tongSo] = await Promise.all([
    prisma.contentItem.findMany({
      where: dieuKien,
      select: TRUONG_THE,
      orderBy: dungThuTu(loc.sapXep),
      skip: (trang - 1) * SO_MOI_TRANG,
      take: SO_MOI_TRANG,
    }),
    prisma.contentItem.count({ where: dieuKien }),
  ]);

  return {
    cacThe,
    tongSo,
    trang,
    soTrang: Math.max(1, Math.ceil(tongSo / SO_MOI_TRANG)),
  };
}

/**
 * Đếm số nội dung mỗi chuyên mục, để hiện cạnh chip lọc.
 *
 * PHẢI ĐẾM Y HỆT DANH SÁCH BÊN DƯỚI, kể cả luật 5 phút. Bản đầu chỉ đếm
 * `status: "classified"` nên chip ghi **AI 28** mà bấm vào chỉ ra **5 nội
 * dung**. Chủ dự án phát hiện đúng chỗ này và hỏi thẳng "28 mà hiện lên chỉ có
 * 05 là sao?".
 *
 * Con số trên chip là một lời hứa: bấm vào sẽ thấy chừng đó. Đếm theo một công
 * thức rồi hiển thị theo công thức khác thì con số ấy thành nói dối, mà lại là
 * kiểu nói dối không ai báo lỗi.
 *
 * KHÔNG ĐẾM NHÓM "other". Nội dung không thuộc chuyên mục nào đã bị đánh dấu
 * `rejected` ở bước phân loại, nên nó không lọt vào đây; và cũng không có chip
 * nào để bấm vào.
 */
export async function demTheoNhom(): Promise<Record<string, number>> {
  // Đếm bằng CHÍNH `dungDieuKien` mà danh sách dùng, mỗi chuyên mục một lượt.
  //
  // Tốn sáu truy vấn thay vì một `groupBy`, nhưng đổi lại con số trên chip
  // BẰNG NHAU VỚI DANH SÁCH theo cấu tạo, không phải nhờ nhớ đồng bộ.
  //
  // Bản `groupBy` trước đó đã sai đúng kiểu này: nó bỏ qua hai bộ lọc chạy
  // ngầm, nên chip Truyện ghi **16** mà bấm vào chỉ ra **15** — một truyện nghi
  // AI viết bị loại khỏi danh sách nhưng vẫn được đếm.
  const cac = [
    "ai",
    "triet_hoc",
    "truyen",
    "music",
    "khoa_hoc",
    "ngau_hung",
  ] as const;

  const so = await Promise.all(
    cac.map((nhom) =>
      prisma.contentItem.count({ where: chuaLuotQua(dungDieuKien({ nhom })) }),
    ),
  );

  return Object.fromEntries(cac.map((nhom, i) => [nhom, so[i]]));
}
