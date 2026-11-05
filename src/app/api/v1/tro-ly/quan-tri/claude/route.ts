import { z } from "zod";

import { batNhatKy } from "@/lib/nghiepVu/ghiNhatKy";
import {
  chuanHoaMa,
  dangXuatRieng,
  docTrangThai,
  guiMa,
  huyDangNhap,
  moDangNhap,
  thuTroLy,
} from "@/lib/llm/dangNhapClaude";
import { LoiTroLy, tuyenTroLy } from "@/lib/troLyChung/phanHoi";

batNhatKy();

export const dynamic = "force-dynamic";

const ThamSo = z.object({
  hanhDong: z.enum(["trang_thai", "mo_link", "nhap_ma", "huy", "dang_xuat", "thu"], {
    error: "phải là một trong: trang_thai, mo_link, nhap_ma, huy, dang_xuat, thu",
  }),
  ma: z.string({ error: "phải là chuỗi chữ" }).optional(),
});

/**
 * `POST /api/v1/tro-ly/quan-tri/claude`: đăng nhập tài khoản Claude của máy chủ
 * từ app Android. Cùng luồng với thẻ "Tài khoản Claude" ở trang Vận hành.
 *
 * CHỈ nhận thẻ thiết bị (app đã ghép bằng mã), không nhận `TOKEN_TRO_LY`.
 * Lỗi của việc đăng nhập (mã sai, hết hạn...) trả 200 kèm `ok: false` và câu
 * tiếng Việt trong `message`, giống các thao tác ở trang Vận hành.
 */
export const POST = tuyenTroLy(
  "quan-tri-claude",
  async (request) => {
    const than = await request.json().catch(() => {
      throw new LoiTroLy("tham_so_sai", "Thân yêu cầu không phải JSON hợp lệ.");
    });
    const doc = ThamSo.safeParse(than);
    if (!doc.success) {
      throw new LoiTroLy(
        "tham_so_sai",
        doc.error.issues.map((v) => `${v.path.join(".")}: ${v.message}`).join("; "),
      );
    }

    switch (doc.data.hanhDong) {
      case "trang_thai":
        return { ok: true, message: "", trangThai: await docTrangThai() };
      case "mo_link": {
        const kq = await moDangNhap();
        return kq.ok ? { ok: true, message: "", url: kq.url } : kq;
      }
      case "nhap_ma": {
        const ma = chuanHoaMa(doc.data.ma);
        if (!ma) {
          return {
            ok: false,
            message:
              "Mã không đúng dạng. Trên trang Claude bấm nút chép mã (Copy Code) rồi dán nguyên mã vào đây.",
          };
        }
        return guiMa(ma);
      }
      case "huy":
        huyDangNhap();
        return { ok: true, message: "Đã huỷ lượt đăng nhập." };
      case "dang_xuat":
        return dangXuatRieng();
      case "thu":
        return thuTroLy();
    }
  },
  { chiTheThietBi: true },
);
