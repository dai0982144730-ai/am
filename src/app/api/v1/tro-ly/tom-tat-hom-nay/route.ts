import { batNhatKy } from "@/lib/nghiepVu/ghiNhatKy";
import { tomTatHomNay } from "@/lib/nghiepVu/tomTatHomNay";
import { tuyenTroLy } from "@/lib/troLyChung/phanHoi";

batNhatKy();

export const dynamic = "force-dynamic";

export const GET = tuyenTroLy("tom-tat-hom-nay", async (request) => {
  const thamSo = new URL(request.url).searchParams.get("soNgay");
  const soNgay = thamSo ? Number(thamSo) : 1;
  // Số không hợp lệ thì lặng lẽ quay về mặc định, không bắt người gọi phải sửa
  return tomTatHomNay(Number.isFinite(soNgay) ? soNgay : 1);
});
