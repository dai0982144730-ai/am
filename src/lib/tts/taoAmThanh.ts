/**
 * Sinh file âm thanh cho bản thuật lại và bản tin sáng.
 *
 * ĐÂY LÀ MẢNH CUỐI làm Am thành app **nghe** được, chứ không phải app đọc.
 *
 * ## Vì sao lưu ra file chứ không nhét vào database
 *
 * Một bản thuật lại 9.000 ký tự cho ra file MP3 khoảng 5 MB. Nhét vào database
 * thì mỗi lần mở trang phải kéo cả khối đó qua đường mạng tới Neon rồi mới đẩy
 * xuống trình duyệt — chậm gấp nhiều lần, và làm bản sao lưu database phình ra
 * vô lý. Để trong `public/am-thanh/` thì Next phục vụ thẳng như một file tĩnh,
 * hỗ trợ sẵn tua và tải dần.
 *
 * ## Nguyên tắc: chạy được nhiều lần, không đọc lại thứ đã đọc
 *
 * Đọc lại một bài đã có audio là ném tiền qua cửa sổ — hạn mức tính theo ký tự
 * gửi đi, không quan tâm bạn có dùng kết quả hay không. Nên luôn kiểm `ttsAudioUrl`
 * trước, và chỉ đọc lại khi người dùng cố ý yêu cầu.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { prisma } from "@/lib/db/prisma";

import { docThanhTieng } from "./doc";
import { HetHanMucTts } from "./hanMuc";

/** Thư mục chứa file âm thanh, nằm trong `public` nên Next phục vụ thẳng. */
const THU_MUC = path.join(process.cwd(), "public", "am-thanh");

/** Đường dẫn web tương ứng. */
const GOC_WEB = "/am-thanh";

async function baoDamCoThuMuc(): Promise<void> {
  await mkdir(THU_MUC, { recursive: true });
}

export interface KetQuaTaoAmThanh {
  daXet: number;
  thanhCong: number;
  boQuaDaCo: number;
  soKyTu: number;
  hetHanMuc: boolean;
  loi: { ten: string; lyDo: string }[];
}

/**
 * Đọc thành tiếng các bản thuật lại chưa có audio.
 *
 * Ưu tiên nội dung điểm cao: mỗi bản tốn hạn mức thật, nên nếu chỉ đọc được
 * vài bản trong đêm thì phải là những bản đáng nghe nhất.
 */
export async function taoAmThanhChoThuatLai(
  soToiDa = 5,
): Promise<KetQuaTaoAmThanh> {
  await baoDamCoThuMuc();

  const canDoc = await prisma.narrationAsset.findMany({
    where: { ttsAudioUrl: null },
    orderBy: {
      contentItem: { score: { compositeScore: { sort: "desc", nulls: "last" } } },
    },
    take: soToiDa,
    select: {
      id: true,
      scriptText: true,
      contentItem: { select: { title: true } },
    },
  });

  const kq: KetQuaTaoAmThanh = {
    daXet: canDoc.length,
    thanhCong: 0,
    boQuaDaCo: 0,
    soKyTu: 0,
    hetHanMuc: false,
    loi: [],
  };

  for (const ban of canDoc) {
    try {
      const am = await docThanhTieng(ban.scriptText);
      const ten = `thuat-lai-${ban.id}.mp3`;
      await writeFile(path.join(THU_MUC, ten), am.amThanh);

      await prisma.narrationAsset.update({
        where: { id: ban.id },
        data: { ttsAudioUrl: `${GOC_WEB}/${ten}`, ttsVoice: am.giong },
      });

      kq.thanhCong += 1;
      kq.soKyTu += am.soKyTu;
    } catch (e) {
      // Hết hạn mức thì DỪNG HẲN, đừng thử tiếp — mọi bản sau cũng sẽ bị chặn,
      // và mỗi lần thử lại là một lượt truy vấn vô ích.
      if (e instanceof HetHanMucTts) {
        kq.hetHanMuc = true;
        break;
      }
      kq.loi.push({
        ten: ban.contentItem.title.slice(0, 44),
        lyDo: e instanceof Error ? e.message.slice(0, 120) : String(e),
      });
    }
  }

  return kq;
}

/**
 * Đọc bản tin sáng gần nhất.
 *
 * Đây là thứ đáng đọc nhất trong cả app: chủ nhà nghe nó lúc vừa ngủ dậy, và
 * nó chỉ dài hơn nghìn ký tự nên gần như không tốn hạn mức.
 */
export async function taoAmThanhChoBanTin(): Promise<{
  daTao: boolean;
  lyDo: string | null;
  duongDan: string | null;
}> {
  await baoDamCoThuMuc();

  const banTin = await prisma.assistantBriefing.findFirst({
    orderBy: { deliveredAt: "desc" },
    select: { id: true, conversationalScript: true, audioBriefingUrl: true },
  });

  if (!banTin) return { daTao: false, lyDo: "chưa có bản tin nào", duongDan: null };

  if (banTin.audioBriefingUrl) {
    return {
      daTao: false,
      lyDo: "bản tin này đã có audio",
      duongDan: banTin.audioBriefingUrl,
    };
  }

  try {
    const am = await docThanhTieng(banTin.conversationalScript);
    const ten = `ban-tin-${banTin.id}.mp3`;
    await writeFile(path.join(THU_MUC, ten), am.amThanh);

    const duongDan = `${GOC_WEB}/${ten}`;
    await prisma.assistantBriefing.update({
      where: { id: banTin.id },
      data: { audioBriefingUrl: duongDan },
    });

    return { daTao: true, lyDo: null, duongDan };
  } catch (e) {
    return {
      daTao: false,
      lyDo: e instanceof Error ? e.message : String(e),
      duongDan: null,
    };
  }
}
