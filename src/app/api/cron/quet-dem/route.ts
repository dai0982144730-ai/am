/**
 * Tuyến cho dịch vụ hẹn giờ gọi vào để chạy việc quét đêm.
 *
 * Dùng khi web được triển khai lên máy chủ và có dịch vụ hẹn giờ bên ngoài
 * (Vercel Cron, cron-job.org…). Còn khi chạy trên máy cá nhân thì gọi thẳng
 * `npx tsx scripts/quet-dem.ts` bằng Task Scheduler đơn giản hơn — xem
 * `docs/tu-chay-hang-dem.md`.
 *
 * BẢO VỆ: tuyến này chạy việc nặng và tiêu hạn mức, nên phải có khoá. Không
 * dùng phiên đăng nhập được vì dịch vụ hẹn giờ không có trình duyệt — đành
 * dùng một chuỗi bí mật riêng trong `.env`.
 */

import { quetDem } from "@/lib/vanHanh/quetDem";

/** Việc này chạy lâu, nói trước cho máy chủ biết đừng cắt ngang. */
export const maxDuration = 800;
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const khoaThat = process.env.KHOA_CRON?.trim();

  if (!khoaThat) {
    return Response.json(
      {
        loi: "Chưa đặt KHOA_CRON trong .env nên tuyến này bị khoá. Sinh một chuỗi ngẫu nhiên rồi điền vào.",
      },
      { status: 503 },
    );
  }

  const khoaGui = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "")
    .trim();

  if (khoaGui !== khoaThat) {
    return Response.json({ loi: "Khoá không đúng." }, { status: 401 });
  }

  const cacDong: string[] = [];
  const kq = await quetDem((dong) => cacDong.push(dong));

  return Response.json({
    batDau: kq.batDau.toISOString(),
    ketThuc: kq.ketThuc.toISOString(),
    soGiay: Math.round((kq.ketThuc.getTime() - kq.batDau.getTime()) / 1000),
    soBuocHong: kq.soBuocHong,
    cacBuoc: kq.cacBuoc.map((b) => ({
      ten: b.ten,
      thanhCong: b.thanhCong,
      tomTat: b.tomTat,
      giay: b.giay,
    })),
  });
}
