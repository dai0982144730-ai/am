/**
 * Đưa chữ tiếng Việt cho Google đọc thành tiếng.
 *
 * **MỌI ĐƯỜNG GỌI TỚI GOOGLE ĐỀU ĐI QUA ĐÂY**, và ở đây luôn hỏi chốt chặn hạn
 * mức trước. Không có hàm nào khác gọi thẳng ra ngoài — nếu sau này thêm, phải
 * thêm vào file này chứ đừng viết chỗ khác, kẻo có một đường vòng không ai
 * phanh được.
 *
 * Google cho phép tối đa 5.000 byte mỗi lần gọi, mà một bản thuật lại thường
 * dài 8.000 ký tự trở lên — nên phải cắt thành nhiều đoạn rồi nối lại.
 */

import { Buffer } from "node:buffer";

import { prisma } from "@/lib/db/prisma";

import { timGiong } from "./giong";

import {
  conDocDuoc,
  ghiNhanDaDoc,
  ghiNhanLoi,
  HetHanMucTts,
} from "./hanMuc";

/**
 * Google giới hạn 5.000 byte mỗi lần gọi.
 *
 * Cắt ở 2.500 **ký tự** chứ không phải byte, vì tiếng Việt có dấu nên một ký tự
 * chiếm 2–3 byte. 2.500 ký tự tiếng Việt rơi vào khoảng 3.500–4.500 byte, vẫn
 * dưới trần mà không phải đi đếm byte từng đoạn.
 */
const TOI_DA_MOI_DOAN = 2_500;

/**
 * Giọng đang chọn, đọc từ màn hình Cài đặt.
 *
 * Để trong database chứ không trong `.env` vì đây là **lựa chọn về cảm giác
 * nghe**, chủ nhà đổi lúc nào cũng được và không phải khởi động lại máy chủ.
 * Khác hẳn khoá API — thứ đó là bí mật nên ở nguyên trong `.env`.
 */
async function giongDangChon(): Promise<string> {
  const caiDat = await prisma.userAssistantSettings.findUnique({
    where: { id: "singleton" },
    select: { ttsVoice: true },
  });
  return timGiong(caiDat?.ttsVoice).ma;
}

export class ChuaCauHinhTts extends Error {
  constructor() {
    super(
      "Chưa có TTS_API_KEY trong .env. Bật Cloud Text-to-Speech API trong " +
        "Google Cloud, tạo khoá rồi thêm dòng TTS_API_KEY=... vào .env.",
    );
    this.name = "ChuaCauHinhTts";
  }
}

/** Đã cấu hình giọng đọc chưa. Dùng để hiện trạng thái, không lộ khoá. */
export function daCauHinh(): boolean {
  return Boolean(process.env.TTS_API_KEY?.trim());
}

/**
 * Cắt bài dài thành đoạn vừa sức một lần gọi.
 *
 * Cắt ở **cuối câu** chứ không cắt giữa chừng: nối hai file âm thanh bị đứt
 * giữa câu thì nghe rõ chỗ vá, giọng hụt hơi rất khó chịu.
 */
export function catThanhDoan(vanBan: string, toiDa = TOI_DA_MOI_DOAN): string[] {
  const sach = vanBan.trim();
  if (sach.length <= toiDa) return [sach];

  // Tách theo câu, giữ lại dấu kết câu
  const cacCau = sach.split(/(?<=[.!?…]["')\]]?)\s+/);
  const doan: string[] = [];
  let dangGom = "";

  for (const cau of cacCau) {
    if (dangGom && (dangGom + " " + cau).length > toiDa) {
      doan.push(dangGom);
      dangGom = cau;
    } else {
      dangGom = dangGom ? `${dangGom} ${cau}` : cau;
    }

    // Một câu dài hơn cả trần — hiếm, nhưng có (câu liệt kê dài). Cắt cứng.
    while (dangGom.length > toiDa) {
      doan.push(dangGom.slice(0, toiDa));
      dangGom = dangGom.slice(toiDa);
    }
  }

  if (dangGom) doan.push(dangGom);
  return doan.filter((d) => d.trim().length > 0);
}

interface PhanHoiGoogle {
  audioContent?: string;
  error?: { message?: string; status?: string };
}

/** Gọi Google cho đúng một đoạn. */
async function docMotDoan(doan: string, giong: string): Promise<Buffer> {
  const khoa = process.env.TTS_API_KEY?.trim();
  if (!khoa) throw new ChuaCauHinhTts();

  const phanHoi = await fetch(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(khoa)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: { text: doan },
        voice: { languageCode: "vi-VN", name: giong },
        audioConfig: { audioEncoding: "MP3" },
      }),
    },
  );

  const ketQua = (await phanHoi.json()) as PhanHoiGoogle;

  if (!phanHoi.ok || !ketQua.audioContent) {
    const thongDiep = ketQua.error?.message ?? `HTTP ${phanHoi.status}`;
    throw new Error(`Google từ chối: ${thongDiep}`);
  }

  return Buffer.from(ketQua.audioContent, "base64");
}

export interface KetQuaDoc {
  amThanh: Buffer;
  soKyTu: number;
  soDoan: number;
  giong: string;
}

/**
 * Đọc trọn một bài.
 *
 * Ném `HetHanMucTts` khi đã chạm ngưỡng khoá — nơi gọi phải bắt và **bỏ qua
 * êm thấm**, đừng làm chết cả lượt quét đêm chỉ vì hết hạn mức giọng đọc.
 */
export async function docThanhTieng(
  vanBan: string,
  giongChiDinh?: string,
): Promise<KetQuaDoc> {
  const giong = giongChiDinh ?? (await giongDangChon());
  const sach = vanBan.trim();
  if (sach.length === 0) throw new Error("Không có chữ nào để đọc.");

  // Chốt chặn: hỏi TRƯỚC khi gọi, và hỏi kèm độ dài sắp gọi
  const kiemTra = await conDocDuoc(sach.length);
  if (!kiemTra.duoc) throw new HetHanMucTts(kiemTra.tinhHinh);

  const cacDoan = catThanhDoan(sach);
  const mieng: Buffer[] = [];

  try {
    for (const doan of cacDoan) {
      mieng.push(await docMotDoan(doan, giong));
      // Ghi nhận từng đoạn một, không đợi xong cả bài. Bài dài mà hỏng giữa
      // chừng thì phần đã đọc vẫn tính — vì Google đã tính tiền phần đó rồi.
      await ghiNhanDaDoc(doan.length);
    }
  } catch (e) {
    await ghiNhanLoi(e instanceof Error ? e.message : String(e));
    throw e;
  }

  return {
    // Nối thẳng các file MP3 lại với nhau. Nghe được bình thường vì MP3 là
    // chuỗi khung độc lập — không cần bộ ghép chuyên dụng.
    amThanh: Buffer.concat(mieng),
    soKyTu: sach.length,
    soDoan: cacDoan.length,
    giong,
  };
}
