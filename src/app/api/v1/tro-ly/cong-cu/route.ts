import { CONG_CU_AM } from "@/lib/nghiepVu/congCu";
import { batNhatKy } from "@/lib/nghiepVu/ghiNhatKy";
import { PHIEN_BAN_API, TEN_TRANG, type DanhSachCongCu } from "@/lib/troLyChung/kieuDuLieu";
import { tuyenTroLy } from "@/lib/troLyChung/phanHoi";

batNhatKy();

export const dynamic = "force-dynamic";

export const GET = tuyenTroLy("cong-cu", async () => {
  const danhSach: DanhSachCongCu = {
    trang: TEN_TRANG,
    phienBanApi: PHIEN_BAN_API,
    congCu: CONG_CU_AM,
  };
  return danhSach;
});
