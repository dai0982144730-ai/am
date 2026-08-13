import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * Kết nối cơ sở dữ liệu.
 *
 * Trong lúc phát triển, Next.js nạp lại code liên tục mỗi khi sửa file. Nếu
 * mỗi lần nạp lại đều tạo một kết nối mới thì chỉ vài phút là hết chỗ kết nối
 * và database từ chối phục vụ. Nên ở chế độ phát triển ta giữ lại một kết nối
 * duy nhất trong biến toàn cục và dùng lại.
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "Thiếu DATABASE_URL. Chép file .env.example thành .env rồi điền chuỗi kết nối database (lấy tại neon.tech).",
    );
  }

  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
