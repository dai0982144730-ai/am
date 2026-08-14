/**
 * Đăng nhập bằng tài khoản Google, và xin quyền đọc dữ liệu YouTube.
 *
 * App này dùng riêng cho MỘT người, nên ở đây cố ý không dựng bộ bảng
 * User/Account/Session của Auth.js (thiết kế cho web nhiều người dùng). Thay
 * vào đó:
 *   - Phiên đăng nhập giữ trong cookie đã mã hoá (kiểu "jwt"), không cần bảng.
 *   - Token Google lưu vào đúng một dòng trong bảng `GoogleAccount`, để các
 *     công việc chạy nền (quét YouTube lúc 21:00) dùng được mà không cần người
 *     dùng đang mở trình duyệt.
 *   - Chỉ đúng email khai trong `EMAIL_CHU_DU_AN` mới đăng nhập được. Ai khác
 *     bấm vào cũng bị chặn.
 */

import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

import { prisma } from "@/lib/db/prisma";

/**
 * Quyền xin từ Google.
 *
 * Chỉ xin quyền ĐỌC. Quyền ghi (thêm/sửa playlist thật) là chuyện của Phase 7,
 * khi đó xin riêng thành một lần cấp quyền khác — người dùng thấy rõ mình đang
 * cho phép cái gì, thay vì bị gộp chung ngay từ đầu.
 */
const QUYEN_XIN = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/youtube.readonly",
].join(" ");

/** Id cố định của dòng duy nhất trong bảng `GoogleAccount`. */
export const ID_TAI_KHOAN = "chu_du_an";

function emailChuDuAn(): string | undefined {
  return process.env.EMAIL_CHU_DU_AN?.trim().toLowerCase() || undefined;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          scope: QUYEN_XIN,
          // Hai tham số này là điều kiện để Google chịu cấp "refresh token" —
          // thứ duy nhất cho phép app tự lấy token mới khi chạy nền. Thiếu nó
          // thì cứ khoảng một giờ là hết quyền gọi API.
          access_type: "offline",
          // Google chỉ cấp refresh token ở lần cấp quyền ĐẦU TIÊN. Ép hỏi lại
          // mỗi lần đăng nhập để lỡ mất token vẫn xin lại được, không phải vào
          // myaccount.google.com gỡ quyền thủ công.
          prompt: "consent",
        },
      },
    }),
  ],

  session: { strategy: "jwt" },

  callbacks: {
    /**
     * Chặn cửa: chỉ chủ dự án mới vào được.
     *
     * Nếu chưa khai `EMAIL_CHU_DU_AN` thì chặn tất cả — thà không đăng nhập
     * được còn hơn mở toang cho bất kỳ ai có tài khoản Google.
     */
    async signIn({ profile }) {
      const email = profile?.email?.toLowerCase();
      const duocPhep = emailChuDuAn();

      if (!duocPhep) {
        console.error(
          "[đăng nhập] Chưa khai EMAIL_CHU_DU_AN trong .env nên chặn tất cả.",
        );
        return false;
      }
      if (!email || email !== duocPhep) {
        console.warn(`[đăng nhập] Từ chối email lạ: ${email ?? "(không rõ)"}`);
        return false;
      }
      if (profile?.email_verified === false) {
        console.warn("[đăng nhập] Từ chối vì email chưa được Google xác minh.");
        return false;
      }
      return true;
    },

    /**
     * Ngay sau khi cấp quyền xong, Google trả token về đây. Đây là lần duy
     * nhất nhìn thấy refresh token, nên phải cất vào database ngay.
     */
    async jwt({ token, account, profile }) {
      if (!account) return token;

      const email = profile?.email ?? token.email;
      if (!account.access_token || !email) return token;

      const hetHanLuc = account.expires_at
        ? new Date(account.expires_at * 1000)
        : null;

      try {
        await prisma.googleAccount.upsert({
          where: { id: ID_TAI_KHOAN },
          create: {
            id: ID_TAI_KHOAN,
            email,
            accessToken: account.access_token,
            refreshToken: account.refresh_token ?? null,
            expiresAt: hetHanLuc,
            scope: account.scope ?? null,
          },
          update: {
            email,
            accessToken: account.access_token,
            expiresAt: hetHanLuc,
            scope: account.scope ?? null,
            // Chỉ ghi đè refresh token khi lần này Google thực sự cấp cái mới.
            // Những lần đăng nhập sau Google thường không gửi lại, ghi đè bằng
            // null là mất luôn khả năng chạy nền.
            ...(account.refresh_token
              ? { refreshToken: account.refresh_token }
              : {}),
          },
        });
      } catch (loi) {
        // Lưu token hỏng thì vẫn cho đăng nhập — người dùng vẫn xem được web,
        // chỉ là phần quét nền chưa chạy được. Báo ra log để còn biết đường sửa.
        console.error("[đăng nhập] Không lưu được token Google:", loi);
      }

      return token;
    },
  },

  pages: {
    signIn: "/dang-nhap",
    error: "/dang-nhap",
  },
});
