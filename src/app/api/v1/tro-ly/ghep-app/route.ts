import { z } from "zod";

import { doiMaLayThe } from "@/lib/troLyChung/theThietBi";
import { phanHoiLoi } from "@/lib/troLyChung/phanHoi";
import { nguonGoi } from "@/lib/troLyChung/xacThucTokenTroLy";

export const dynamic = "force-dynamic";

const ThamSo = z.object({ ma: z.string({ error: "thiếu, hoặc không phải chuỗi chữ" }) });

/**
 * `POST /api/v1/tro-ly/ghep-app`: đổi mã ghép lấy thẻ thiết bị.
 *
 * Tuyến này KHÔNG đòi Authorization, vì app chưa có gì trong tay: mã ghép chính là
 * bằng chứng. Mã sống 5 phút, dùng một lần, đoán sai quá 10 lần mỗi phút thì bị
 * khoá nguồn gọi một lúc (xem `theThietBi.ts`).
 */
export async function POST(request: Request): Promise<Response> {
  const than = await request.json().catch(() => null);
  const doc = ThamSo.safeParse(than);
  if (!doc.success) {
    return phanHoiLoi("tham_so_sai", "ma: thiếu, hoặc không phải chuỗi chữ");
  }

  const kq = doiMaLayThe(doc.data.ma, nguonGoi(request));
  if (!kq.ok) {
    switch (kq.lyDo) {
      case "goi_qua_nhieu":
        return phanHoiLoi("goi_qua_nhieu", "Nhập sai quá nhiều lần. Chờ một phút rồi thử lại.");
      case "thieu_khoa":
        return phanHoiLoi("loi_he_thong", "Máy chủ chưa có AUTH_SECRET trong .env nên chưa cấp được thẻ.");
      case "sai_dang":
        return phanHoiLoi("tham_so_sai", "Mã gồm 8 chữ và số, dạng K7M2-QX9P.");
      default:
        return phanHoiLoi(
          "token_sai",
          "Mã không đúng, đã dùng rồi, hoặc đã quá 5 phút. Tạo mã mới ở trang Vận hành.",
        );
    }
  }

  return Response.json({
    the: kq.the,
    hetHanLuc: new Date(kq.hetHanLuc).toISOString(),
    email: kq.email,
  });
}
