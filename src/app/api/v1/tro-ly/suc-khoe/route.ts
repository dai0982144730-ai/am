import { batNhatKy } from "@/lib/nghiepVu/ghiNhatKy";
import { kiemTraSucKhoe } from "@/lib/nghiepVu/sucKhoe";
import { tuyenTroLy } from "@/lib/troLyChung/phanHoi";

batNhatKy();

/** Endpoint này phải chạm database thật mỗi lần gọi, không được trả bản đã lưu sẵn */
export const dynamic = "force-dynamic";

export const GET = tuyenTroLy("suc-khoe", async () => kiemTraSucKhoe());
