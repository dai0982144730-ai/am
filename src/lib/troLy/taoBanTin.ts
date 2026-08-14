/**
 * Tạo và lưu bản tin hằng sáng.
 *
 * Nối phần chọn nội dung với phần Claude viết, rồi lưu vào `DigestRun` +
 * `AssistantBriefing`.
 */

import { prisma } from "@/lib/db/prisma";

import { chonNoiDungChoBanTin } from "./chonNoiDung";
import { vietBanTin } from "./vietBanTin";

const HAN_GHI_MS = 60_000;
const HAN_CHO_MS = 30_000;

export interface KetQuaTaoBanTin {
  idBanTin: string;
  banTin: string;
  soNoiBat: number;
  soXemThem: number;
  tongMoi: number;
}

/**
 * Tạo bản tin mới.
 *
 * @param tuDong `true` khi chạy trong việc quét đêm, `false` khi người dùng tự
 *   bấm tạo. Ghi lại để biết bản tin nào do máy tự làm.
 */
export async function taoBanTin(
  tuDong = true,
  soGioGanDay = 36,
): Promise<KetQuaTaoBanTin> {
  const lanChay = await prisma.digestRun.create({
    data: { triggeredBy: tuDong ? "scheduled_daily" : "manual" },
  });

  try {
    const noiDung = await chonNoiDungChoBanTin(soGioGanDay);
    const { banTin } = await vietBanTin(noiDung);

    // Lưu gọn lại thứ cần cho giao diện — không nhét cả bản ghi vào JSON
    const gonLai = {
      topPicks: noiDung.noiBat.map((muc) => ({
        chuyenMuc: muc.ma,
        tenChuyenMuc: muc.ten,
        cacMuc: muc.cacMuc.map((m) => ({
          id: m.id,
          tieuDe: m.title,
          nguon: m.source.title,
          thoiLuongGiay: m.durationSeconds,
          diem: m.score?.compositeScore ?? null,
          daThuatLai: Boolean(m.narrationAsset),
          nhanXet: m.classification?.contentQualityNotes ?? null,
        })),
      })),
      moreIfInterested: noiDung.xemThemNeuRanh.map((m) => ({
        id: m.id,
        tieuDe: m.title,
        nguon: m.source.title,
        chuyenMuc: m.contentGroup,
        diem: m.score?.compositeScore ?? null,
      })),
    };

    const soNoiBat = noiDung.noiBat.reduce(
      (tong, muc) => tong + muc.cacMuc.length,
      0,
    );

    const [, banTinDaLuu] = await prisma.$transaction(
      [
        prisma.digestRun.update({
          where: { id: lanChay.id },
          data: {
            status: "success",
            finishedAt: new Date(),
            newItemsFound: noiDung.tongMoi,
          },
        }),
        prisma.assistantBriefing.create({
          data: {
            digestRunId: lanChay.id,
            pickedItemsTiered: gonLai,
            conversationalScript: banTin,
          },
        }),
      ],
      { timeout: HAN_GHI_MS, maxWait: HAN_CHO_MS },
    );

    return {
      idBanTin: banTinDaLuu.id,
      banTin,
      soNoiBat,
      soXemThem: noiDung.xemThemNeuRanh.length,
      tongMoi: noiDung.tongMoi,
    };
  } catch (e) {
    await prisma.digestRun.update({
      where: { id: lanChay.id },
      data: {
        status: "failed",
        finishedAt: new Date(),
        errorSummary: e instanceof Error ? e.message.slice(0, 500) : String(e),
      },
    });
    throw e;
  }
}
