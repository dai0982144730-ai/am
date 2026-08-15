import Link from "next/link";
import { notFound } from "next/navigation";

import { auth } from "@/auth";
import { DanhGiaCamXuc } from "@/components/DanhGiaCamXuc";
import { DanhSachGhiChu } from "@/components/DanhSachGhiChu";
import { GhiNhoDaMo } from "@/components/GhiNhoDaMo";
import { KhungTrang } from "@/components/KhungTrang";
import { NutLuuThuVien } from "@/components/NutLuuThuVien";
import { ONhapGhiChu } from "@/components/ONhapGhiChu";
import { TheNoiDungCard } from "@/components/TheNoiDung";
import { TrinhPhatAmThanh } from "@/components/TrinhPhatAmThanh";
import { TrinhPhatPodcast } from "@/components/TrinhPhatPodcast";
import { TrinhPhatYouTube } from "@/components/TrinhPhatYouTube";
import { prisma } from "@/lib/db/prisma";
import { docTinhTrangXem } from "@/lib/tieuThu/docTienDo";

export const dynamic = "force-dynamic";

/** Lấy mã video YouTube từ đường dẫn. */
function maVideoYouTube(url: string | null): string | null {
  if (!url) return null;
  const khop = /(?:v=|youtu\.be\/|embed\/)([\w-]{11})/.exec(url);
  return khop?.[1] ?? null;
}

function docThoiLuong(giay: number | null): string | null {
  if (!giay) return null;
  const gio = Math.floor(giay / 3600);
  const phut = Math.floor((giay % 3600) / 60);
  const haiSo = (n: number) => String(n).padStart(2, "0");
  return gio > 0 ? `${gio} giờ ${haiSo(phut)} phút` : `${phut} phút`;
}

/**
 * Đọc mảng nhãn ra khỏi cột JSON.
 *
 * Cột `autoTags` khai kiểu `Json` nên Prisma trả về `unknown` — có thể là mảng
 * chuỗi, có thể là bất cứ thứ gì nếu ai đó từng ghi nhầm vào. Kiểm tra thật
 * thay vì ép kiểu, vì một bản ghi hỏng không được làm chết cả trang xem.
 */
function docNhan(tho: unknown): string[] | null {
  if (!Array.isArray(tho)) return null;
  const nhan = tho.filter((n): n is string => typeof n === "string");
  return nhan.length > 0 ? nhan : null;
}

const TEN_NHOM: Record<string, string> = {
  ai: "AI",
  triet_hoc: "Triết học",
  truyen: "Truyện",
  music: "Music",
  khoa_hoc: "Khoa học",
  new_search: "New",
  other: "Khác",
};

