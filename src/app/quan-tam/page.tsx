import Link from "next/link";

import { auth } from "@/auth";
import { BangTuKhoa } from "@/components/BangTuKhoa";
import { KhungTrang } from "@/components/KhungTrang";
import { TheNoiDungCard } from "@/components/TheNoiDung";
import { prisma } from "@/lib/db/prisma";
import { chuaLuotQua } from "@/lib/lichSu/loc";
import { nganSachMoiNgay } from "@/lib/youtube/hanMuc";

export const dynamic = "force-dynamic";

export default async function TrangQuanTam() {
  const [phien, cacTuKhoa, ketQuaMoi] = await Promise.all([
    auth(),
    prisma.adHocInterest.findMany({
      orderBy: [{ autoScan: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        keyword: true,
        note: true,
        autoScan: true,
        resultCount: true,
        lastScannedAt: true,
      },
    }),
    prisma.contentItem.findMany({
      // Bám vào TỪ KHOÁ đã sinh ra nội dung này, không bám vào chuyên mục.
      //
      // Đã vấp thật: lúc mới quét về, nội dung được gán tạm `new_search`;
      // nhưng phân loại xong Claude ghi đè bằng chuyên mục thật ("ai",
      // "khoa_hoc"…). Lọc theo `contentGroup` thì trang này rỗng dần đúng
      // theo tốc độ phân loại — càng chạy càng mất bài.
      //
      // Quan hệ tới `AdHocInterest` mới là thứ bền: nó ghi "bài này có được
      // là nhờ chủ nhà gõ từ khoá kia". Một video AI tìm ra từ từ khoá
      // "AI agent" thì vừa nằm ở hàng AI, vừa nằm ở đây — đúng cả hai.
      where: chuaLuotQua({ adHocInterestId: { not: null } }),
      orderBy: [
        { score: { compositeScore: { sort: "desc", nulls: "last" } } },
        { publishedAt: "desc" },
      ],
      take: 12,
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
        narrationAsset: { select: { id: true } },
        classification: {
          select: {
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
    }),
  ]);

  return (
    <KhungTrang emailNguoiDung={phien?.user?.email}>
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        <h1 className="text-xl font-semibold tracking-tight">New</h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Bốn chuyên mục kia chỉ thấy được nội dung từ các kênh bạn đã theo dõi.
          Ở đây bạn gõ thẳng thứ đang tò mò, tối máy đi tìm ngoài vùng đó.
        </p>

        <div className="mt-6">
          <BangTuKhoa
            cacTuKhoa={cacTuKhoa}
            laChu={Boolean(phien?.user?.email)}
            nganSachNgay={nganSachMoiNgay()}
          />
        </div>

        {ketQuaMoi.length > 0 ? (
          <section className="mt-10">
            <h2 className="mb-3 text-base font-semibold">Tìm được gần đây</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {ketQuaMoi.map((muc) => (
                <TheNoiDungCard key={muc.id} muc={muc} />
              ))}
            </div>
          </section>
        ) : cacTuKhoa.length > 0 ? (
          <p className="mt-10 rounded-xl border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
            Chưa tìm được gì. Từ khoá được quét trong lần chạy đêm — hoặc chạy
            tay bằng <code>npx tsx scripts/quet-tu-khoa.ts</code>.
          </p>
        ) : null}

        <p className="mt-8 text-xs text-neutral-400 dark:text-neutral-500">
          Nội dung tìm được ở đây cũng vào{" "}
          <Link href="/kham-pha" className="underline">
            Khám phá
          </Link>{" "}
          và được chấm điểm như mọi thứ khác.
        </p>
      </div>
    </KhungTrang>
  );
}
