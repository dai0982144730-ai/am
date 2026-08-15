/**
 * Đường gọi cho khung trò chuyện trong web.
 *
 * KHÁC với `/api/v1/tro-ly/hoi`: cái kia dành cho app Android gọi từ xa, xác
 * thực bằng token riêng và đi đường khoá API. Cái này chỉ phục vụ chính trang
 * web đang mở, xác thực bằng phiên đăng nhập, và đi đường Claude CLI trên máy
 * để khỏi tốn tiền theo chữ.
 */

import { NextResponse } from "next/server";

import { laChuDuAn } from "@/lib/quyen";
import { traLoiTroChuyen, type LuotNoi } from "@/lib/troChuyen/traLoi";

export const dynamic = "force-dynamic";

/** Claude đọc mấy nội dung dài nên lâu hơn các đường gọi khác. */
export const maxDuration = 180;

/** Chặn câu hỏi dài vô lý — vừa tốn vừa gần như chắc chắn là dán nhầm. */
const DAI_TOI_DA = 4_000;

export async function POST(request: Request) {
  // Chặn cửa thật, không phải chỉ giấu khung chat trên giao diện: việc này gọi
  // Claude, tức là tiêu hạn mức gói Pro của chủ dự án.
  if (!(await laChuDuAn())) {
    return NextResponse.json(
      { loi: "Cần đăng nhập để trò chuyện với trợ lý." },
      { status: 401 },
    );
  }

  let than: unknown;
  try {
    than = await request.json();
  } catch {
    return NextResponse.json({ loi: "Thân yêu cầu không hợp lệ." }, { status: 400 });
  }

  const { cauHoi, lichSu } = (than ?? {}) as {
    cauHoi?: unknown;
    lichSu?: unknown;
  };

  if (typeof cauHoi !== "string" || !cauHoi.trim()) {
    return NextResponse.json({ loi: "Chưa có câu hỏi." }, { status: 400 });
  }
  if (cauHoi.length > DAI_TOI_DA) {
    return NextResponse.json(
      { loi: `Câu hỏi dài quá ${DAI_TOI_DA} ký tự.` },
      { status: 400 },
    );
  }

  // Lịch sử do trình duyệt gửi lên nên phải kiểm từng phần tử, không tin sẵn
  const machCu: LuotNoi[] = Array.isArray(lichSu)
    ? lichSu
        .filter(
          (l): l is LuotNoi =>
            !!l &&
            typeof l === "object" &&
            typeof (l as LuotNoi).chu === "string" &&
            ((l as LuotNoi).vaiTro === "nguoi" || (l as LuotNoi).vaiTro === "may"),
        )
        .slice(-20)
    : [];

  try {
    const kq = await traLoiTroChuyen(cauHoi, machCu);
    return NextResponse.json(kq);
  } catch (e) {
    // Nói thẳng lỗi ra: đây là app dùng riêng một người, giấu lỗi đi chỉ làm
    // chính chủ dự án khó lần khi có trục trặc
    return NextResponse.json(
      { loi: e instanceof Error ? e.message : "Trợ lý gặp trục trặc." },
      { status: 500 },
    );
  }
}
