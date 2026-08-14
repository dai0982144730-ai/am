import { z } from "zod";

import { batNhatKy } from "@/lib/nghiepVu/ghiNhatKy";
import { hoiTroLy } from "@/lib/nghiepVu/hoiTroLy";
import { LoiTroLy, tuyenTroLy } from "@/lib/troLyChung/phanHoi";

batNhatKy();

export const dynamic = "force-dynamic";

/** Gọi Claude đọc mấy nội dung dài nên lâu hơn các endpoint khác */
export const maxDuration = 120;

const ThamSo = z.object({
  cauHoi: z
    .string({ error: "thiếu, hoặc không phải chuỗi chữ" })
    .min(1, "không được để trống"),
  cheDoGiongNoi: z.boolean({ error: "phải là true hoặc false" }).optional(),
});

export const POST = tuyenTroLy("hoi", async (request) => {
  const than = await request.json().catch(() => {
    throw new LoiTroLy("tham_so_sai", "Thân yêu cầu không phải JSON hợp lệ.");
  });

  const doc = ThamSo.safeParse(than);
  if (!doc.success) {
    const chiTiet = doc.error.issues.map((v) => `${v.path.join(".")}: ${v.message}`).join("; ");
    throw new LoiTroLy("tham_so_sai", chiTiet);
  }

  const ketQua = await hoiTroLy(doc.data);

  // Trả thêm số token AI đã dùng để vỏ chung ghi vào nhật ký chi phí
  return {
    than: ketQua.traLoi,
    tokenAiVao: ketQua.tokenAiVao,
    tokenAiRa: ketQua.tokenAiRa,
  };
});