export default async function TrangXem({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [phien, muc, caiDatTts] = await Promise.all([
    auth(),
    prisma.contentItem.findUnique({
      where: { id },
      include: {
        source: { select: { title: true, url: true, reputationTier: true } },
        classification: true,
        narrationAsset: true,
        transcript: { select: { rawText: true, fetchStatus: true } },
        externalDiscussions: true,
        libraryItem: { select: { id: true } },
        notes: {
          orderBy: [{ timestampSeconds: "asc" }, { createdAt: "asc" }],
          select: {
            id: true,
            rawText: true,
            timestampSeconds: true,
            autoTags: true,
            userCorrectedTags: true,
            noteType: true,
            inputType: true,
            createdAt: true,
          },
        },
      },
    }),
    prisma.userAssistantSettings.findUnique({
      where: { id: "singleton" },
      select: { ttsSpeed: true },
    }),
  ]);

  if (!muc) notFound();

  const maYouTube = maVideoYouTube(muc.url);
  const laChu = Boolean(phien?.user?.email);
  const tinhTrang = await docTinhTrangXem(muc.id);

  // Nội dung cùng chuyên mục để xem tiếp — đúng kiểu cột phải của YouTube
  const lienQuan = await prisma.contentItem.findMany({
    where: {
      contentGroup: muc.contentGroup,
      status: "classified",
      id: { not: muc.id },
    },
    select: {
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
    },
    orderBy: [
      { score: { compositeScore: { sort: "desc", nulls: "last" } } },
      { viewOrPlayCount: "desc" },
    ],
    take: 6,
  });

  const pl = muc.classification;

  return (
    <KhungTrang emailNguoiDung={phien?.user?.email}>
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        {/* Mở trang này ra là nội dung chuyển sang Lịch sử và rời luồng chính */}
        <GhiNhoDaMo idNoiDung={muc.id} laChu={laChu} />

        <Link
          href="/"
          className="mb-4 inline-block text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200"
        >
          ← Về trang chủ
        </Link>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0">
            {maYouTube ? (
              <TrinhPhatYouTube
                maVideo={maYouTube}
                idNoiDung={muc.id}
                tieuDe={muc.title}
                laChu={laChu}
                viTriDangDo={tinhTrang.viTriDangDo}
                soLanDaXem={tinhTrang.soLanDaXem}
              />
            ) : muc.audioUrl ? (
              // Tập podcast: phát thẳng file tiếng của tác giả. Đây là loại nội
              // dung rẻ nhất và hợp nhất với cách dùng của chủ nhà — đã sẵn là
              // giọng người thật nói tiếng Việt, không phải dịch, không phải
              // đọc lại, không tốn ký tự TTS nào.
              <TrinhPhatPodcast
                duongDanAmThanh={muc.audioUrl}
                idNoiDung={muc.id}
                tieuDe={muc.title}
                anhBia={muc.thumbnailUrl}
                tenKenh={muc.source.title}
                laChu={laChu}
                viTriDangDo={tinhTrang.viTriDangDo}
                soLanDaXem={tinhTrang.soLanDaXem}
                tocDoMacDinh={caiDatTts?.ttsSpeed ?? 1}
              />
            ) : (
              // KHÔNG có nút "mở bài gốc" ở đây, và đừng thêm lại.
              //
              // Chủ dự án nói thẳng: *"link tới một trang toàn tiếng Anh cũng
              // vô giá trị vì tôi không có nhu cầu mở trang khác. Nhu cầu kiểu
              // đó tôi dùng Google."* Đẩy người dùng ra ngoài app để tiêu thụ
              // nội dung là đi ngược mục đích của cả cái web này.
              //
              // Đường duy nhất để bài viết dùng được: Am đọc, dịch, kể lại
              // bằng tiếng Việt — phần "Bản thuật lại" ngay bên dưới.
              <div className="rounded-xl border border-dashed border-neutral-300 p-8 text-center dark:border-neutral-700">
                {muc.narrationAsset ? (
                  <p className="text-sm text-neutral-600 dark:text-neutral-300">
                    Đây là bài viết. Bản kể lại bằng tiếng Việt nằm ngay bên
                    dưới.
                  </p>
                ) : (
                  <>
                    <p className="text-sm text-neutral-600 dark:text-neutral-300">
                      Đây là bài viết, chưa có bản tiếng Việt.
                    </p>
                    <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
                      Am sẽ đọc và kể lại bằng tiếng Việt trong lượt chạy đêm.
                      Chạy ngay bằng{" "}
                      <code>npx tsx scripts/thuat-lai.ts</code>
                    </p>
                  </>
                )}
              </div>
            )}

            {/* Tiêu đề tiếng Việt lên trước, tiêu đề gốc để nhỏ bên dưới.
                Chủ dự án nói thẳng: "tiêu đề để nguyên tiếng Anh thì bố ai mà
                đọc được". Thẻ ngoài trang chủ đã ưu tiên bản tiếng Việt rồi mà
                trang này thì chưa — bấm vào là đập ngay vào mắt tiếng Anh. */}
            <h1 className="mt-4 text-xl font-semibold leading-snug">
              {pl?.titleVi || muc.title}
            </h1>
            {pl?.titleVi ? (
              <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                {muc.title}
              </p>
            ) : null}

            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-neutral-500 dark:text-neutral-400">
              <span className="font-medium text-neutral-700 dark:text-neutral-300">
                {muc.source.title}
              </span>
              {muc.viewOrPlayCount !== null ? (
                <span>
                  · {muc.viewOrPlayCount.toLocaleString("vi-VN")} lượt xem
                </span>
              ) : null}
              {docThoiLuong(muc.durationSeconds) ? (
                <span>· {docThoiLuong(muc.durationSeconds)}</span>
              ) : null}
              {muc.publishedAt ? (
                <span>· {muc.publishedAt.toLocaleDateString("vi-VN")}</span>
              ) : null}
              <span className="ml-auto rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                {TEN_NHOM[muc.contentGroup] ?? muc.contentGroup}
              </span>
            </div>

            <NutLuuThuVien
              idNoiDung={muc.id}
              dangLuuBanDau={Boolean(muc.libraryItem)}
              laChu={laChu}
            />

            {/* Nhận xét của Claude — thứ phân biệt web này với YouTube */}
            {pl?.contentQualityNotes ? (
              <div className="mt-5 rounded-xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                  Claude nhận xét
                </p>
                <p className="mt-2 text-sm leading-relaxed text-neutral-800 dark:text-neutral-200">
                  {pl.contentQualityNotes}
                </p>
                {pl.extractedTopics.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {pl.extractedTopics.map((chuDe) => (
                      <span
                        key={chuDe}
                        className="rounded-full bg-white px-2.5 py-0.5 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
                      >
                        {chuDe}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* Điểm trên diễn đàn — thước đo thay thế cho bài viết */}
            {muc.externalDiscussions.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-3">
                {muc.externalDiscussions.map((tl) => (
                  <span
                    key={tl.id}
                    className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs text-neutral-600 dark:border-neutral-800 dark:text-neutral-300"
                  >
                    {tl.platform === "hackernews" ? "Hacker News" : "Reddit"}:{" "}
                    <strong>{tl.score ?? "—"}</strong> điểm ·{" "}
                    {tl.commentCount ?? "—"} bình luận
                  </span>
                ))}
              </div>
            ) : null}

            {/* Bản thuật lại tiếng Việt — giá trị cốt lõi của Phase 2 */}
            {muc.narrationAsset ? (
              <section className="mt-6">
                <h2 className="mb-3 text-base font-semibold">
                  Bản thuật lại tiếng Việt
                </h2>
                {/* Giọng đọc lên TRƯỚC phần chữ, có chủ đích: chủ dự án nói
                    rõ nhu cầu là nghe và nhìn, không phải đọc. Chữ để đó cho
                    ai muốn liếc lại, nhưng thứ chính là nút phát. */}
                {muc.narrationAsset.ttsAudioUrl ? (
                  <TrinhPhatAmThanh
                    duongDan={muc.narrationAsset.ttsAudioUrl}
                    giong={muc.narrationAsset.ttsVoice}
                    tocDoMacDinh={caiDatTts?.ttsSpeed ?? 1}
                    ghiChu="Claude đọc nội dung gốc rồi kể lại bằng lời văn riêng, không dịch nguyên văn."
                  />
                ) : (
                  <p className="rounded-xl border border-dashed border-neutral-300 p-3 text-xs text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
                    Chưa có giọng đọc. Chạy{" "}
                    <code>npx tsx scripts/tao-am-thanh.ts</code> hoặc đợi lượt
                    quét đêm.
                  </p>
                )}

                <details className="mt-3 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
                  <summary className="cursor-pointer text-sm font-medium">
                    Đọc bằng chữ
                  </summary>
                  <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-neutral-800 dark:text-neutral-200">
                    {muc.narrationAsset.scriptText}
                  </div>
                </details>
              </section>
            ) : null}

            {laChu ? (
              <>
                <ONhapGhiChu idNoiDung={muc.id} laChu={laChu} />
                <DanhSachGhiChu
                  laChu={laChu}
                  cacGhiChu={muc.notes.map((g) => ({
                    id: g.id,
                    chu: g.rawText,
                    giay: g.timestampSeconds,
                    // Nhãn người dùng sửa tay được ưu tiên hơn nhãn máy đoán
                    nhan:
                      docNhan(g.userCorrectedTags) ?? docNhan(g.autoTags) ?? [],
                    loai: g.noteType,
                    bangGiongNoi: g.inputType === "voice",
                    luc: g.createdAt,
                  }))}
                />
              </>
            ) : null}

            <DanhGiaCamXuc
              idNoiDung={muc.id}
              chuyenMuc={muc.contentGroup}
              laChu={laChu}
              saoBanDau={tinhTrang.saoDaCham}
              tagBanDau={tinhTrang.tagCamXuc}
            />

            {muc.description ? (
              <details className="mt-6 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
                <summary className="cursor-pointer text-sm font-medium">
                  Mô tả gốc
                </summary>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
                  {muc.description}
                </p>
              </details>
            ) : null}
          </div>

          {/* Cột phải: nội dung liên quan, đúng kiểu YouTube */}
          <aside className="min-w-0">
            <h2 className="mb-3 text-sm font-semibold">
              Cùng chuyên mục {TEN_NHOM[muc.contentGroup] ?? ""}
            </h2>
            {lienQuan.length === 0 ? (
              <p className="text-sm text-neutral-400">
                Chưa có nội dung nào khác.
              </p>
            ) : (
              <div className="grid gap-4">
                {lienQuan.map((the) => (
                  <TheNoiDungCard key={the.id} muc={the} />
                ))}
              </div>
            )}
          </aside>
        </div>
      </div>
    </KhungTrang>
  );
}
