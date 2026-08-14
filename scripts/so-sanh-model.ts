/**
 * So sánh hai model phân loại trên CÙNG một bộ video.
 *
 *   npx tsx scripts/so-sanh-model.ts
 *   npx tsx scripts/so-sanh-model.ts --so 8
 *
 * Không ghi gì vào database — chỉ gọi và in ra để người đọc tự đánh giá.
 *
 * Mục đích: trả lời câu "dùng Haiku có kém hơn Sonnet không" bằng số liệu trên
 * chính dữ liệu của mình, thay vì đoán. Chọn sẵn những video khó phân loại
 * (giảng pháp, truyện, nhạc, tin tức) vì đó mới là chỗ hai model khác nhau.
 */

import "dotenv/config";

import { prisma } from "../src/lib/db/prisma";
import { chonCachGoi } from "../src/lib/llm/phanLoai";
import { phanLoaiMotNoiDung } from "../src/lib/llm/phanLoai";

function thamSo(ten: string): number | undefined {
  const vt = process.argv.indexOf(`--${ten}`);
  if (vt === -1) return undefined;
  const so = Number(process.argv[vt + 1]);
  return Number.isFinite(so) && so > 0 ? so : undefined;
}

const CAC_MODEL = ["claude-haiku-4-5", "claude-sonnet-5"] as const;

async function main() {
  const soVideo = thamSo("so") ?? 5;

  console.log(`Đường gọi: ${chonCachGoi() === "cli" ? "Claude CLI trên máy" : "khoá API"}`);
  console.log(`So sánh ${CAC_MODEL.join(" vs ")} trên ${soVideo} video\n`);

  // Chọn video KHÓ: những cái có khả năng rơi vào bốn nhóm tinh tế, vì đó mới
  // là chỗ hai model khác nhau. Lấy video xếp nhóm "Khác" thì cả hai đều đúng,
  // không nói lên điều gì.
  const TU_KHOA_KHO = [
    "thầy", "sư", "pháp", "thiền", "phật", "tâm lý", "triết",
    "AI", "Claude", "ChatGPT", "trí tuệ nhân tạo",
    "truyện", "kể chuyện", "kinh dị", "ma",
    "nhạc", "BPM", "mix", "playlist", "piano", "guitar",
  ];

  const cacMuc = await prisma.contentItem.findMany({
    where: {
      classification: null,
      transcript: { isNot: null },
      OR: TU_KHOA_KHO.map((tu) => ({
        title: { contains: tu, mode: "insensitive" as const },
      })),
    },
    orderBy: { durationSeconds: "desc" },
    take: soVideo,
    include: {
      source: { select: { title: true } },
      transcript: { select: { rawText: true, fetchStatus: true } },
    },
  });

  if (cacMuc.length === 0) {
    console.log("Không tìm thấy video khó nào chưa phân loại.");
    return;
  }

  for (const muc of cacMuc) {
    console.log("─".repeat(72));
    console.log(`${muc.title.slice(0, 68)}`);
    console.log(`   kênh: ${muc.source.title} · ${Math.round((muc.durationSeconds ?? 0) / 60)} phút`);

    for (const model of CAC_MODEL) {
      process.env.MODEL_PHAN_LOAI = model;
      const batDau = Date.now();
      try {
        const goi = await phanLoaiMotNoiDung({
          tieuDe: muc.title,
          moTa: muc.description,
          tenKenh: muc.source.title,
          thoiLuongGiay: muc.durationSeconds,
          loiThoai:
            muc.transcript?.fetchStatus === "success"
              ? muc.transcript.rawText
              : null,
        });
        const kq = goi.ketQua;
        const giay = ((Date.now() - batDau) / 1000).toFixed(1);

        console.log(
          `\n   ${model.padEnd(18)} → ${kq.nhom.toUpperCase().padEnd(10)} (${giay}s, ${goi.tokenVao + goi.tokenNhoLai} chữ vào)`,
        );
        console.log(`      chủ đề: ${kq.chuDe.join(", ")}`);
        console.log(`      nhận xét: ${kq.nhanXetChatLuong}`);

        const rieng: string[] = [];
        if (kq.truongPhai) rieng.push(`trường phái=${kq.truongPhai}`);
        if (kq.coDauHieuMeTin) rieng.push("CÓ DẤU HIỆU MÊ TÍN");
        if (kq.theLoaiTruyen) rieng.push(`thể loại=${kq.theLoaiTruyen}`);
        if (kq.nghiNgoDoAiViet !== null)
          rieng.push(`nghi ngờ AI viết=${kq.nghiNgoDoAiViet}`);
        if (kq.theLoaiNhac) rieng.push(`nhạc=${kq.theLoaiNhac}`);
        if (kq.bpm) rieng.push(`BPM=${kq.bpm}`);
        if (kq.aiChuDeCon) rieng.push(`AI: ${kq.aiChuDeCon}`);
        if (kq.tenTacGiaThoNhat) rieng.push(`tác giả=${kq.tenTacGiaThoNhat}`);
        if (rieng.length) console.log(`      ${rieng.join(" · ")}`);
      } catch (e) {
        console.log(
          `\n   ${model.padEnd(18)} → LỖI: ${e instanceof Error ? e.message.slice(0, 120) : e}`,
        );
      }
    }
    console.log();
  }

  console.log("─".repeat(72));
  console.log(
    "\nĐọc kỹ chỗ hai model xếp KHÁC nhóm nhau, và chỗ nhận xét chất lượng —\n" +
      "đó là nơi chênh lệch thật sự nằm.",
  );
}

main().catch((loi) => {
  console.error("\n✗ Lỗi:", loi instanceof Error ? loi.message : loi);
  process.exit(1);
});
