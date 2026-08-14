/**
 * Lấy token để gọi YouTube API thay mặt chủ tài khoản.
 *
 * Token Google chỉ sống khoảng một giờ. Việc quét chạy lúc 21:00 hằng đêm, lúc
 * đó chẳng ai mở trình duyệt, nên không thể trông chờ vào phiên đăng nhập —
 * phải tự đổi "refresh token" lấy token mới.
 *
 * Refresh token là thứ quý nhất ở đây: Google chỉ cấp nó ở lần cấp quyền đầu
 * tiên. Mất là phải vào myaccount.google.com/permissions gỡ quyền rồi đăng nhập
 * lại từ đầu.
 */

import { prisma } from "@/lib/db/prisma";

const ID_TAI_KHOAN = "chu_du_an";

/** Đổi token sớm hơn hạn 5 phút, phòng khi lệnh gọi kéo dài. */
const DEM_TRUOC_MS = 5 * 60 * 1000;

/** Lỗi khi chưa đăng nhập, hoặc quyền đã bị thu hồi. */
export class ChuaKetNoiYouTube extends Error {
  constructor(thongDiep: string) {
    super(thongDiep);
    this.name = "ChuaKetNoiYouTube";
  }
}

/** Quyền bắt buộc phải có thì mới đọc được dữ liệu YouTube của tài khoản. */
export const QUYEN_YOUTUBE = "https://www.googleapis.com/auth/youtube.readonly";

/**
 * Quyền để **sửa** playlist thật — tạo playlist, thêm/gỡ video.
 *
 * TÁCH RIÊNG KHỎI QUYỀN ĐỌC CÓ CHỦ ĐÍCH. Đọc thì vô hại; sửa thì thay đổi tài
 * khoản YouTube thật của chủ nhà. Xin gộp một lần ngay từ đầu thì tiện cho code
 * nhưng người dùng mất khả năng nói "cho đọc thôi, đừng đụng vào".
 *
 * Chưa được bật trong `auth.ts`. Muốn bật thì thêm hằng số này vào `QUYEN_XIN`,
 * khai thêm quyền tương ứng trong màn hình xin quyền của dự án trên Google
 * Cloud, rồi đăng nhập lại — Google chỉ cấp những quyền đã khai sẵn ở đó.
 */
export const QUYEN_SUA_PLAYLIST = "https://www.googleapis.com/auth/youtube";

/**
 * Lời nhắc khi đăng nhập được nhưng Google không cấp quyền YouTube.
 *
 * Đây là cái bẫy đã vấp một lần: Google chỉ cấp những quyền đã khai sẵn trong
 * màn hình xin quyền của dự án trên Google Cloud. Code có xin thêm cũng bị bỏ
 * qua trong im lặng — đăng nhập vẫn thành công, tới lúc gọi API mới báo lỗi 403
 * khó hiểu.
 */
const HUONG_DAN_THIEU_QUYEN = [
  "Đăng nhập thành công nhưng Google không cấp quyền đọc YouTube.",
  "",
  "Cách sửa, trong console.cloud.google.com:",
  "  1. APIs & Services → OAuth consent screen",
  "  2. Mục 'Data Access' (hoặc tab 'Scopes') → Add or Remove Scopes",
  "  3. Lọc theo 'youtube.readonly', tick dòng .../auth/youtube.readonly",
  "  4. Update → Save",
  "  5. Về trang chủ đăng xuất rồi đăng nhập lại, NHỚ TICK ô quyền YouTube",
].join("\n");

interface PhanHoiLamMoi {
  access_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
}

/**
 * Trả về access token còn hạn. Tự làm mới nếu cần.
 *
 * Ném `ChuaKetNoiYouTube` khi chưa đăng nhập lần nào, hoặc khi người dùng đã gỡ
 * quyền của app trong tài khoản Google.
 */
export async function layAccessToken(): Promise<string> {
  const taiKhoan = await prisma.googleAccount.findUnique({
    where: { id: ID_TAI_KHOAN },
  });

  if (!taiKhoan) {
    throw new ChuaKetNoiYouTube(
      "Chưa kết nối tài khoản YouTube. Vào trang chủ bấm 'Đăng nhập bằng Google' một lần.",
    );
  }

  // Bắt lỗi thiếu quyền ngay tại đây, trước khi gọi API. Nếu để Google trả lời
  // thì chỉ nhận được "insufficient authentication scopes" — đúng nhưng không
  // giúp được gì cho người phải đi sửa.
  if (taiKhoan.scope && !taiKhoan.scope.split(" ").includes(QUYEN_YOUTUBE)) {
    throw new ChuaKetNoiYouTube(HUONG_DAN_THIEU_QUYEN);
  }

  const conHan =
    taiKhoan.expiresAt !== null &&
    taiKhoan.expiresAt.getTime() - DEM_TRUOC_MS > Date.now();

  if (conHan) return taiKhoan.accessToken;

  if (!taiKhoan.refreshToken) {
    throw new ChuaKetNoiYouTube(
      "Token đã hết hạn mà không có refresh token để làm mới. Cần đăng nhập lại: vào https://myaccount.google.com/permissions gỡ quyền của app, rồi đăng nhập lại từ trang chủ.",
    );
  }

  return await lamMoiToken(taiKhoan.refreshToken);
}

/** Đổi refresh token lấy access token mới, rồi cất lại vào database. */
async function lamMoiToken(refreshToken: string): Promise<string> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new ChuaKetNoiYouTube(
      "Thiếu GOOGLE_CLIENT_ID hoặc GOOGLE_CLIENT_SECRET trong .env.",
    );
  }

  const phanHoi = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const ketQua = (await phanHoi.json()) as PhanHoiLamMoi;

  if (!phanHoi.ok || !ketQua.access_token) {
    // `invalid_grant` nghĩa là refresh token không dùng được nữa — thường do
    // người dùng đã gỡ quyền của app, hoặc đổi mật khẩu Google.
    if (ketQua.error === "invalid_grant") {
      throw new ChuaKetNoiYouTube(
        "Google đã thu hồi quyền của app (có thể do bạn gỡ quyền hoặc đổi mật khẩu). Đăng nhập lại từ trang chủ để cấp quyền lần nữa.",
      );
    }
    throw new ChuaKetNoiYouTube(
      `Không làm mới được token: ${ketQua.error_description ?? ketQua.error ?? phanHoi.status}`,
    );
  }

  const hetHanLuc = ketQua.expires_in
    ? new Date(Date.now() + ketQua.expires_in * 1000)
    : null;

  await prisma.googleAccount.update({
    where: { id: ID_TAI_KHOAN },
    data: {
      accessToken: ketQua.access_token,
      expiresAt: hetHanLuc,
      ...(ketQua.scope ? { scope: ketQua.scope } : {}),
      // Cố ý KHÔNG đụng tới refreshToken: lệnh làm mới không trả về cái mới,
      // ghi đè bằng rỗng là mất luôn khả năng chạy nền.
    },
  });

  return ketQua.access_token;
}

/** Đã kết nối tài khoản YouTube chưa. Dùng để hiện trạng thái trên màn hình. */
export async function daKetNoiChua(): Promise<boolean> {
  const taiKhoan = await prisma.googleAccount.findUnique({
    where: { id: ID_TAI_KHOAN },
    select: { refreshToken: true },
  });
  return Boolean(taiKhoan?.refreshToken);
}
