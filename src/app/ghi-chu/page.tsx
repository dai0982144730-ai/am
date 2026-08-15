import Link from "next/link";

import { auth } from "@/auth";
import { KhungTrang } from "@/components/KhungTrang";
import { OViecCanLam } from "@/components/OViecCanLam";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

function docNhan(tho: unknown): string[] {
  if (!Array.isArray(tho)) return [];
  return tho.filter((n): n is string => typeof n === "string");
}

function docPhutGiay(giay: number): string {
  const g = Math.floor(giay / 3600);
  const p = Math.floor((giay % 3600) / 60);
  const s = Math.floor(giay % 60);
  const haiSo = (n: number) => String(n).padStart(2, "0");
  return g > 0 ? `${g}:${haiSo(p)}:${haiSo(s)}` : `${p}:${haiSo(s)}`;
}

export default async function TrangGhiChu() {
  const phien = await auth();

  // Ghi chú là suy nghĩ riêng của chủ nhà, không phải nội dung chung
  if (!phien?.user?.email) {
    return (
      <KhungTrang emailNguoiDung={null}>
        <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
          <h1 className="text-xl font-semibold tracking-tight">Ghi chú</h1>
          <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
            Ghi chú là suy nghĩ riêng của chủ nhà. Cần đăng nhập mới mở được.
          </p>
          <Link
            href="/dang-nhap"
            className="mt-6 inline-block rounded-lg bg-cam-600 px-4 py-2 text-sm font-medium text-white dark:bg-cam-500 dark:text-white"
          >
            Đăng nhập
          </Link>
        </div>
      </KhungTrang>
    );
  }

  const [cacBoSuuTap, chuaGanNhan, cacViec, tongGhiChu] = await Promise.all([
    prisma.knowledgeCollection.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        notes: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            rawText: true,
            timestampSeconds: true,
            autoTags: true,
            userCorrectedTags: true,
            noteType: true,
            contentItem: { select: { id: true, title: true } },
          },
        },
      },
    }),
    prisma.note.findMany({
      where: { collectionId: null },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        rawText: true,
        timestampSeconds: true,
        contentItem: { select: { id: true, title: true } },
      },
    }),
    prisma.actionItem.findMany({
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      select: {
        id: true,
        description: true,
        status: true,
        contentItem: { select: { id: true, title: true } },
      },
    }),
    prisma.note.count(),
  ]);

  return (
    <KhungTrang emailNguoiDung={phien.user.email}>
      <div className="w-full px-4 py-6 sm:px-6 lg:px-8">
        <h1 className="text-xl font-semibold tracking-tight">Ghi chú</h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          {tongGhiChu} ghi chú, Claude tự xếp vào {cacBoSuuTap.length} ngăn chủ
          đề. Bấm vào mốc giờ là mở clip đúng chỗ đó.
        </p>

        {tongGhiChu === 0 ? (
          <div className="mt-10 rounded-xl border border-dashed border-neutral-300 p-10 text-center dark:border-neutral-700">
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Chưa có ghi chú nào.
            </p>
            <p className="mt-2 text-xs text-neutral-400 dark:text-neutral-500">
              Mở một video rồi ghi lại thứ bạn nghĩ — gõ hoặc nói đều được.
            </p>
          </div>
        ) : null}

        {/* Việc cần làm — để trên cùng vì đây là thứ cần hành động */}
        {cacViec.length > 0 ? (
          <section className="mt-8">
            <h2 className="mb-3 text-base font-semibold">
              Việc cần làm ({cacViec.filter((v) => v.status === "todo").length}{" "}
              chưa xong)
            </h2>
            <ul className="space-y-2">
              {cacViec.map((v) => (
                <OViecCanLam
                  key={v.id}
                  id={v.id}
                  moTa={v.description}
                  xong={v.status === "done"}
                  idNoiDung={v.contentItem.id}
                  tenNoiDung={v.contentItem.title}
                />
              ))}
            </ul>
          </section>
        ) : null}

        {/* Các ngăn chủ đề */}
        {cacBoSuuTap.map((bo) =>
          bo.notes.length === 0 ? null : (
            <section key={bo.id} className="mt-8">
              <h2 className="text-base font-semibold">{bo.title}</h2>
              <p className="mt-0.5 text-xs text-neutral-400 dark:text-neutral-500">
                {bo.notes.length} ghi chú
                {bo.autoCreated ? " · ngăn Claude tự lập" : ""}
              </p>

              {bo.synthesizedSummary ? (
                <div className="mt-3 rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm leading-relaxed dark:border-neutral-800 dark:bg-neutral-900">
                  {bo.synthesizedSummary}
                </div>
              ) : null}

              <ul className="mt-3 space-y-2">
                {bo.notes.map((g) => {
                  const nhan = [
                    ...new Set([
                      ...docNhan(g.userCorrectedTags),
                      ...docNhan(g.autoTags),
                    ]),
                  ];
                  return (
                    <li
                      key={g.id}
                      className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800"
                    >
                      <p className="text-sm leading-relaxed">{g.rawText}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <Link
                          href={
                            g.timestampSeconds
                              ? `/xem/${g.contentItem.id}?tu=${g.timestampSeconds}`
                              : `/xem/${g.contentItem.id}`
                          }
                          className="text-xs text-neutral-500 underline hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-200"
                        >
                          {g.contentItem.title.slice(0, 50)}
                          {g.contentItem.title.length > 50 ? "…" : ""}
                          {g.timestampSeconds
                            ? ` · ${docPhutGiay(g.timestampSeconds)}`
                            : ""}
                        </Link>
                        {nhan.map((n) => (
                          <span
                            key={n}
                            className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
                          >
                            {n}
                          </span>
                        ))}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ),
        )}

        {/* Chưa gắn nhãn */}
        {chuaGanNhan.length > 0 ? (
          <section className="mt-8">
            <h2 className="text-base font-semibold">Chưa xếp ngăn</h2>
            <p className="mt-0.5 text-xs text-neutral-400 dark:text-neutral-500">
              Chạy <code>npx tsx scripts/gan-nhan-ghi-chu.ts</code> để Claude đọc
              và xếp, hoặc đợi lần quét đêm.
            </p>
            <ul className="mt-3 space-y-2">
              {chuaGanNhan.map((g) => (
                <li
                  key={g.id}
                  className="rounded-lg border border-dashed border-neutral-300 p-3 dark:border-neutral-700"
                >
                  <p className="text-sm leading-relaxed">{g.rawText}</p>
                  <Link
                    href={`/xem/${g.contentItem.id}`}
                    className="mt-1 inline-block text-xs text-neutral-500 underline dark:text-neutral-400"
                  >
                    {g.contentItem.title.slice(0, 50)}
                    {g.contentItem.title.length > 50 ? "…" : ""}
                    {g.timestampSeconds
                      ? ` · ${docPhutGiay(g.timestampSeconds)}`
                      : ""}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </KhungTrang>
  );
}
