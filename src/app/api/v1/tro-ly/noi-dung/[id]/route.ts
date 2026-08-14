import { batNhatKy } from "@/lib/nghiepVu/ghiNhatKy";
import { layNoiDungTheoId } from "@/lib/nghiepVu/timKiemNoiDung";
import { tuyenTroLy } from "@/lib/troLyChung/phanHoi";

batNhatKy();

export const dynamic = "force-dynamic";

/**
 * Ở bản Next.js này `params` là một Promise, phải await mới lấy được giá trị —
 * khác với các bản trước. Xem node_modules/next/dist/docs, mục route.js.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  return tuyenTroLy("noi-dung", async () => layNoiDungTheoId(id))(request);
}
