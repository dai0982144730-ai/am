import { z } from "zod";

import { batNhatKy } from "@/lib/nghiepVu/ghiNhatKy";
import { timKiemNoiDung } from "@/lib/nghiepVu/timKiemNoiDung";
import { LoiTroLy, tuyenTroLy } from "@/lib/troLyChung/phanHoi";

batNhatKy();

export const dynamic = "force-dynamic";

const ThamSo = z.object({
  tuKhoa: z
    .string({ error: "thiếu, hoặc không phải chuỗi chữ" })
    .min(1, "không được để trống"),
  chuyenMuc: z.string({ error: "phải là chuỗi chữ" }).optional(),
  tuNgay: z
    .string({ error: "phải là chuỗi chữ" })
    .regex(/^\d{4}-\d{2}-\d{2}$/, "phải viết dạng yyyy-mm-dd")
    .optional(),
  soLuong: z
    .number({ error: "phải là số" })
    .int("phải là số nguyên")
    .positive("phải lớn hơn 0")
    .optional(),
  kemNoiDung: z.boolean({ error: "phải là true hoặc false" }).optional(),
});

export const POST = tuyenTroLy("tim-kiem", async (request) => {
  const than = await request.json().catch(() => {
    throw new LoiTroLy("tham_so_sai", "Thân yêu cầu không phải JSON hợp lệ.");
  });

  const doc = ThamSo.safeParse(than);
  if (!doc.success) {
    const chiTiet = doc.error.issues.map((v) => `${v.path.join(".")}: ${v.message}`).join("; ");
    throw new LoiTroLy("tham_so_sai", chiTiet);
  }

  return timKiemNoiDung(doc.data);
});
