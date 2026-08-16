/**
 * Claude đề xuất nên bỏ video nào vào playlist nào.
 *
 * **CHỈ ĐỀ XUẤT.** Không có đường nào từ file này ghi thẳng ra YouTube. Việc ghi
 * nằm ở `apDung.ts` và chỉ chạy sau khi người dùng bấm duyệt từng việc.
 *
 * Bản thiết kế xếp đây là một trong ba nguyên tắc xuyên suốt: mọi thao tác ghi
 * ra thế giới thật đều phải qua đề xuất → duyệt → áp dụng.
 *
 * NGUỒN ỨNG VIÊN: nội dung chủ nhà đã cất vào thư viện, hoặc điểm chất lượng
 * cao. Không đề xuất tất cả mọi thứ quét về — mỗi đề xuất là một lời mời bấm
 * duyệt, mà danh sách chờ duyệt dài quá thì chẳng ai duyệt nữa.
 */

import { z } from "zod";

import { prisma } from "@/lib/db/prisma";
import { goiClaudeCli } from "@/lib/llm/claudeCli";
import { chonCachGoi } from "@/lib/llm/phanLoai";

/**
 * Chỉ đề xuất video thuộc bốn chuyên mục chính, **bỏ hẳn nhóm "khác"**.
 *
 * Cùng lý do như bản tin hằng sáng (`troLy/chonNoiDung.ts`): kho hằng đêm phần
 * lớn là tin thời sự và giải trí, chúng lại hay có lượt xem cao nên điểm cũng
 * cao. Lọc theo điểm trên toàn kho thì danh sách đề xuất toàn tin giật gân,
 * đúng thứ chủ nhà lập ra cái web này để tránh.
 *
 * Đã vấp thật lần đầu chạy: cả ba ứng viên đều là video chính trị và tôn giáo
 * nhóm "khác" điểm 6,0–6,5, trong khi 12 video AI đã phân loại thì không lọt
 * vào vì điểm thấp hơn — điểm được chuẩn hoá trong cùng loại nguồn nên video
 * chuyên môn ít lượt xem luôn thua video thời sự.
 */
const CHUYEN_MUC_DE_XUAT = [
  "ai",
  "triet_hoc",
  "truyen",
  "music",
  "khoa_hoc",
] as const;

const KhungDeXuat = z.object({
  quyetDinh: z
    .enum(["vao_playlist_co_san", "tao_playlist_moi", "bo_qua"])
    .describe("bo_qua khi video không hợp với playlist nào và cũng chưa đáng lập playlist riêng"),
  tenPlaylist: z
    .string()
    .nullable()
    .describe(
      "Tên playlist có sẵn (chép đúng nguyên văn từ danh sách được đưa), hoặc tên playlist mới cần tạo. Null khi bỏ qua.",
    ),
  lyDo: z
    .string()
    .describe("Một hai câu tiếng Việt giải thích, để chủ nhà đọc rồi quyết định duyệt hay không"),
});

const LOI_DAN = `Bạn giúp chủ nhà sắp xếp video vào playlist trên YouTube của họ.

Bạn được đưa: thông tin một video, và danh sách playlist họ đang có.

## Nguyên tắc

**Ưu tiên playlist có sẵn.** Chủ nhà đã tự tay lập chúng, nên chúng phản ánh
đúng cách họ nghĩ. Chỉ đề nghị lập playlist mới khi video thật sự không thuộc
về cái nào đang có.

**Được phép bỏ qua.** Nếu video không hợp playlist nào mà cũng chưa đủ để lập
playlist riêng thì chọn bo_qua. Đề xuất bừa còn tệ hơn không đề xuất: mỗi đề
xuất là một lần bắt chủ nhà dừng lại đọc và quyết định.

**Chép đúng nguyên văn tên playlist** khi chọn cái có sẵn. Sai một chữ là hệ
thống không tìm ra.

## Về lý do

Viết cho người đọc, không phải cho máy. Nói thẳng vì sao video này hợp chỗ đó.
Chủ nhà sẽ đọc câu này rồi bấm duyệt hoặc bỏ, nên nó phải đủ để quyết định mà
không cần mở video ra xem.

Trả lời DUY NHẤT một object JSON theo khuôn dưới đây.`;

function bocJson(vanBan: string): string {
  const daBoRao = vanBan
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();
  const dau = daBoRao.indexOf("{");
  const cuoi = daBoRao.lastIndexOf("}");
  if (dau === -1 || cuoi === -1 || cuoi < dau) return daBoRao;
  return daBoRao.slice(dau, cuoi + 1);
}

interface VideoUngVien {
  id: string;
  title: string;
  contentGroup: string;
  durationSeconds: number | null;
  classification: {
    contentQualityNotes: string | null;
    extractedTopics: string[];
  } | null;
  score: { compositeScore: number | null } | null;
}

function soanCauHoi(
  video: VideoUngVien,
  tenCacPlaylist: string[],
): string {
  const phut = video.durationSeconds
    ? `${Math.round(video.durationSeconds / 60)} phút`
    : "không rõ thời lượng";

  return [
    `Video: "${video.title}"`,
    `Chuyên mục: ${video.contentGroup} · ${phut}`,
    video.score?.compositeScore != null
      ? `Điểm chất lượng: ${video.score.compositeScore.toFixed(1)}/10`
      : null,
    video.classification?.extractedTopics.length
      ? `Chủ đề: ${video.classification.extractedTopics.join(", ")}`
      : null,
    video.classification?.contentQualityNotes
      ? `Nhận xét khi đọc: ${video.classification.contentQualityNotes}`
      : null,
    ``,
    tenCacPlaylist.length > 0
      ? `Playlist chủ nhà đang có:\n${tenCacPlaylist.map((t) => `  - ${t}`).join("\n")}`
      : `Chủ nhà chưa có playlist nào được bật cho trợ lý sắp xếp.`,
  ]
    .filter((d) => d !== null)
    .join("\n");
}

export interface KetQuaDeXuat {
  daXet: number;
  soDeXuat: number;
  soBoQua: number;
  soPlaylistMoi: number;
  loi: { video: string; lyDo: string }[];
}

/**
 * Sinh đề xuất cho các video chưa có đề xuất nào.
 *
 * Bỏ qua video đã có đề xuất đang chờ hoặc đã áp dụng — chạy lại nhiều lần
 * không sinh trùng.
 */
export async function sinhDeXuat(soToiDa = 10): Promise<KetQuaDeXuat> {
  if (chonCachGoi() !== "cli") {
    throw new Error("Phần đề xuất playlist hiện chỉ chạy qua Claude CLI.");
  }

  const model = process.env.MODEL_DE_XUAT?.trim() || "claude-sonnet-5";

  const cacPlaylist = await prisma.youTubePlaylist.findMany({
    where: { managedByAI: true },
    select: { id: true, title: true },
  });
  const theoTen = new Map(cacPlaylist.map((p) => [p.title, p.id]));

  // Video đã có đề xuất rồi thì thôi — kể cả đề xuất đã bị từ chối, vì hỏi
  // lại đúng câu chủ nhà vừa nói không là chuyện khó chịu
  const daCoDeXuat = await prisma.playlistOrganizationSuggestion.findMany({
    select: { contentItemId: true },
  });
  const boQuaId = daCoDeXuat
    .map((d) => d.contentItemId)
    .filter((id): id is string => id !== null);

  const ungVien = await prisma.contentItem.findMany({
    where: {
      status: "classified",
      // Chỉ video YouTube — playlist YouTube không chứa được bài blog
      url: { contains: "watch?v=" },
      id: { notIn: boQuaId },
      OR: [
        // Thứ chủ nhà tự tay cất thì luôn đáng đem ra hỏi, kể cả nhóm "khác"
        { libraryItem: { isNot: null } },
        { contentGroup: { in: [...CHUYEN_MUC_DE_XUAT] } },
      ],
    },
    orderBy: [{ score: { compositeScore: { sort: "desc", nulls: "last" } } }],
    take: soToiDa,
    select: {
      id: true,
      title: true,
      contentGroup: true,
      durationSeconds: true,
      classification: {
        select: { contentQualityNotes: true, extractedTopics: true },
      },
      score: { select: { compositeScore: true } },
    },
  });

  const ketQua: KetQuaDeXuat = {
    daXet: ungVien.length,
    soDeXuat: 0,
    soBoQua: 0,
    soPlaylistMoi: 0,
    loi: [],
  };

  const loiDan = LOI_DAN + `\n\n${JSON.stringify(z.toJSONSchema(KhungDeXuat), null, 1)}`;

  for (const video of ungVien) {
    try {
      const goi = await goiClaudeCli({
        loiDan,
        cauHoi: soanCauHoi(video, [...theoTen.keys()]),
        model,
      });

      const kiemTra = KhungDeXuat.safeParse(JSON.parse(bocJson(goi.vanBan)));
      if (!kiemTra.success) {
        throw new Error(
          `JSON sai khuôn ở "${kiemTra.error.issues[0]?.path.join(".")}"`,
        );
      }

      const dx = kiemTra.data;

      if (dx.quyetDinh === "bo_qua" || !dx.tenPlaylist) {
        ketQua.soBoQua += 1;
        continue;
      }

      const idPlaylist = theoTen.get(dx.tenPlaylist);

      // Claude bảo dùng playlist có sẵn nhưng tên không khớp cái nào — coi như
      // nó nhầm, bỏ qua thay vì âm thầm tạo playlist mới ngoài ý muốn
      if (dx.quyetDinh === "vao_playlist_co_san" && !idPlaylist) {
        ketQua.soBoQua += 1;
        continue;
      }

      await prisma.playlistOrganizationSuggestion.create({
        data: {
          contentItemId: video.id,
          suggestedPlaylistId: idPlaylist ?? null,
          newPlaylistTitle: idPlaylist ? null : dx.tenPlaylist,
          reason: dx.lyDo,
          type: "new_save",
          status: "pending",
        },
      });

      ketQua.soDeXuat += 1;
      if (!idPlaylist) ketQua.soPlaylistMoi += 1;
    } catch (e) {
      ketQua.loi.push({
        video: video.title.slice(0, 40),
        lyDo: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return ketQua;
}
